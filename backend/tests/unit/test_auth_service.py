from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.blueprints.auth import service
from app.common.errors import AccountDisabled, AccountNotActivated, Conflict, NotFound, Unauthorized, ValidationError

PASSWORD = "correct-horse-battery"


def user(**over):
    base = dict(id="u1", role="member", username="ann", email="ann@example.com", is_active=True, email_verified_at=datetime.now(timezone.utc), password_hash=service._hasher.hash(PASSWORD))
    return SimpleNamespace(**{**base, **over})


@pytest.fixture
def fakes(monkeypatch):
    calls = SimpleNamespace(failures=[], resets=[], checks=[], users={})
    monkeypatch.setattr(service.repo, "get_by_username", lambda v: calls.users.get(v))
    monkeypatch.setattr(service.repo, "get_by_email", lambda v: next((u for u in calls.users.values() if u.email == v), None))
    monkeypatch.setattr(service.rate_limiter, "check_login", lambda v, ip: calls.checks.append((v, ip)))
    monkeypatch.setattr(service.rate_limiter, "record_login_failure", lambda v, ip: calls.failures.append((v, ip)))
    monkeypatch.setattr(service.rate_limiter, "reset_pair", lambda v, ip: calls.resets.append((v, ip)))
    monkeypatch.setattr(service, "issue_token", lambda uid, role: f"token-{uid}-{role}")
    monkeypatch.setattr(service, "serialize_user", lambda u: {"id": u.id, "username": u.username})
    return calls


def login(identifier, password=PASSWORD):
    return service.login({"identifier": identifier, "password": password}, "10.0.0.1")


def test_login_returns_the_user_and_a_token_and_clears_the_failures(fakes):
    fakes.users["ann"] = user()
    result = login("  ANN ")
    assert result == {"user": {"id": "u1", "username": "ann"}, "token": "token-u1-member"}
    assert fakes.checks == [("ann", "10.0.0.1")] and fakes.resets == [("ann", "10.0.0.1")] and fakes.failures == []


def test_login_by_email_is_case_insensitive(fakes):
    fakes.users["ann"] = user()
    assert login("Ann@Example.COM")["token"] == "token-u1-member"


def test_unknown_user_and_wrong_password_fail_the_same_way_and_count_a_failure(fakes):
    fakes.users["ann"] = user()
    with pytest.raises(Unauthorized) as unknown:
        login("nobody")
    with pytest.raises(Unauthorized) as wrong:
        login("ann", "wrong-password")
    assert str(unknown.value) == str(wrong.value) == "Invalid credentials"
    assert len(fakes.failures) == 2 and fakes.resets == []


def test_a_disabled_or_unconfirmed_account_is_refused_only_after_the_right_password(fakes):
    fakes.users["off"] = user(username="off", email="off@example.com", is_active=False)
    fakes.users["new"] = user(username="new", email="new@example.com", email_verified_at=None)
    with pytest.raises(AccountDisabled):
        login("off")
    with pytest.raises(AccountNotActivated):
        login("new")
    with pytest.raises(Unauthorized):
        login("new", "wrong-password")
    assert fakes.resets == []


def test_an_identifier_that_is_neither_username_nor_email_is_a_validation_error(fakes):
    with pytest.raises(ValidationError):
        login("not a valid name!")
    assert fakes.checks == []


def test_register_creates_an_unverified_member_mails_a_link_and_gives_no_token(monkeypatch):
    sent, made = [], []
    monkeypatch.setattr(service, "create_account", lambda *a: made.append(a) or user(email_verified_at=None))
    monkeypatch.setattr(service.email_tokens, "create", lambda u, purpose: f"raw-{purpose}")
    monkeypatch.setattr(service.db.session, "commit", lambda: None)
    monkeypatch.setattr(service.mail, "verification_email", lambda u, raw: ("mail", u.email, raw))
    monkeypatch.setattr(service.mail, "send", lambda m: sent.append(m))
    monkeypatch.setattr(service, "serialize_user", lambda u: {"id": u.id})
    result = service.register({"full_name": "Ann", "username": "ann", "email": "ann@example.com", "password": PASSWORD})
    assert result == {"user": {"id": "u1"}, "token": None}
    assert made[0][-1] == "member"
    assert sent == [("mail", "ann@example.com", "raw-verify_email")]


