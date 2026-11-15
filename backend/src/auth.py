"""SQLite-backed accounts, email verification, sessions, and observations."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import smtplib
import sqlite3
import ssl
import urllib.error
import urllib.parse
import urllib.request
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Annotated, Iterator

from cryptography.fernet import Fernet
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")
SESSION_COOKIE = "chronospectra_session"
SESSION_TTL = timedelta(days=14)
VERIFICATION_TTL = timedelta(hours=24)
EMAIL_PATTERN = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,253}\.[^@\s]{2,63}$")


class RegisterRequest(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)
    date_of_birth: date
    terms_accepted: bool
    captcha_token: str = Field(min_length=1, max_length=4096)

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


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=32, max_length=256)


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
    key = os.environ.get("CHRONOSPECTRA_PII_ENCRYPTION_KEY")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Secure account storage is not configured. Contact the site administrator.",
        )
    try:
        return Fernet(key.encode("ascii")).encrypt(value.isoformat().encode("ascii")).decode("ascii")
    except (ValueError, TypeError) as exc:
        logger.exception("The configured PII encryption key is invalid")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Secure account storage is not configured correctly.",
        ) from exc


def verify_turnstile(token: str, remote_ip: str | None) -> None:
    secret = os.environ.get("CHRONOSPECTRA_TURNSTILE_SECRET_KEY")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sign-up verification is not configured. Contact the site administrator.",
        )
    expected_hostnames = {
        hostname.strip().lower().rstrip(".")
        for hostname in os.environ.get("CHRONOSPECTRA_TURNSTILE_HOSTNAMES", "").split(",")
        if hostname.strip()
    }
    if not expected_hostnames:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sign-up verification hostnames are not configured.",
        )
    fields = {"secret": secret, "response": token}
    if remote_ip:
        fields["remoteip"] = remote_ip
    request = urllib.request.Request(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        data=urllib.parse.urlencode(fields).encode("ascii"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            result = response.read(16_384)
        payload = json.loads(result)
    except (OSError, urllib.error.URLError, ValueError) as exc:
        logger.exception("Turnstile verification request failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not verify the CAPTCHA right now. Please try again.",
        ) from exc
    if not _valid_turnstile_payload(payload, expected_hostnames):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA verification failed. Please complete it again.",
        )


def _valid_turnstile_payload(payload: object, expected_hostnames: set[str]) -> bool:
    if not isinstance(payload, dict):
        return False
    hostname = payload.get("hostname")
    return (
        payload.get("success") is True
        and isinstance(hostname, str)
        and hostname.lower().rstrip(".") in expected_hostnames
        and payload.get("action") == "signup"
    )


def send_verification_email(email: str, token: str) -> None:
    required = (
        "CHRONOSPECTRA_SMTP_HOST",
        "CHRONOSPECTRA_SMTP_USER",
        "CHRONOSPECTRA_SMTP_PASSWORD",
        "CHRONOSPECTRA_SMTP_FROM",
        "CHRONOSPECTRA_FRONTEND_URL",
    )
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise RuntimeError(
            "Email verification is not configured; missing " + ", ".join(missing)
        )
    frontend = os.environ["CHRONOSPECTRA_FRONTEND_URL"].rstrip("/")
    verify_url = f"{frontend}/verify?token={urllib.parse.quote(token)}"
    message = EmailMessage()
    message["Subject"] = "Verify your Chronospectra account"
    message["From"] = os.environ["CHRONOSPECTRA_SMTP_FROM"]
    message["To"] = email
    message.set_content(
        "Verify your Chronospectra account using this link. "
        f"The link expires in 24 hours:\n\n{verify_url}\n"
    )
    host = os.environ["CHRONOSPECTRA_SMTP_HOST"]
    port = int(os.environ.get("CHRONOSPECTRA_SMTP_PORT", "587"))
    timeout = 10
    with smtplib.SMTP(host, port, timeout=timeout) as smtp:
        smtp.ehlo()
        if os.environ.get("CHRONOSPECTRA_SMTP_STARTTLS", "true").lower() == "true":
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
        smtp.login(
            os.environ["CHRONOSPECTRA_SMTP_USER"],
            os.environ["CHRONOSPECTRA_SMTP_PASSWORD"],
        )
        smtp.send_message(message)


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


@router.post("/auth/register", status_code=status.HTTP_202_ACCEPTED)
def register(payload: RegisterRequest, request: Request) -> dict[str, str]:
    _check_origin(request)
    if payload.terms_accepted is not True:
        raise HTTPException(
            status_code=422,
            detail="Accept the Privacy Policy and Terms of Service to create an account.",
        )
    verify_turnstile(payload.captcha_token, request.client.host if request.client else None)
    initialize_auth_db()
    now = _now()
    verification_token = secrets.token_urlsafe(32)
    try:
        with _connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (
                    email, password_hash, full_name, date_of_birth,
                    verification_hash, verification_expires_at,
                    terms_accepted_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.email,
                    _password_hash(payload.password),
                    payload.full_name,
                    _encrypt_date_of_birth(payload.date_of_birth),
                    _token_hash(verification_token),
                    _iso(now + VERIFICATION_TTL),
                    _iso(now),
                    _iso(now),
                ),
            )
            user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        logger.info("Registration attempted for an existing email address")
        return {
            "message": "If this email address can be registered, check it for verification instructions."
        }
    try:
        send_verification_email(payload.email, verification_token)
    except (OSError, RuntimeError, smtplib.SMTPException, ValueError) as exc:
        logger.exception("Could not send verification email for user id %s", user_id)
        with _connect() as connection:
            connection.execute("DELETE FROM users WHERE id = ?", (user_id,))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="We could not send the verification email. No account was created; try again later.",
        ) from exc
    return {
        "message": "If this email address can be registered, check it for verification instructions."
    }


@router.post("/auth/verify-email")
def verify_email(payload: VerifyEmailRequest) -> dict[str, str]:
    initialize_auth_db()
    with _connect() as connection:
        cursor = connection.execute(
            """
            UPDATE users
            SET email_verified = 1, verification_hash = NULL,
                verification_expires_at = NULL
            WHERE verification_hash = ? AND verification_expires_at > ?
            """,
            (_token_hash(payload.token), _iso(_now())),
        )
    if cursor.rowcount != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or has expired.",
        )
    return {"message": "Email verified. You can now sign in."}


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
