import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from backend.main import app


class AuthApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.encryption_key = Fernet.generate_key()
        self.environment = patch.dict(
            os.environ,
            {
                "CHRONOSPECTRA_AUTH_DB": str(Path(self.temp.name) / "auth.sqlite3"),
                "CHRONOSPECTRA_PII_ENCRYPTION_KEY": self.encryption_key.decode("ascii"),
            },
        )
        self.environment.start()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.environment.stop()
        self.temp.cleanup()

    def register(self, email: str = "observer@example.org", terms: bool = True) -> object:
        return self.client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "space-observation-phrase",
                "full_name": "A Sky Observer",
                "date_of_birth": "1994-04-12",
                "terms_accepted": terms,
            },
        )

    def register_and_sign_in(self) -> None:
        response = self.register()
        self.assertEqual(response.status_code, 201, response.text)
        login = self.client.post(
            "/api/v1/auth/login",
            json={
                "email": "observer@example.org",
                "password": "space-observation-phrase",
            },
        )
        self.assertEqual(login.status_code, 200, login.text)
        self.assertTrue(login.json()["email_verified"])
        self.assertIn("chronospectra_session", login.cookies)

    def test_registration_requires_consent(self) -> None:
        response = self.register(terms=False)
        self.assertEqual(response.status_code, 422)

    def test_registration_rejects_duplicate_email(self) -> None:
        self.assertEqual(self.register().status_code, 201)
        duplicate = self.register()
        self.assertEqual(duplicate.status_code, 409, duplicate.text)

    def test_registration_login_and_observation_crud(self) -> None:
        self.register_and_sign_in()
        connection = sqlite3.connect(os.environ["CHRONOSPECTRA_AUTH_DB"])
        try:
            stored_dob, stored_password = connection.execute(
                "SELECT date_of_birth, password_hash FROM users"
            ).fetchone()
        finally:
            connection.close()
        self.assertNotEqual(stored_dob, "1994-04-12")
        self.assertEqual(Fernet(self.encryption_key).decrypt(stored_dob.encode()).decode(), "1994-04-12")
        self.assertTrue(stored_password.startswith("scrypt$"))

        created = self.client.post(
            "/api/v1/observations",
            json={
                "ra_deg": 133.795129,
                "dec_deg": -7.245147,
                "target_name": "WISE 0855",
                "notes": "Review the second epoch.",
                "source": "coordinate",
            },
        )
        self.assertEqual(created.status_code, 201, created.text)
        observation_id = created.json()["id"]
        self.assertEqual(self.client.get("/api/v1/observations").json()[0]["target_name"], "WISE 0855")

        updated = self.client.patch(
            f"/api/v1/observations/{observation_id}",
            json={"notes": "Reviewed."},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["notes"], "Reviewed.")

        deleted = self.client.delete(f"/api/v1/observations/{observation_id}")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.client.get("/api/v1/observations").json(), [])

    def test_account_deletion_cascades_and_revokes_session(self) -> None:
        self.register_and_sign_in()
        saved = self.client.post(
            "/api/v1/observations",
            json={"ra_deg": 10, "dec_deg": 20, "target_name": "Vega"},
        )
        self.assertEqual(saved.status_code, 201)
        deleted = self.client.delete("/api/v1/auth/me")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.client.get("/api/v1/auth/me").status_code, 401)

    def test_unauthenticated_requests_are_rejected(self) -> None:
        self.assertEqual(self.client.get("/api/v1/observations").status_code, 401)
        login = self.client.post(
            "/api/v1/auth/login",
            json={
                "email": "unknown@example.org",
                "password": "not-the-password",
            },
        )
        self.assertEqual(login.status_code, 401)

    def test_sign_in_attempts_are_rate_limited(self) -> None:
        for _ in range(8):
            response = self.client.post(
                "/api/v1/auth/login",
                json={"email": "unknown@example.org", "password": "not-the-password"},
            )
            self.assertEqual(response.status_code, 401)
        limited = self.client.post(
            "/api/v1/auth/login",
            json={"email": "unknown@example.org", "password": "not-the-password"},
        )
        self.assertEqual(limited.status_code, 429)


if __name__ == "__main__":
    unittest.main()
