from unittest.mock import MagicMock

import pytest

from app import create_app
from app.extensions import db


@pytest.fixture
def ctx(tmp_path):
    app = create_app({"TESTING": True, "UPLOAD_DIR": str(tmp_path / "uploads"), "MAIL_BACKEND": "memory", "APP_TIMEZONE": "UTC"})
    with app.app_context():
        yield app


@pytest.fixture
def session(monkeypatch):
    fake = MagicMock(name="db.session")
    monkeypatch.setattr(db, "session", fake)
    return fake


@pytest.fixture
def stub(monkeypatch):
    def replace(module, name, value=None):
        fake = MagicMock(name=f"{module.__name__}.{name}") if value is None else value
        monkeypatch.setattr(module, name, fake)
        return fake

    return replace
