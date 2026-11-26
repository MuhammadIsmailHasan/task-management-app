"""Requirements 54 and 59 (V17): email verification, the email-change flow, the password notice, and Property 77."""
from datetime import timedelta

from conftest import TEST_PASSWORD
from hypothesis import given, strategies as st

from app.common import clock, mail
from app.extensions import db
from app.models import EmailToken, User
from tests.helpers import PROP, hdr, last_mail_token, mkuser, reset_db, verify_email

NEW = {"full_name": "Ann", "username": "ann_1", "email": "ann@x.com", "password": TEST_PASSWORD}


def register(client, **over):
    return client.post("/api/auth/register", json={**NEW, **over})


def login(client, identifier="ann_1", password=TEST_PASSWORD):
    return client.post("/api/auth/login", json={"identifier": identifier, "password": password})


def code(r):
    return r.get_json()["error"]["code"]


# ---- register and login order (ACT-01, ACT-02) ----
def test_register_returns_no_token_and_sends_the_link(client):
    r = register(client)
    assert r.status_code == 201 and r.get_json()["data"]["token"] is None
    assert len(mail.outbox) == 1 and mail.outbox[0].to == "ann@x.com" and mail.outbox[0].subject == "Confirm your RevoBoard email"
    assert "token=" in mail.outbox[0].text and TEST_PASSWORD not in mail.outbox[0].text
    assert User.query.one().email_verified_at is None


def test_login_waits_for_the_link_and_a_wrong_password_never_says_so(client):
    register(client)
    refused = login(client)
    assert refused.status_code == 403 and code(refused) == "ACCOUNT_NOT_ACTIVATED" and "Confirm your email" in refused.get_json()["message"]
    assert login(client, password="not-it").status_code == 401  # a wrong password never reveals that the account exists or waits
    assert login(client, identifier="nobody").status_code == 401
    assert verify_email(client).status_code == 200
    assert login(client).status_code == 200


def test_the_two_refusals_leave_no_failure_row(client, app):
    from app.common import rate_limiter

    register(client)
    for _ in range(8):
        assert login(client).status_code == 403
    assert rate_limiter.count("login_pair") == 0 and rate_limiter.count("login_ip") == 0


def test_a_disabled_account_wins_over_an_unconfirmed_one(client):
    register(client)
    user = User.query.one()
    user.is_active = False
    db.session.commit()
    r = login(client)
    assert r.status_code == 403 and code(r) == "ACCOUNT_DISABLED"
    assert login(client, password="wrong").status_code == 401


# ---- verify (ACT-03, ACT-06) ----
def test_a_token_works_once_and_is_stored_only_as_a_hash(client):
    register(client)
    raw = last_mail_token()
    row = EmailToken.query.one()
    assert row.token_hash != raw and len(row.token_hash) == 64 and raw not in str(row.__dict__)
    first = client.post("/api/auth/verify", json={"token": raw})
    assert first.status_code == 200 and first.get_json()["data"] == {"purpose": "verify_email"}
    second = client.post("/api/auth/verify", json={"token": raw})
    assert second.status_code == 400 and code(second) == "TOKEN_INVALID"
    assert "token" not in first.get_json()["data"]  # verify never signs anyone in


def test_unknown_and_expired_tokens(client):
    assert code(client.post("/api/auth/verify", json={"token": "nope"})) == "TOKEN_INVALID"
    assert client.post("/api/auth/verify", json={}).status_code == 400
    register(client)
    raw = last_mail_token()
    later = clock.now() + timedelta(hours=25)
    clock.set_now(lambda: later)
    try:
        r = client.post("/api/auth/verify", json={"token": raw})
    finally:
        clock.set_now(None)
    assert r.status_code == 400 and code(r) == "TOKEN_EXPIRED"


# ---- resend (ACT-04) ----
def test_resend_always_answers_the_same_and_replaces_the_old_link(client):
    register(client)
    old = last_mail_token()
    asked = client.post("/api/auth/resend-verification", json={"email": "ann@x.com"})
    unknown = client.post("/api/auth/resend-verification", json={"email": "nobody@x.com"})
    assert asked.status_code == unknown.status_code == 200 and asked.get_json()["data"] == unknown.get_json()["data"]
    assert len(mail.outbox) == 2  # one new link for the real address, none for the unknown one
    assert code(client.post("/api/auth/verify", json={"token": old})) == "TOKEN_INVALID"
    assert verify_email(client).status_code == 200
    again = client.post("/api/auth/resend-verification", json={"email": "ann@x.com"})  # already confirmed: same answer, no mail
    assert again.status_code == 200 and len(mail.outbox) == 2