@pytest.fixture
def me(monkeypatch, session):
    calls = SimpleNamespace(sent=[], invalidated=[], created=[], hits=[])
    current = user(full_name="Ann", pending_email=None, is_available=True)
    monkeypatch.setattr(service.repo, "get_by_id", lambda uid: current)
    monkeypatch.setattr(service.repo, "get_by_username", lambda v: None)
    monkeypatch.setattr(service.repo, "get_by_email", lambda v: None)
    monkeypatch.setattr(service.email_tokens, "invalidate", lambda uid, purpose: calls.invalidated.append(purpose))
    monkeypatch.setattr(service.email_tokens, "create", lambda u, purpose: calls.created.append(purpose) or f"raw-{purpose}")
    monkeypatch.setattr(service.mail, "send", lambda m: calls.sent.append(m))
    monkeypatch.setattr(service.mail, "change_email_email", lambda u, raw: ("change", raw))
    monkeypatch.setattr(service.mail, "verification_email", lambda u, raw: ("verify", raw))
    monkeypatch.setattr(service.mail, "password_changed_email", lambda u, when: ("password", when))
    monkeypatch.setattr(service.rate_limiter, "hit_resend", lambda *a: calls.hits.append(a))
    monkeypatch.setattr(service.rate_limiter, "hit_availability", lambda ip: calls.hits.append(ip))
    monkeypatch.setattr(service, "serialize_user", lambda u: {"id": u.id})
    monkeypatch.setattr(service.activity, "add", lambda *a: None)
    session.scalar.return_value = 0
    calls.user = current
    return calls


ACTOR = SimpleNamespace(id="00000000-0000-0000-0000-000000000001", role="member")


def test_duplicate_details_name_each_taken_field(monkeypatch):
    taken = user(id="other")
    monkeypatch.setattr(service.repo, "get_by_username", lambda v: taken)
    monkeypatch.setattr(service.repo, "get_by_email", lambda v: taken)
    assert service.duplicate_details("ann", "ann@example.com") == {"username": ["username is already taken"], "email": ["email is already registered"]}
    assert service.duplicate_details("ann", "ann@example.com", exclude_id="other") == {}


def test_create_account_refuses_a_duplicate(monkeypatch):
    monkeypatch.setattr(service, "duplicate_details", lambda *a, **k: {"username": ["taken"]})
    with pytest.raises(Conflict):
        service.create_account("Ann", "ann", "ann@example.com", PASSWORD)


def test_availability(me):
    assert service.availability("ANN", "ann@example.com", "1.1.1.1") == {"username": {"available": True}, "email": {"available": True}}
    with pytest.raises(ValidationError):
        service.availability()
    with pytest.raises(ValidationError) as err:
        service.availability("a b", "not-an-email")
    assert set(err.value.details) == {"username", "email"}


def test_get_me_and_update_profile(me, monkeypatch):
    assert service.get_me(ACTOR) == {"id": "u1"}
    service.update_me(ACTOR, {"full_name": "Ann Lee", "username": "Ann.Lee", "is_available": False})
    assert (me.user.full_name, me.user.username, me.user.is_available) == ("Ann Lee", "ann.lee", False)
    monkeypatch.setattr(service.repo, "get_by_username", lambda v: user(id="other"))
    with pytest.raises(Conflict):
        service.update_me(ACTOR, {"username": "taken"})
    monkeypatch.setattr(service.repo, "get_by_id", lambda uid: None)
    with pytest.raises(NotFound):
        service.get_me(ACTOR)


