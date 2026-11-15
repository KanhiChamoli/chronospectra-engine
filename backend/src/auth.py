"""SQLite-backed accounts, email verification, sessions, and observations."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import re
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Iterator

from cryptography.fernet import Fernet
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")
SESSION_COOKIE = "chronospectra_session"
SESSION_TTL = timedelta(days=14)
EMAIL_PATTERN = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,253}\.[^@\s]{2,63}$")


class RegisterRequest(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)
    date_of_birth: date
    terms_accepted: bool

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("Enter a valid email address.")
        return normalized

    @field_validator("full_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Full name is required.")
        return normalized

    @field_validator("date_of_birth")
    @classmethod
    def validate_birth_date(cls, value: date) -> date:
        if value > datetime.now(timezone.utc).date():
            raise ValueError("Date of birth cannot be in the future.")
        return value


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)


class ObservationCreate(BaseModel):
    ra_deg: float = Field(ge=0, lt=360)
    dec_deg: float = Field(ge=-90, le=90)
    target_name: str = Field(min_length=1, max_length=160)
    notes: str = Field(default="", max_length=4000)
    source: str = Field(default="manual", max_length=32)

    @field_validator("target_name")
    @classmethod
    def normalize_target_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Target name is required.")
        return normalized


class ObservationUpdate(BaseModel):
    notes: str = Field(max_length=4000)


def _database_path() -> Path:
    configured = os.environ.get("CHRONOSPECTRA_AUTH_DB")
    return Path(configured) if configured else Path("backend/data/chronospectra.sqlite3")


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    path = _database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        with connection:
            yield connection
    finally:
        connection.close()


def initialize_auth_db() -> None:
    with _connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                date_of_birth TEXT NOT NULL,
                email_verified INTEGER NOT NULL DEFAULT 0,
                verification_hash TEXT,
                verification_expires_at TEXT,
                terms_accepted_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS auth_login_attempts (
                address_hash TEXT PRIMARY KEY,
                failed_attempts INTEGER NOT NULL,
                window_started_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS observations (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                ra_deg REAL NOT NULL,
                dec_deg REAL NOT NULL,
                target_name TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS observations_user_created
                ON observations(user_id, created_at DESC);
            """
        )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def _password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt_hex, digest_hex = stored_hash.split("$", 2)
        if algorithm != "scrypt":
            return False
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=bytes.fromhex(salt_hex),
            n=2**14,
            r=8,
            p=1,
            dklen=len(expected),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def _pii_fernet() -> Fernet:
    key = os.environ.get("CHRONOSPECTRA_PII_ENCRYPTION_KEY")
    if key:
        try:
            return Fernet(key.encode("ascii"))
        except (ValueError, UnicodeEncodeError) as exc:
            logger.exception("The configured PII encryption key is invalid")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Secure account storage is not configured correctly.",
            ) from exc

    seed = os.environ.get("CHRONOSPECTRA_PII_ENCRYPTION_SEED")
    if seed:
        derived_key = base64.urlsafe_b64encode(
            hashlib.sha256(seed.encode("utf-8")).digest()
        )
        return Fernet(derived_key)

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Secure account storage is not configured. Contact the site administrator.",
    )


def _cookie_options() -> dict[str, bool | str]:
    same_site = os.environ.get("CHRONOSPECTRA_COOKIE_SAMESITE", "strict").lower()
    if same_site not in {"strict", "lax", "none"}:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session cookie settings are not configured correctly.",
        )
    return {
        "secure": os.environ.get("CHRONOSPECTRA_COOKIE_SECURE", "false").lower() == "true",
        "samesite": same_site,
        "path": "/api/v1",
    }


def _encrypt_date_of_birth(value: date) -> str:
    return _pii_fernet().encrypt(value.isoformat().encode("ascii")).decode("ascii")


