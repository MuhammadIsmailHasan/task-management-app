"""Unit tests of the Rate_Limiter store and the due-date job, with their sessions faked (no database)."""
import threading
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.common import clock
from app.common import rate_limiter as rl
from app.jobs import due
from tests.unit.support import new_id

NOW = datetime(2026, 11, 27, 9, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def fixed_clock():
    clock.set_now(lambda: NOW)
    yield
    clock.set_now(None)


class FakeSession:
    """Answers `_times` with the stored attempt times; records adds, deletes, and commits."""

    def __init__(self, times=(), dialect="sqlite"):
        self.times, self.added, self.executed, self.commits, self.rollbacks = list(times), [], [], 0, 0
        self.dialect = dialect

    def execute(self, statement, params=None):
        self.executed.append(statement)
        return SimpleNamespace(scalars=lambda: iter(self.times), scalar=lambda: len(self.times))

    def add(self, row):
        self.added.append(row)

    def get_bind(self):
        return SimpleNamespace(dialect=SimpleNamespace(name=self.dialect))

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def remove(self):  # the app context's teardown ends the scoped session
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


@pytest.fixture
def limits(ctx, monkeypatch):
    ctx.config.update(RATE_LIMIT_WINDOW_SECONDS=900, RATE_LIMIT_LOGIN_PAIR_MAX=2, RATE_LIMIT_LOGIN_IP_MAX=5, RATE_LIMIT_AVAILABILITY_MAX=2, RATE_LIMIT_CHANGE_PASSWORD_MAX=2, RATE_LIMIT_RESEND_VERIFICATION_MAX=1)
    store = SimpleNamespace(request=FakeSession(), short=FakeSession())
    monkeypatch.setattr(rl.db, "session", store.request)
    monkeypatch.setattr(rl, "Session", lambda engine: store.short)
    monkeypatch.setattr(type(rl.db), "engine", property(lambda self: None))
    return store


def recent(n):
    return [NOW - timedelta(minutes=1)] * n


def test_keys_are_keyed_hashes_that_never_hold_the_identifier(limits):
    pair = rl.pair_key(" Ann ", "1.1.1.1")
    assert pair == rl.pair_key("ann", "1.1.1.1") and "ann" not in pair and len(pair) == 64
    assert rl.ip_key("login_ip", None) == rl.key_hash("login_ip", "") and rl.user_key("u1") != rl.user_key("u2")


def test_naive_times_are_read_as_utc(limits):
    assert rl._aware(datetime(2026, 1, 1)).tzinfo is not None
    limits.request.times = [t.replace(tzinfo=None) for t in recent(2)]
    assert rl._wait(limits.request, "login_pair", "k", 2) > 0


def test_login_is_blocked_after_the_limit_and_failures_are_committed_apart(limits):
    rl.check_login("ann", "1.1.1.1")
    limits.request.times = recent(2)
    with pytest.raises(rl.RateLimited) as err:
        rl.check_login("ann", "1.1.1.1")
    assert err.value.retry_after == 14 * 60 and err.value.details == {"retry_after": 840}
    rl.record_login_failure("ann", "1.1.1.1")
    assert [r.scope for r in limits.short.added] == ["login_pair", "login_ip"] and limits.short.commits == 1
    rl.reset_pair("ann", "1.1.1.1")
    assert limits.request.commits == 1


def test_postgres_takes_an_advisory_lock_per_key():
    session = FakeSession(dialect="postgresql")
    rl._lock(session, "login_ip", "k")
    assert "pg_advisory_xact_lock" in str(session.executed[0])
    sqlite = FakeSession()
    rl._lock(sqlite, "login_ip", "k")
    assert sqlite.executed == []


def test_availability_counts_every_call_until_blocked(limits):
    rl.hit_availability("1.1.1.1")
    assert len(limits.short.added) == 1 and limits.short.commits == 1
    limits.short.times = recent(2)
    with pytest.raises(rl.RateLimited):
        rl.hit_availability("1.1.1.1")
    assert limits.short.rollbacks == 1 and len(limits.short.added) == 1  # a blocked call adds no row


def test_change_password_bucket(limits):
    rl.check_change_password("u1")
    rl.record_change_password_failure("u1")
    assert limits.short.added[0].scope == "change_password"
    limits.request.times = recent(2)
    with pytest.raises(rl.RateLimited):
        rl.check_change_password("u1")
    rl.reset_change_password("u1")
    assert len(limits.request.executed) >= 2


def test_resend_uses_an_address_and_a_client_bucket(limits):
    rl.hit_resend("a@x.co", "1.1.1.1")
    assert [r.scope for r in limits.short.added] == ["resend_verification", "resend_verification_ip"]
    rl.hit_resend("u1", None)
    assert limits.short.added[-1].scope == "resend_verification"
    limits.short.times = recent(1)
    with pytest.raises(rl.RateLimited):
        rl.hit_resend("a@x.co", None)


def test_count(limits):
    limits.request.times = recent(3)
    assert rl.count("login_ip") == 3


# ---- the due-date job ----------------------------------------------------------------------------------------------

@pytest.fixture
def job(ctx, session, monkeypatch):
    found = {"due_today": [], "due_tomorrow": []}
    monkeypatch.setattr(due, "_candidates", lambda day, type_: found[type_])
    session.execute.return_value = SimpleNamespace(rowcount=1)
    return SimpleNamespace(found=found, session=session)


def candidate():
    return SimpleNamespace(id=new_id(), assignee_id=new_id(), board_id=new_id())


def test_run_creates_today_and_tomorrow_and_counts_skips(job):
    job.found["due_today"] = [candidate(), candidate()]
    job.found["due_tomorrow"] = [candidate()]
    assert due.run(NOW) == (1, 1, 1)  # one insert per type, each reporting one new row
    job.session.commit.assert_called_once()
    assert due._line((1, 1, 1)) == "due_today=1 due_tomorrow=1 skipped=1" and "skipped" in due._line(None)
    assert due._create([], "due_today", NOW.date()) == 0


def test_candidates_builds_one_query_per_day(ctx, session):
    session.execute.return_value.all.return_value = ["row"]
    assert due._candidates(date(2026, 11, 27), "due_today") == ["row"]
    assert "notification_preferences" in str(session.execute.call_args.args[0])


def test_insert_dialect(ctx, monkeypatch):
    assert due._insert().__module__.startswith("sqlalchemy.dialects.sqlite")
    monkeypatch.setattr(type(due.db), "engine", property(lambda self: SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))))
    assert due._insert().__module__.startswith("sqlalchemy.dialects.postgresql")


