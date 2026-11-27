import os
from datetime import datetime, timezone
import secrets

import pytest

# Random per run: no credential or secret literal is committed.
TEST_PASSWORD = secrets.token_urlsafe(12)

os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:3000")
os.environ.setdefault("JWT_SECRET", secrets.token_hex(32))
os.environ.setdefault("FILE_URL_SECRET", secrets.token_hex(32))
os.environ.setdefault("APP_TIMEZONE", "UTC")
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["APP_ENV"] = "testing"

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402


@pytest.fixture
def app(tmp_path):
    # the memory transport collects mail in `app.common.mail.outbox` (V17, ACT-08)
    app = create_app({"TESTING": True, "UPLOAD_DIR": str(tmp_path / "uploads"), "MAIL_BACKEND": "memory"})
    from app.common import mail

    mail.outbox.clear()
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def make_user(app):
    from argon2 import PasswordHasher

    from app.models import User

    hasher = PasswordHasher()

    def _make(role="member", login=None):
        login = login or f"{role}{User.query.count()}"
        user = User(full_name=role.title(), username=login, email=f"{login}@example.com", password_hash=hasher.hash(TEST_PASSWORD), role=role, email_verified_at=datetime.now(timezone.utc))
        db.session.add(user)
        db.session.commit()
        return user

    return _make


@pytest.fixture
def auth(app):
    from app.common.auth import issue_token

    def _auth(user):
        return {"Authorization": f"Bearer {issue_token(user.id, user.role)}"}

    return _auth


@pytest.fixture
def make_app(tmp_path):
    """Factory for apps with a given APP_ENV (docs gating tests)."""
    created = []

    def _make(app_env):
        app = create_app({"TESTING": True, "APP_ENV": app_env, "MAIL_BACKEND": "memory", "UPLOAD_DIR": str(tmp_path / "u")})
        created.append(app)
        return app

    return _make


@pytest.fixture(autouse=True)
def fast_password_hashing(monkeypatch):
    """Cheap argon2 parameters keep property tests fast; hashes stay valid argon2."""
    from argon2 import PasswordHasher

    cheap = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)
    monkeypatch.setattr("app.blueprints.auth.service._hasher", cheap)