def _check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not origin:
        if os.environ.get("CHRONOSPECTRA_COOKIE_SAMESITE", "strict").lower() == "none":
            raise HTTPException(status_code=403, detail="A trusted request origin is required.")
        return
    allowed = {
        item.strip().rstrip("/")
        for item in os.environ.get(
            "CHRONOSPECTRA_CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if item.strip()
    }
    if origin.rstrip("/") not in allowed:
        raise HTTPException(status_code=403, detail="Request origin is not allowed.")


def _session_user(
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> dict[str, object]:
    if not session_token:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    initialize_auth_db()
    now = _iso(_now())
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT users.id, users.email, users.full_name, users.email_verified
            FROM auth_sessions
            JOIN users ON users.id = auth_sessions.user_id
            WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
            """,
            (_token_hash(session_token), now),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    return dict(row)


CurrentUser = Annotated[dict[str, object], Depends(_session_user)]


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request) -> dict[str, str]:
    _check_origin(request)
    if payload.terms_accepted is not True:
        raise HTTPException(
            status_code=422,
            detail="Accept the Privacy Policy and Terms of Service to create an account.",
        )
    initialize_auth_db()
    now = _now()
    try:
        with _connect() as connection:
            connection.execute(
                """
                INSERT INTO users (
                    email, password_hash, full_name, date_of_birth,
                    email_verified, terms_accepted_at, created_at
                ) VALUES (?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    payload.email,
                    _password_hash(payload.password),
                    payload.full_name,
                    _encrypt_date_of_birth(payload.date_of_birth),
                    _iso(now),
                    _iso(now),
                ),
            )
    except sqlite3.IntegrityError:
        logger.info("Registration attempted for an existing email address")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )
    return {"message": "Account created. You can now sign in."}





@router.post("/auth/login")
def login(payload: LoginRequest, request: Request, response: Response) -> dict[str, object]:
    _check_origin(request)
    initialize_auth_db()
    remote_address = request.client.host if request.client else "unknown"
    address_hash = hashlib.sha256(remote_address.encode("utf-8")).hexdigest()
    now = _now()
    window_start = _iso(now - timedelta(minutes=15))
    with _connect() as connection:
        connection.execute(
            "DELETE FROM auth_login_attempts WHERE window_started_at <= ?",
            (window_start,),
        )
        attempts = connection.execute(
            "SELECT failed_attempts, window_started_at FROM auth_login_attempts WHERE address_hash = ?",
            (address_hash,),
        ).fetchone()
    if attempts and attempts["window_started_at"] > window_start and attempts["failed_attempts"] >= 8:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sign-in attempts. Please wait 15 minutes and try again.",
        )
    email = payload.email.strip().lower()
    with _connect() as connection:
        row = connection.execute(
            "SELECT id, email, password_hash, full_name, email_verified FROM users WHERE email = ?",
            (email,),
        ).fetchone()
    if row is None or not _verify_password(payload.password, row["password_hash"]):
        with _connect() as connection:
            if attempts and attempts["window_started_at"] > window_start:
                connection.execute(
                    "UPDATE auth_login_attempts SET failed_attempts = failed_attempts + 1 WHERE address_hash = ?",
                    (address_hash,),
                )
            else:
                connection.execute(
                    """
                    INSERT INTO auth_login_attempts (address_hash, failed_attempts, window_started_at)
                    VALUES (?, 1, ?)
                    ON CONFLICT(address_hash) DO UPDATE SET
                        failed_attempts = 1, window_started_at = excluded.window_started_at
                    """,
                    (address_hash, _iso(now)),
                )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect, or the email address has not been verified.",
        )
    if not row["email_verified"]:
        with _connect() as connection:
            connection.execute(
                """
                INSERT INTO auth_login_attempts (address_hash, failed_attempts, window_started_at)
                VALUES (?, 1, ?)
                ON CONFLICT(address_hash) DO UPDATE SET
                    failed_attempts = auth_login_attempts.failed_attempts + 1
                """,
                (address_hash, _iso(now)),
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect, or the email address has not been verified.",
        )
    raw_token = secrets.token_urlsafe(32)
    with _connect() as connection:
        connection.execute("DELETE FROM auth_login_attempts WHERE address_hash = ?", (address_hash,))
        connection.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (_iso(now),))
        connection.execute(
            "INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (_token_hash(raw_token), row["id"], _iso(now + SESSION_TTL), _iso(now)),
        )
    response.set_cookie(
        key=SESSION_COOKIE,
        value=raw_token,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        **_cookie_options(),
    )
    return {
        "id": row["id"],
        "email": row["email"],
        "full_name": row["full_name"],
        "email_verified": bool(row["email_verified"]),
    }