def test_postgres_run_skips_when_another_run_holds_the_lock(job, monkeypatch):
    monkeypatch.setattr(type(due.db), "engine", property(lambda self: SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))))
    job.session.scalar.return_value = False
    assert due.run() is None
    assert "pg_advisory_unlock" in str(job.session.execute.call_args.args[0])


def test_run_forever_logs_a_failure_and_stops_on_the_event(job, monkeypatch, capsys):
    stop = threading.Event()
    results = iter([RuntimeError("db down"), (0, 0, 0)])

    def fake_run():
        value = next(results)
        if isinstance(value, Exception):
            raise value
        stop.set()
        return value

    monkeypatch.setattr(due, "run", fake_run)
    monkeypatch.setattr(stop, "wait", lambda seconds: None)
    due.run_forever(stop)
    job.session.rollback.assert_called_once()
    assert "due_today=0" in capsys.readouterr().out


def test_cli_commands(ctx, monkeypatch):
    monkeypatch.setattr(due, "run", lambda: (2, 0, 0))
    out = ctx.test_cli_runner().invoke(args=["notify-due"])
    assert "due_today=2" in out.output
    handlers, ran = {}, []
    monkeypatch.setattr(due.signal, "signal", lambda sig, fn: handlers.setdefault(sig, fn))
    monkeypatch.setattr(due, "run_forever", lambda stop: (handlers[due.signal.SIGTERM](), ran.append(stop.is_set())))
    ctx.test_cli_runner().invoke(args=["run-scheduler"])
    assert ran == [True]  # SIGTERM sets the stop event
