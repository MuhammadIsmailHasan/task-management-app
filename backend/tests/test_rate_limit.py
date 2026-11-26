"""Rate_Limiter (Requirement 20): pure policy properties and endpoint behaviour."""
from datetime import datetime, timedelta, timezone

from hypothesis import given, strategies as st

from app import create_app
from app.common import clock
from app.common.rate_limiter import blocked_until
from app.extensions import db
from conftest import TEST_PASSWORD
from helpers import PROP

NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)
WINDOW = timedelta(seconds=100)


@PROP
@given(ages=st.lists(st.integers(0, 300), max_size=20), limit=st.integers(1, 8))
def test_property_44_rate_limit_window(ages, limit):
    times = [NOW - timedelta(seconds=a) for a in ages]
    live = [t for t in times if t > NOW - WINDOW]
    wait = blocked_until(times, NOW, WINDOW, limit)
    assert (wait is None) == (len(live) < limit)
    if wait is not None:
        assert wait >= 1
        # at that moment the pair is free again, one second earlier it is not
        assert blocked_until(times, NOW + timedelta(seconds=wait), WINDOW, limit) is None
        if wait > 1:
            assert blocked_until(times, NOW + timedelta(seconds=wait - 1), WINDOW, limit) is not None


def _login(client, ident, password, **kw):
    return client.post("/api/auth/login", json={"identifier": ident, "password": password}, **kw)


def test_login_blocks_after_pair_limit_and_a_correct_password_does_not_unblock(make_user, tmp_path):
    app = create_app({"TESTING": True, "UPLOAD_DIR": str(tmp_path), "RATE_LIMIT_LOGIN_PAIR_MAX": 3, "RATE_LIMIT_LOGIN_IP_MAX": 50})
    with app.app_context():
        db.create_all()
        client = app.test_client()
        user = make_user("member", "limited")
        for _ in range(3):
            assert _login(client, "limited", "wrong-pass").status_code == 401
        blocked = _login(client, "LIMITED", TEST_PASSWORD)
        assert blocked.status_code == 429
        body = blocked.get_json()
        retry = body["error"]["details"]["retry_after"]
        assert body["error"]["code"] == "RATE_LIMITED" and retry >= 1 and blocked.headers["Retry-After"] == str(retry)
        assert _login(client, "other_user", "x" * 8).status_code == 401  # another pair is independent
        assert _login(client, "not valid", "x").status_code == 400  # 400 counts nothing
        db.drop_all()


def test_success_resets_pair_and_window_expiry_frees_it(make_user, tmp_path):
    app = create_app({"TESTING": True, "UPLOAD_DIR": str(tmp_path), "RATE_LIMIT_LOGIN_PAIR_MAX": 2})
    with app.app_context():
        db.create_all()
        client = app.test_client()
        make_user("member", "resetme")
        assert _login(client, "resetme", "wrong-pass").status_code == 401
        assert _login(client, "resetme", TEST_PASSWORD).status_code == 200  # reset
        assert _login(client, "resetme", "wrong-pass").status_code == 401
        assert _login(client, "resetme", "wrong-pass").status_code == 401
        assert _login(client, "resetme", "wrong-pass").status_code == 429
        clock.set_now(lambda: datetime.now(timezone.utc) + timedelta(seconds=app.config["RATE_LIMIT_WINDOW_SECONDS"] + 1))
        try:
            assert _login(client, "resetme", TEST_PASSWORD).status_code == 200
        finally:
            clock.set_now(None)
        db.drop_all()


def test_ip_limit_availability_limit_and_register_never_limited(tmp_path):
    app = create_app(
        {"TESTING": True, "UPLOAD_DIR": str(tmp_path), "RATE_LIMIT_LOGIN_IP_MAX": 2, "RATE_LIMIT_AVAILABILITY_MAX": 2}
    )
    with app.app_context():
        db.create_all()
        client = app.test_client()
        assert _login(client, "aaa", "x" * 8).status_code == 401
        assert _login(client, "bbb", "x" * 8).status_code == 401
        assert _login(client, "ccc", "x" * 8).status_code == 429  # same address, new identifier
        assert client.get("/api/auth/availability?username=abc").status_code == 200
        assert client.get("/api/auth/availability?username=abd").status_code == 200
        third = client.get("/api/auth/availability?username=abe")
        assert third.status_code == 429 and "Retry-After" in third.headers
        for i in range(5):
            r = client.post("/api/auth/register", json={"full_name": "A", "username": f"user{i}", "email": f"u{i}@x.com", "password": TEST_PASSWORD})
            assert r.status_code == 201
        db.drop_all()


def test_profile_and_change_password(app, client, make_user, auth):
    user = make_user("member", "prof")
    h = auth(user)
    assert client.get("/api/auth/me").status_code == 401
    me = client.get("/api/auth/me", headers=h).get_json()["data"]
    assert me["username"] == "prof" and me["email"] == "prof@example.com"
    ok = client.patch("/api/auth/me", headers=h, json={"full_name": "  New Name "})
    assert ok.status_code == 200 and ok.get_json()["data"]["full_name"] == "New Name"
    for body in ({"full_name": "x", "is_active": False}, {"full_name": "x", "role": "admin"}, {"full_name": "x", "pending_email": "a@b.com"}, {"full_name": "x", "avatar_url": "https://x.y"}, {"full_name": " "}, {}):
        assert client.patch("/api/auth/me", headers=h, json=body).status_code == 400
    assert client.post("/api/auth/change-password", headers=h, json={"current_password": "wrong-one", "new_password": "newpassw0rd"}).get_json()["error"]["details"].keys() == {"current_password"}
    assert client.post("/api/auth/change-password", headers=h, json={"current_password": TEST_PASSWORD, "new_password": "short"}).status_code == 400
    done = client.post("/api/auth/change-password", headers=h, json={"current_password": TEST_PASSWORD, "new_password": "newpassw0rd"})
    assert done.status_code == 200 and done.get_json()["message"] == "Password changed"
    assert client.post("/api/auth/login", json={"identifier": "prof", "password": "newpassw0rd"}).status_code == 200
    assert client.get("/api/auth/me", headers=h).status_code == 200  # the issued Token stays valid
    from app.models import ActivityLog

    actions = {a.action for a in ActivityLog.query.all()}
    assert {"user.profile_updated", "user.password_changed"} <= actions
    assert "pass" not in str([a.metadata_ for a in ActivityLog.query.all()]).lower()


def test_change_password_limiter_keeps_the_session(make_user, auth, tmp_path):
    app = create_app({"TESTING": True, "UPLOAD_DIR": str(tmp_path), "RATE_LIMIT_CHANGE_PASSWORD_MAX": 2})
    with app.app_context():
        db.create_all()
        client = app.test_client()
        h = auth(make_user("member", "chpw"))
        bad = {"current_password": "wrong-one", "new_password": "newpassw0rd"}
        assert client.post("/api/auth/change-password", headers=h, json=bad).status_code == 400
        assert client.post("/api/auth/change-password", headers=h, json=bad).status_code == 400
        blocked = client.post("/api/auth/change-password", headers=h, json={"current_password": TEST_PASSWORD, "new_password": "newpassw0rd"})
        assert blocked.status_code == 429 and blocked.get_json()["error"]["details"]["retry_after"] >= 1
        assert client.get("/api/auth/me", headers=h).status_code == 200
        db.drop_all()