@router.post("/auth/logout")
def logout(
    request: Request,
    response: Response,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> dict[str, str]:
    _check_origin(request)
    if session_token:
        initialize_auth_db()
        with _connect() as connection:
            connection.execute(
                "DELETE FROM auth_sessions WHERE token_hash = ?", (_token_hash(session_token),)
            )
    response.delete_cookie(key=SESSION_COOKIE, httponly=True, **_cookie_options())
    return {"message": "Signed out."}


@router.get("/auth/me")
def me(user: CurrentUser) -> dict[str, object]:
    return {**user, "email_verified": bool(user["email_verified"])}


@router.delete("/auth/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    request: Request,
    response: Response,
    user: CurrentUser,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> Response:
    _check_origin(request)
    with _connect() as connection:
        connection.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    response.delete_cookie(key=SESSION_COOKIE, httponly=True, **_cookie_options())
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/observations")
def list_observations(user: CurrentUser) -> list[dict[str, object]]:
    initialize_auth_db()
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT id, ra_deg, dec_deg, target_name, notes, source, created_at
            FROM observations WHERE user_id = ? ORDER BY created_at DESC, id DESC
            """,
            (user["id"],),
        ).fetchall()
    return [dict(row) for row in rows]


@router.post("/observations", status_code=status.HTTP_201_CREATED)
def create_observation(
    payload: ObservationCreate,
    request: Request,
    user: CurrentUser,
) -> dict[str, object]:
    _check_origin(request)
    initialize_auth_db()
    with _connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO observations (user_id, ra_deg, dec_deg, target_name, notes, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["id"],
                payload.ra_deg,
                payload.dec_deg,
                payload.target_name,
                payload.notes,
                payload.source,
                _iso(_now()),
            ),
        )
        row = connection.execute(
            """
            SELECT id, ra_deg, dec_deg, target_name, notes, source, created_at
            FROM observations WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
    return dict(row)


@router.patch("/observations/{observation_id}")
def update_observation(
    observation_id: int,
    payload: ObservationUpdate,
    request: Request,
    user: CurrentUser,
) -> dict[str, object]:
    _check_origin(request)
    initialize_auth_db()
    with _connect() as connection:
        cursor = connection.execute(
            "UPDATE observations SET notes = ? WHERE id = ? AND user_id = ?",
            (payload.notes, observation_id, user["id"]),
        )
        if cursor.rowcount != 1:
            raise HTTPException(status_code=404, detail="Observation not found.")
        row = connection.execute(
            """
            SELECT id, ra_deg, dec_deg, target_name, notes, source, created_at
            FROM observations WHERE id = ? AND user_id = ?
            """,
            (observation_id, user["id"]),
        ).fetchone()
    return dict(row)


@router.delete("/observations/{observation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_observation(
    observation_id: int,
    request: Request,
    user: CurrentUser,
) -> Response:
    _check_origin(request)
    initialize_auth_db()
    with _connect() as connection:
        cursor = connection.execute(
            "DELETE FROM observations WHERE id = ? AND user_id = ?",
            (observation_id, user["id"]),
        )
    if cursor.rowcount != 1:
        raise HTTPException(status_code=404, detail="Observation not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
