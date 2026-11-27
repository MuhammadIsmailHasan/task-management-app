"""Shared pieces of the unit suite.

A unit test here never opens a database and never sends an HTTP request: repositories and other collaborators are
replaced by mocks, and `db.session` is a MagicMock. The `ctx` fixture gives an application context only for the code
that reads `current_app.config`.
"""
from unittest.mock import MagicMock

import pytest

from app import create_app
from app.extensions import db


@pytest.fixture
def ctx(tmp_path):
    """An application context with test settings; no table is created and no connection is opened."""
    app = create_app({"TESTING": True, "UPLOAD_DIR": str(tmp_path / "uploads"), "MAIL_BACKEND": "memory", "APP_TIMEZONE": "UTC"})
    with app.app_context():
        yield app


@pytest.fixture
def session(monkeypatch):
    """`db.session` as a MagicMock: commits, flushes, adds, and queries are recorded, never sent."""
    fake = MagicMock(name="db.session")
    monkeypatch.setattr(db, "session", fake)
    return fake


@pytest.fixture
def stub(monkeypatch):
    """Replace `module.name` with a MagicMock (or `value`) and return it: `repo = stub(service, "repo")`."""

    def replace(module, name, value=None):
        fake = MagicMock(name=f"{module.__name__}.{name}") if value is None else value
        monkeypatch.setattr(module, name, fake)
        return fake

    return replace