def test_email_change_is_a_request_until_confirmed(me, session):
    service.update_me(ACTOR, {"email": " New@Example.com "})
    assert me.user.pending_email == "new@example.com" and me.user.email == "ann@example.com"
    assert me.sent == [("change", "raw-change_email")]
    service.update_me(ACTOR, {"email": "ann@example.com"})
    assert me.user.pending_email is None
    session.scalar.return_value = 1
    with pytest.raises(Conflict):
        service.update_me(ACTOR, {"email": "pending@example.com"})


def test_resend_and_cancel_email_change(me):
    with pytest.raises(NotFound):
        service.resend_email_change(ACTOR)
    me.user.pending_email = "new@example.com"
    service.resend_email_change(ACTOR)
    assert me.sent[-1] == ("change", "raw-change_email") and me.hits
    service.cancel_email_change(ACTOR)
    assert me.user.pending_email is None and me.invalidated[-1] == "change_email"


def test_verify_confirms_the_account_or_the_new_address(me, monkeypatch):
    token = SimpleNamespace(user_id="u1", purpose="verify_email")
    monkeypatch.setattr(service.email_tokens, "consume", lambda raw: token)
    me.user.email_verified_at = None
    assert service.verify({"token": "t"}) == {"purpose": "verify_email"} and me.user.email_verified_at is not None
    token.purpose = "change_email"
    with pytest.raises(Conflict):
        service.verify({"token": "t"})
    me.user.pending_email = "new@example.com"
    service.verify({"token": "t"})
    assert (me.user.email, me.user.pending_email) == ("new@example.com", None)
    me.user.pending_email = "taken@example.com"
    monkeypatch.setattr(service.repo, "get_by_email", lambda v: user(id="other"))
    with pytest.raises(Conflict):
        service.verify({"token": "t"})
    monkeypatch.setattr(service.repo, "get_by_id", lambda uid: None)
    with pytest.raises(NotFound):
        service.verify({"token": "t"})


def test_resend_verification_always_answers_the_same(me, monkeypatch):
    assert service.resend_verification("nobody@example.com") == {"message": service.RESEND_MESSAGE}
    assert me.sent == []
    monkeypatch.setattr(service.repo, "get_by_email", lambda v: user(email_verified_at=None))
    assert service.resend_verification("Ann@Example.com", "1.1.1.1") == {"message": service.RESEND_MESSAGE}
    assert me.sent == [("verify", "raw-verify_email")]


def test_change_password(me, monkeypatch):
    failures, resets = [], []
    monkeypatch.setattr(service.rate_limiter, "check_change_password", lambda uid: None)
    monkeypatch.setattr(service.rate_limiter, "record_change_password_failure", lambda uid: failures.append(uid))
    monkeypatch.setattr(service.rate_limiter, "reset_change_password", lambda uid: resets.append(uid))
    with pytest.raises(ValidationError):
        service.change_password(ACTOR, {"current_password": "wrong", "new_password": "new-password-1"})
    assert failures == ["u1"]
    service.change_password(ACTOR, {"current_password": PASSWORD, "new_password": "new-password-1"})
    assert service._hasher.verify(me.user.password_hash, "new-password-1") and resets == ["u1"] and me.sent[-1][0] == "password"


def test_user_serializers_hide_what_each_reader_must_not_see(ctx):
    from app.blueprints.auth import dto

    u = SimpleNamespace(id="u1", full_name="Ann", username="ann", email="a@x.co", avatar_path="a.png", is_active=True, is_available=True, pending_email="b@x.co", role="member", email_verified_at=None)
    assert dto.serialize_user(u)["pending_email"] == "b@x.co" and dto.serialize_user(u)["avatar_url"].startswith("/api/users/u1/avatar")
    admin = dto.serialize_user_admin(u)
    assert admin["role"] == "member" and "pending_email" not in admin
    assert admin["email_verified"] is False and "email_verified" not in dto.serialize_user(u)
    u.email_verified_at = "2026-11-28T00:00:00+00:00"
    assert dto.serialize_user_admin(u)["email_verified"] is True
    assert "email" not in dto.serialize_member(u) and dto.serialize_candidate(u)["email"] == "a@x.co"
    u.avatar_path = None
    assert dto.serialize_member(u)["avatar_url"] is None