def test_resend_is_rate_limited_per_address(client):
    register(client)
    statuses = [client.post("/api/auth/resend-verification", json={"email": "ann@x.com"}) for _ in range(4)]
    assert [r.status_code for r in statuses] == [200, 200, 200, 429]
    assert statuses[-1].headers.get("Retry-After") and code(statuses[-1]) == "RATE_LIMITED"


# ---- email change (PRF-03) ----
def signed_in(client, make_user, auth):
    user = make_user("member", "chg")
    return user, auth(user)


def test_an_email_change_waits_for_its_link_and_the_old_address_stays(client, make_user, auth):
    user, h = signed_in(client, make_user, auth)
    r = client.patch("/api/auth/me", headers=h, json={"email": "New@X.com"})
    assert r.status_code == 200 and r.get_json()["data"]["email"] == "chg@example.com" and r.get_json()["data"]["pending_email"] == "new@x.com"
    assert mail.outbox[-1].to == "new@x.com" and mail.outbox[-1].subject == "Confirm your new RevoBoard email"
    assert login(client, identifier="chg@example.com").status_code == 200  # the old address still signs in
    assert login(client, identifier="new@x.com").status_code == 401
    done = verify_email(client, "new@x.com")
    assert done.get_json()["data"] == {"purpose": "change_email"}
    me = client.get("/api/auth/me", headers=h).get_json()["data"]
    assert me["email"] == "new@x.com" and me["pending_email"] is None
    assert login(client, identifier="new@x.com").status_code == 200


def test_a_second_request_replaces_the_first_and_cancel_clears_it(client, make_user, auth):
    user, h = signed_in(client, make_user, auth)
    client.patch("/api/auth/me", headers=h, json={"email": "one@x.com"})
    first = last_mail_token("one@x.com")
    client.patch("/api/auth/me", headers=h, json={"email": "two@x.com"})
    assert code(client.post("/api/auth/verify", json={"token": first})) == "TOKEN_INVALID"
    cancelled = client.delete("/api/auth/me/email/pending", headers=h)
    assert cancelled.status_code == 200 and cancelled.get_json()["data"]["pending_email"] is None
    assert code(client.post("/api/auth/verify", json={"token": last_mail_token("two@x.com")})) == "TOKEN_INVALID"
    assert client.post("/api/auth/me/email/resend", headers=h).status_code == 404


def test_resend_the_change_link_and_the_taken_address(client, make_user, auth):
    user, h = signed_in(client, make_user, auth)
    make_user("member", "other")
    taken = client.patch("/api/auth/me", headers=h, json={"email": "other@example.com"})
    assert taken.status_code == 409 and "email" in taken.get_json()["error"]["details"]
    client.patch("/api/auth/me", headers=h, json={"email": "new@x.com"})
    before = len(mail.outbox)
    assert client.post("/api/auth/me/email/resend", headers=h).status_code == 200 and len(mail.outbox) == before + 1
    # the pending address is reserved: nobody else can ask for it, and it is never in another user's payload
    other_h = auth(User.query.filter_by(username="other").one())
    assert client.patch("/api/auth/me", headers=other_h, json={"email": "new@x.com"}).status_code == 409
    assert "new@x.com" not in str(client.get("/api/auth/me", headers=other_h).get_json())


def test_pending_email_is_never_in_the_admin_listing(client, make_user, auth):
    user, h = signed_in(client, make_user, auth)
    client.patch("/api/auth/me", headers=h, json={"email": "new@x.com"})
    admin = auth(make_user("admin", "boss"))
    assert "pending_email" not in str(client.get("/api/users", headers=admin).get_json())


def test_profile_fields_and_their_rules(client, make_user, auth):
    user, h = signed_in(client, make_user, auth)
    make_user("member", "taken")
    assert client.patch("/api/auth/me", headers=h, json={"username": "Taken"}).status_code == 409
    ok = client.patch("/api/auth/me", headers=h, json={"username": "Brand_New", "is_available": False})
    assert ok.status_code == 200 and ok.get_json()["data"]["username"] == "brand_new" and ok.get_json()["data"]["is_available"] is False
    assert login(client, identifier="brand_new", password="x").status_code == 401  # the new name signs in at once (right account, wrong password here)
    same = client.patch("/api/auth/me", headers=h, json={"username": "brand_new"})  # keeping the name is fine
    assert same.status_code == 200
    for body in ({"role": "admin"}, {"is_active": False}, {"pending_email": "a@b.com"}, {"email_verified_at": "2026-01-01"}, {}):
        assert client.patch("/api/auth/me", headers=h, json=body).status_code == 400, body


