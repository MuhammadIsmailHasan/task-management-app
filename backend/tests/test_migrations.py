"""The V10 and V12 reset migrations outside development (Decision AN, Property 61)."""
import importlib.util
from pathlib import Path
from unittest.mock import MagicMock

import pytest

VERSIONS = Path(__file__).resolve().parents[1] / "migrations" / "versions"
RESETS = ("b7d2e4f6a801_v10_identity_share_rate_limit", "c9e1a5b7d302_v12_private_boards_invites")


@pytest.fixture(params=RESETS)
def migration(request, monkeypatch):
    spec = importlib.util.spec_from_file_location(request.param, VERSIONS / f"{request.param}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(module, "op", MagicMock())
    return module


def _truncated(op):
    return any("TRUNCATE" in str(c) for c in op.execute.call_args_list)


@pytest.mark.parametrize("env", [None, "", "production", "staging"])
def test_property_61_empty_database_migrates_without_truncate(migration, monkeypatch, env):
    monkeypatch.delenv("APP_ENV", raising=False) if env is None else monkeypatch.setenv("APP_ENV", env)
    migration.op.get_bind.return_value.execute.return_value.first.return_value = None
    migration.upgrade()
    assert not _truncated(migration.op)
    assert migration.op.add_column.called


@pytest.mark.parametrize("env", [None, "", "production", "staging"])
def test_property_61_existing_users_abort_before_any_change(migration, monkeypatch, env):
    monkeypatch.delenv("APP_ENV", raising=False) if env is None else monkeypatch.setenv("APP_ENV", env)
    migration.op.get_bind.return_value.execute.return_value.first.return_value = (1,)
    with pytest.raises(RuntimeError, match="users table is not empty"):
        migration.upgrade()
    assert [c[0] for c in migration.op.method_calls if not c[0].startswith("get_bind")] == []


@pytest.mark.parametrize("env", ["development", "testing"])
def test_development_still_resets(migration, monkeypatch, env):
    monkeypatch.setenv("APP_ENV", env)
    migration.upgrade()
    assert _truncated(migration.op)
