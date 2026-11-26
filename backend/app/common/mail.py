"""Outgoing mail (V17, Requirement 59): one small module with two transports, `smtp` (Gmail) and `console`.

Mail is sent after the database commit and never inside the transaction. A failed send is logged (user id, purpose,
error class: no address, no token) and does not fail the request; it is retried once after 5 seconds.
"""
import logging
import smtplib
import ssl
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from email.message import EmailMessage

from flask import current_app

log = logging.getLogger("revoboard.mail")

RETRY_AFTER_SECONDS = 5
SMTP_VARS = ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM")

# Tests read what was "sent" here; the console transport never touches it.
outbox = []
_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="mail")
_lock = threading.Lock()


@dataclass(frozen=True)
class Message:
    to: str
    subject: str
    text: str
    html: str | None = None
    # for the log only: who and why, never the address or a link
    user_id: str | None = None
    purpose: str | None = None


def link(path_and_query):
    """An absolute link to the app, from PUBLIC_BASE_URL (`https://host` + `/app/verify?token=...`)."""
    base = (current_app.config.get("PUBLIC_BASE_URL") or "").rstrip("/")
    return f"{base}{path_and_query}"


def _build(msg, sender):
    mime = EmailMessage()
    mime["Subject"] = msg.subject
    mime["From"] = sender
    mime["To"] = msg.to
    mime.set_content(msg.text)
    if msg.html:
        mime.add_alternative(msg.html, subtype="html")
    return mime


def _send_smtp(msg, cfg):
    mime = _build(msg, cfg["MAIL_FROM"])
    with smtplib.SMTP(cfg["SMTP_HOST"], int(cfg["SMTP_PORT"]), timeout=15) as server:
        server.starttls(context=ssl.create_default_context())
        server.login(cfg["SMTP_USER"], cfg["SMTP_PASSWORD"])
        server.send_message(mime)


def _deliver(msg, cfg, retry=True):
    try:
        if cfg["MAIL_BACKEND"] == "smtp":
            _send_smtp(msg, cfg)
        elif cfg["MAIL_BACKEND"] == "memory":
            with _lock:
                outbox.append(msg)
        else:  # console: the body goes to the log (at WARNING so it shows with the default settings), never the SMTP credentials
            log.warning("mail to %s | %s\n%s", msg.to, msg.subject, msg.text)
    except Exception as exc:  # a failed send must never fail the request
        log.error("mail failed: purpose=%s user=%s error=%s", msg.purpose, msg.user_id, type(exc).__name__)
        if retry:
            time.sleep(RETRY_AFTER_SECONDS)
            _deliver(msg, cfg, retry=False)


def send(msg):
    """Hand a message to the transport. Call it after `db.session.commit()`.

    The memory transport (tests) and the console transport run inline so the result is deterministic; SMTP runs on a
    small bounded pool so the request does not wait for it.
    """
    cfg = {k: current_app.config.get(k) for k in ("MAIL_BACKEND", *SMTP_VARS)}
    if cfg["MAIL_BACKEND"] == "smtp":
        _pool.submit(_deliver, msg, cfg)
    else:
        _deliver(msg, cfg, retry=False)


def check_config(config):
    """Stop the app at start-up with a clear message when SMTP is chosen and a setting is missing (ACT-08)."""
    if config["MAIL_BACKEND"] not in ("smtp", "console", "memory"):
        raise RuntimeError("MAIL_BACKEND must be smtp or console")
    if config["MAIL_BACKEND"] == "smtp":
        missing = [k for k in SMTP_VARS if not str(config.get(k) or "").strip()]
        if missing:
            raise RuntimeError(f"MAIL_BACKEND=smtp needs: {', '.join(missing)}")


# ---- the three messages (ACT-09): plain text with a simple HTML part, the product name, no password ----

def _html(body):
    return f"<p>{body}</p><p>RevoBoard</p>"


def verification_email(user, token):
    url = link(f"/app/verify?token={token}")
    text = f"Hello {user.full_name},\n\nConfirm your email address to start using RevoBoard:\n{url}\n\nThe link works once and expires in 24 hours. If you did not register, ignore this message.\n\nRevoBoard"
    return Message(to=user.email, subject="Confirm your RevoBoard email", text=text, html=_html(f'Confirm your email address to start using RevoBoard: <a href="{url}">Confirm email</a>. The link works once and expires in 24 hours.'), user_id=str(user.id), purpose="verify_email")


def change_email_email(user, token):
    url = link(f"/app/verify?token={token}")
    text = f"Hello {user.full_name},\n\nConfirm this new email address for your RevoBoard account:\n{url}\n\nThe link works once and expires in 24 hours. Until then your old address stays in use. If you did not ask for this, ignore this message.\n\nRevoBoard"
    return Message(to=user.pending_email, subject="Confirm your new RevoBoard email", text=text, html=_html(f'Confirm this new email address: <a href="{url}">Confirm email</a>. The link works once and expires in 24 hours.'), user_id=str(user.id), purpose="change_email")


def password_changed_email(user, when):
    stamp = when.strftime("%Y-%m-%d %H:%M UTC")
    text = f"Hello {user.full_name},\n\nYour RevoBoard password was changed on {stamp}. If this was not you, contact an administrator.\n\nRevoBoard"
    return Message(to=user.email, subject="Your RevoBoard password was changed", text=text, html=_html(f"Your password was changed on {stamp}. If this was not you, contact an administrator."), user_id=str(user.id), purpose="password_changed")