# ---- password change notice (PRF-05, ACT-09) ----
def test_changing_the_password_needs_the_current_one_and_mails_a_notice(client, make_user, auth):
    user, h = signed_in(client, make_user, auth)
    assert client.post("/api/auth/change-password", headers=h, json={"new_password": "newpassw0rd"}).status_code == 400
    assert client.post("/api/auth/change-password", headers=h, json={"current_password": "wrong-one", "new_password": "newpassw0rd"}).status_code == 400
    assert not mail.outbox
    ok = client.post("/api/auth/change-password", headers=h, json={"current_password": TEST_PASSWORD, "new_password": "newpassw0rd"})
    assert ok.status_code == 200
    assert mail.outbox[-1].subject == "Your RevoBoard password was changed" and mail.outbox[-1].to == "chg@example.com"
    assert "newpassw0rd" not in mail.outbox[-1].text and TEST_PASSWORD not in mail.outbox[-1].text


# ---- mail (ACT-08, ACT-09) ----
def test_a_failed_send_never_fails_the_request(client, monkeypatch):
    def boom(*a, **k):
        raise OSError("smtp down")

    monkeypatch.setattr(mail, "_deliver", boom)
    # `send` hands the message on; the memory path is inline, so the failure would surface here if it were not contained
    app = client.application
    app.config["MAIL_BACKEND"] = "smtp"
    app.config.update(SMTP_HOST="h", SMTP_USER="u", SMTP_PASSWORD="p", MAIL_FROM="f@x.com")
    try:
        assert register(client).status_code == 201  # the account exists even though the mail cannot go
    finally:
        app.config["MAIL_BACKEND"] = "memory"


def test_smtp_needs_all_five_settings_at_start_up():
    import pytest

    with pytest.raises(RuntimeError, match="SMTP_HOST"):
        mail.check_config({"MAIL_BACKEND": "smtp", "SMTP_HOST": "", "SMTP_PORT": "587", "SMTP_USER": "u", "SMTP_PASSWORD": "p", "MAIL_FROM": "f@x.com"})
    mail.check_config({"MAIL_BACKEND": "console"})
    with pytest.raises(RuntimeError):
        mail.check_config({"MAIL_BACKEND": "pigeon"})


def test_the_console_backend_logs_the_message_and_no_credential(client, caplog):
    import logging

    app = client.application
    app.config.update(MAIL_BACKEND="console", SMTP_PASSWORD="hunter2-secret")
    with caplog.at_level(logging.INFO, logger="revoboard.mail"):
        register(client)
    app.config["MAIL_BACKEND"] = "memory"
    assert "Confirm your RevoBoard email" in caplog.text and "hunter2-secret" not in caplog.text


def test_links_use_the_public_base_url(client):
    client.application.config["PUBLIC_BASE_URL"] = "https://revoboard.example"
    register(client)
    assert "https://revoboard.example/app/verify?token=" in mail.outbox[0].text


@PROP
@given(st.lists(st.sampled_from(["login", "register", "resend", "bad_verify", "forged_request", "login_wrong"]), min_size=1, max_size=10))
def test_property_77_no_token_without_activation(client, ops):
    """No sequence of register, login, resend, and invalid verifies yields a Token or opens a protected route."""
    reset_db()
    mail.outbox.clear()
    register(client)
    for op in ops:
        if op == "login":
            r = login(client)
            assert r.status_code in (403, 429)  # 429 once wrong passwords piled up; either way no Token
            assert r.status_code == 429 or code(r) == "ACCOUNT_NOT_ACTIVATED"
            assert "token" not in str(r.get_json().get("data"))
        elif op == "login_wrong":
            r = login(client, password="wrong")
            assert r.status_code in (401, 429) and (r.status_code == 429 or code(r) == "UNAUTHORIZED")  # never ACCOUNT_NOT_ACTIVATED
        elif op == "register":
            assert register(client).status_code == 409
        elif op == "resend":
            assert client.post("/api/auth/resend-verification", json={"email": "ann@x.com"}).status_code in (200, 429)
        elif op == "bad_verify":
            assert client.post("/api/auth/verify", json={"token": "x" * 43}).status_code == 400
        else:
            assert client.get("/api/boards", headers={"Authorization": "Bearer forged.token.value"}).status_code == 401
    assert User.query.one().email_verified_at is None
