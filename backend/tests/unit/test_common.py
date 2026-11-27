import uuid
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import marshmallow as ma
import pytest

from app.common import auth, clock, email_tokens, errors, file_store, http, identities, ids, images, mail, responses, rich_text, signing, slug
from app.common.fields import BaseSchema, Email, Text, Username

NOW = datetime(2026, 11, 27, 9, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def fixed_clock():
    clock.set_now(lambda: NOW)
    yield
    clock.set_now(None)


def test_clock_override_and_time_zone():
    assert clock.now() == NOW and clock.today("Asia/Jakarta") == date(2026, 11, 27)
    clock.set_now(None)
    assert clock.now().tzinfo is not None


def test_to_uuid():
    u = uuid.uuid4()
    assert ids.to_uuid(u) is u and ids.to_uuid(str(u)) == u
    assert ids.to_uuid("nope") is None and ids.to_uuid(None) is None


def test_detect_image_type_reads_the_leading_bytes():
    assert images.detect_image_type(b"\x89PNG\r\n\x1a\n...") == "png"
    assert images.detect_image_type(b"\xff\xd8\xff\xe0") == "jpg"
    assert images.detect_image_type(b"RIFF\x00\x00\x00\x00WEBP") == "webp"
    assert images.detect_image_type(b"GIF89a") is None


def test_envelopes():
    assert responses.ok() == {"status": True, "message": "OK", "data": None}
    assert responses.ok({"a": 1}, "Saved") == {"status": True, "message": "Saved", "data": {"a": 1}}
    assert errors.error_body("X", "bad") == {"status": False, "message": "bad", "error": {"code": "X"}}
    assert errors.error_body("X", "bad", {"f": ["e"]})["error"]["details"] == {"f": ["e"]}


def test_http_helpers(ctx):
    assert http.parse_date(None, "d") is None and http.parse_date("2026-01-02", "d") == date(2026, 1, 2)
    with pytest.raises(errors.ValidationError):
        http.parse_date("02/01/2026", "d")
    assert http.iso(None) is None and http.iso(date(2026, 1, 2)) == "2026-01-02"
    with ctx.test_request_context(json={"a": 1}):
        assert http.json_body() == {"a": 1}
    with ctx.test_request_context(data="not json", content_type="text/plain"):
        assert http.json_body() == {}
    with ctx.test_request_context(json=[1, 2]):
        with pytest.raises(errors.ValidationError):
            http.json_body()


def test_is_valid_slug():
    assert slug.is_valid_slug("q3-launch-plan")
    for bad in ("", "Q3", "a--b", "-a", "a" * 301, "a b"):
        assert not slug.is_valid_slug(bad)


def test_from_plain_text():
    assert rich_text.from_plain_text(None) is None and rich_text.from_plain_text("  ") is None
    assert rich_text.from_plain_text(" a < b\nc ") == "<p>a &lt; b<br>c</p>"
    assert rich_text.to_text(None) == ""


def test_file_signatures(ctx):
    path, exp = signing.sign_file_url("a1", NOW)
    sig = path.split("sig=")[1]
    assert path.startswith("/api/attachments/a1/file") and exp == int(NOW.timestamp()) + signing.TTL_SECONDS
    assert signing.verify_file_signature("a1", exp, sig, NOW)
    assert not signing.verify_file_signature("a1", exp, sig, NOW + timedelta(seconds=signing.TTL_SECONDS + 1))
    assert not signing.verify_file_signature("a2", exp, sig, NOW)
    assert not signing.verify_file_signature("a1", "x", sig, NOW) and not signing.verify_file_signature("a1", None, sig, NOW)
    scope = signing.share_scope("tok")
    scoped, exp = signing.sign_file_url("a1", NOW, scope=scope)
    assert scoped.endswith(f"&st={scope}") and not signing.verify_file_signature("a1", exp, scoped.split("sig=")[1].split("&")[0], NOW)


def test_avatar_signatures_and_api_prefix(ctx):
    url = signing.avatar_url("u1", NOW)
    exp, sig = url.split("exp=")[1].split("&sig=")
    assert signing.verify_avatar_signature("u1", exp, sig, NOW)
    assert not signing.verify_file_signature("u1", exp, sig, NOW)
    ctx.config["API_PUBLIC_PREFIX"] = "/app/api/"
    assert signing.api_base() == "/app/api"


def test_api_base_without_an_app():
    assert signing.api_base() == "/api"


def test_avatar_urls(ctx):
    a, b = uuid.uuid4(), uuid.uuid4()
    out = identities.avatar_urls({a: identities.Identity("Ann", "a.png"), b: identities.Identity("Bo", None)}, NOW)
    assert out[a].startswith(f"/api/users/{a}/avatar") and out[b] is None


def test_tokens_and_current_actor(ctx, session):
    token = auth.issue_token("00000000-0000-0000-0000-000000000001", "manager")
    session.scalar.return_value = True
    with ctx.test_request_context(headers={"Authorization": f"Bearer {token}"}):
        assert auth.current_actor() == auth.Actor(id="00000000-0000-0000-0000-000000000001", role="manager")
    with ctx.test_request_context():
        assert auth.current_actor() is None
    with ctx.test_request_context(headers={"Authorization": "Bearer broken"}):
        assert auth.optional_actor() is None
    session.scalar.return_value = False
    with ctx.test_request_context(headers={"Authorization": f"Bearer {token}"}):
        with pytest.raises(errors.AccountDisabled):
            auth.current_actor()
    auth._require_active("not-a-uuid")


def test_require_role(ctx, session):
    session.scalar.return_value = True
    guarded = auth.require_role("admin")(lambda: "ok")
    with ctx.test_request_context(headers={"Authorization": f"Bearer {auth.issue_token(str(uuid.uuid4()), 'admin')}"}):
        assert guarded() == "ok"
    with ctx.test_request_context(headers={"Authorization": f"Bearer {auth.issue_token(str(uuid.uuid4()), 'member')}"}):
        with pytest.raises(errors.Forbidden):
            guarded()


def test_jwt_callbacks_answer_with_the_error_envelope(ctx):
    loaders = {}
    jwt = SimpleNamespace(**{name: (lambda n: (lambda fn: loaders.setdefault(n, fn)))(name) for name in ("unauthorized_loader", "invalid_token_loader", "expired_token_loader")})
    auth.register_jwt_callbacks(jwt)
    with ctx.test_request_context():
        for body, status in (loaders["unauthorized_loader"]("missing"), loaders["invalid_token_loader"]("bad"), loaders["expired_token_loader"]({}, {})):
            assert status == 401 and body.get_json()["error"]["code"] == "UNAUTHORIZED"


def test_email_tokens_are_stored_hashed_and_used_once(session):
    raw = email_tokens.create(SimpleNamespace(id=uuid.uuid4()), "verify_email")
    stored = session.add.call_args.args[0]
    assert stored.token_hash == email_tokens._hash(raw) != raw and stored.expires_at == NOW + email_tokens.TTL
    email_tokens.invalidate(uuid.uuid4(), "verify_email")
    session.execute.assert_called_once()
    row = SimpleNamespace(used_at=None, expires_at=(NOW + timedelta(hours=1)).replace(tzinfo=None))
    session.scalars.return_value.first.return_value = row
    assert email_tokens.consume(raw) is row and row.used_at == NOW
    with pytest.raises(errors.TokenInvalid):
        email_tokens.consume(raw)
    session.scalars.return_value.first.return_value = SimpleNamespace(used_at=None, expires_at=NOW - timedelta(seconds=1))
    with pytest.raises(errors.TokenExpired):
        email_tokens.consume(raw)
    with pytest.raises(errors.TokenInvalid):
        email_tokens.consume("")


def test_file_store_round_trip(ctx):
    store = file_store.FileStore("avatars")
    store.save("abc.png", b"data")
    with open(store.path("abc.png"), "rb") as handle:
        assert handle.read() == b"data"
    assert store.delete("abc.png") is True and store.delete("abc.png") is False
    with pytest.raises(ValueError):
        store.path("../etc/passwd")
    assert store.delete("../x") is False


class Form(BaseSchema):
    name = Text(required=True, max_length=5, min_length=2)
    note = Text(allow_blank=True, strip=False)
    username = Username()
    email = Email()


def test_text_fields_name_the_field_in_each_message():
    assert Form().load({"name": " ab ", "note": " ", "username": " Ann.Lee ", "email": " A@X.CO ", "extra": 1}) == {"name": "ab", "note": " ", "username": "ann.lee", "email": "a@x.co"}
    cases = [({}, "name is required"), ({"name": None}, "name is required"), ({"name": 3}, "name must be text"), ({"name": " "}, "name is required"), ({"name": "a"}, "at least 2"), ({"name": "abcdef"}, "at most 5")]
    for data, message in cases:
        with pytest.raises(ma.ValidationError) as err:
            Form().load(data)
        assert message in str(err.value.messages["name"])
    with pytest.raises(ma.ValidationError) as err:
        Form().load({"name": "ab", "username": "a b", "email": "nope"})
    assert set(err.value.messages) == {"username", "email"}
    assert Text(max_length=4).metadata["maxLength"] == 4


def person():
    return SimpleNamespace(id="u1", full_name="Ann", email="a@x.co", pending_email="b@x.co")


def test_messages_carry_the_link_and_never_a_password(ctx):
    ctx.config["PUBLIC_BASE_URL"] = "https://revo.example/"
    verify = mail.verification_email(person(), "tok")
    assert verify.to == "a@x.co" and "https://revo.example/app/verify?token=tok" in verify.text and verify.purpose == "verify_email"
    change = mail.change_email_email(person(), "tok")
    assert change.to == "b@x.co" and change.purpose == "change_email"
    changed = mail.password_changed_email(person(), NOW)
    assert "2026-11-27 09:00 UTC" in changed.text and changed.html.endswith("<p>RevoBoard</p>")


def test_build_has_a_text_and_an_html_part():
    mime = mail._build(mail.Message(to="a@x.co", subject="S", text="t", html="<p>h</p>"), "from@x.co")
    assert mime["From"] == "from@x.co" and mime.is_multipart()
    assert not mail._build(mail.Message(to="a@x.co", subject="S", text="t"), "f@x.co").is_multipart()


def test_transports(ctx, monkeypatch, caplog):
    mail.outbox.clear()
    msg = mail.Message(to="a@x.co", subject="S", text="body", user_id="u1", purpose="verify_email")
    mail.send(msg)
    assert mail.outbox == [msg]
    ctx.config["MAIL_BACKEND"] = "console"
    mail.send(msg)
    assert "body" in caplog.text
    smtp = MagicMock()
    monkeypatch.setattr(mail.smtplib, "SMTP", smtp)
    cfg = {"MAIL_BACKEND": "smtp", "SMTP_HOST": "h", "SMTP_PORT": "587", "SMTP_USER": "u", "SMTP_PASSWORD": "p", "MAIL_FROM": "f@x.co"}
    mail._deliver(msg, cfg)
    smtp.return_value.__enter__.return_value.send_message.assert_called_once()
    submitted = []
    monkeypatch.setattr(mail._pool, "submit", lambda *a: submitted.append(a))
    ctx.config.update(cfg)
    mail.send(msg)
    assert submitted and submitted[0][0] is mail._deliver


def test_a_failed_send_is_logged_and_retried_once(monkeypatch, caplog):
    attempts, sleeps = [], []
    monkeypatch.setattr(mail, "_send_smtp", lambda msg, cfg: attempts.append(1) or (_ for _ in ()).throw(OSError("down")))
    monkeypatch.setattr(mail.time, "sleep", lambda s: sleeps.append(s))
    mail._deliver(mail.Message(to="a@x.co", subject="S", text="t", user_id="u1", purpose="p"), {"MAIL_BACKEND": "smtp"})
    assert len(attempts) == 2 and sleeps == [mail.RETRY_AFTER_SECONDS]
    assert "a@x.co" not in caplog.text and "OSError" in caplog.text


def test_check_config():
    mail.check_config({"MAIL_BACKEND": "console"})
    with pytest.raises(RuntimeError):
        mail.check_config({"MAIL_BACKEND": "pigeon"})
    with pytest.raises(RuntimeError) as err:
        mail.check_config({"MAIL_BACKEND": "smtp", "SMTP_HOST": "h"})
    assert "SMTP_PORT" in str(err.value)
