import logging
import smtplib
import ssl
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from email.message import EmailMessage
from html import escape

from flask import current_app

log = logging.getLogger("revoboard.mail")

RETRY_AFTER_SECONDS = 5
SMTP_VARS = ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM")
URL_SCHEMES = ("http://", "https://")

BRAND = "#002954"
ON_BRAND = "#ffffff"
SURFACE = "#f3f2ff"
SURFACE_RAISED = "#ffffff"
INK = "#0f193c"
INK_MUTED = "#43474f"
BORDER = "#ebedff"
RADIUS = "12px"
FONT = "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
TEXT_SM = "14px"
TEXT_BASE = "15px"
TEXT_XL = "24px"
CARD_WIDTH = "480px"
SPACE_SM = "12px"
SPACE_MD = "16px"
SPACE_LG = "24px"
LINE_HEIGHT = "1.6"

outbox = []
_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="mail")
_lock = threading.Lock()


@dataclass(frozen=True)
class Message:
    to: str
    subject: str
    text: str
    html: str | None = None
    user_id: str | None = None
    purpose: str | None = None


def link(path_and_query):
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
        else:
            log.warning("mail to %s | %s\n%s", msg.to, msg.subject, msg.text)
    except Exception as exc:
        log.error("mail failed: purpose=%s user=%s error=%s", msg.purpose, msg.user_id, type(exc).__name__)
        if retry:
            time.sleep(RETRY_AFTER_SECONDS)
            _deliver(msg, cfg, retry=False)


def send(msg):
    cfg = {k: current_app.config.get(k) for k in ("MAIL_BACKEND", *SMTP_VARS)}
    if cfg["MAIL_BACKEND"] == "smtp":
        _pool.submit(_deliver, msg, cfg)
    else:
        _deliver(msg, cfg, retry=False)


def check_config(config):
    if config["MAIL_BACKEND"] not in ("smtp", "console", "memory"):
        raise RuntimeError("MAIL_BACKEND must be smtp or console")
    if config["MAIL_BACKEND"] == "smtp":
        missing = [k for k in SMTP_VARS if not str(config.get(k) or "").strip()]
        if missing:
            raise RuntimeError(f"MAIL_BACKEND=smtp needs: {', '.join(missing)}")
        if not str(config.get("PUBLIC_BASE_URL") or "").startswith(URL_SCHEMES):
            raise RuntimeError("MAIL_BACKEND=smtp needs PUBLIC_BASE_URL to start with http:// or https://")


def _paragraph(content, color=INK, size=TEXT_BASE):
    return f'<p style="margin:0 0 {SPACE_MD};color:{color};font-size:{size};line-height:{LINE_HEIGHT}">{content}</p>'


def _button(label, url):
    return f'<p style="margin:{SPACE_LG} 0"><a href="{escape(url)}" style="display:inline-block;background:{BRAND};color:{ON_BRAND};font-size:{TEXT_BASE};font-weight:600;text-decoration:none;padding:{SPACE_SM} {SPACE_LG};border-radius:{RADIUS}">{escape(label)}</a></p>'


def _html(title, name, intro, note, action_url=None):
    parts = [
        f'<h1 style="margin:0 0 {SPACE_MD};color:{INK};font-size:{TEXT_XL}">{escape(title)}</h1>',
        _paragraph(f"Hello {escape(name)},"),
        _paragraph(escape(intro)),
    ]
    if action_url:
        parts.append(_button("Confirm email", action_url))
        link_html = f'<a href="{escape(action_url)}" style="color:{BRAND};word-break:break-all">{escape(action_url)}</a>'
        parts.append(_paragraph(f"If the button does not work, open this link:<br>{link_html}", INK_MUTED, TEXT_SM))
    parts.append(f'<p style="margin:0;border-top:1px solid {BORDER};padding-top:{SPACE_MD};color:{INK_MUTED};font-size:{TEXT_SM};line-height:{LINE_HEIGHT}">{escape(note)}</p>')
    return (
        f'<!doctype html><html lang="en"><body style="margin:0;padding:0;background:{SURFACE};font-family:{FONT}">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{SURFACE}"><tr><td align="center" style="padding:{SPACE_LG} {SPACE_MD}">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:{CARD_WIDTH};background:{SURFACE_RAISED};border:1px solid {BORDER};border-radius:{RADIUS};overflow:hidden;text-align:left">'
        f'<tr><td style="background:{BRAND};color:{ON_BRAND};padding:{SPACE_MD} {SPACE_LG};font-size:{TEXT_BASE};font-weight:700">RevoBoard</td></tr>'
        f'<tr><td style="padding:{SPACE_LG}">{"".join(parts)}</td></tr>'
        "</table></td></tr></table></body></html>"
    )


def verification_email(user, token):
    url = link(f"/app/verify?token={token}")
    text = f"Hello {user.full_name},\n\nConfirm your email address to start using RevoBoard:\n{url}\n\nThe link works once and expires in 24 hours. If you did not register, ignore this message.\n\nRevoBoard"
    html = _html("Confirm your email", user.full_name, "Confirm your email address to start using RevoBoard.", "The link works once and expires in 24 hours. If you did not register, ignore this message.", url)
    return Message(to=user.email, subject="Confirm your RevoBoard email", text=text, html=html, user_id=str(user.id), purpose="verify_email")


def change_email_email(user, token):
    url = link(f"/app/verify?token={token}")
    text = f"Hello {user.full_name},\n\nConfirm this new email address for your RevoBoard account:\n{url}\n\nThe link works once and expires in 24 hours. Until then your old address stays in use. If you did not ask for this, ignore this message.\n\nRevoBoard"
    html = _html("Confirm your new email", user.full_name, "Confirm this new email address for your RevoBoard account.", "The link works once and expires in 24 hours. Until then your old address stays in use. If you did not ask for this, ignore this message.", url)
    return Message(to=user.pending_email, subject="Confirm your new RevoBoard email", text=text, html=html, user_id=str(user.id), purpose="change_email")


def password_changed_email(user, when):
    stamp = when.strftime("%Y-%m-%d %H:%M UTC")
    text = f"Hello {user.full_name},\n\nYour RevoBoard password was changed on {stamp}. If this was not you, contact an administrator.\n\nRevoBoard"
    html = _html("Your password was changed", user.full_name, f"Your RevoBoard password was changed on {stamp}.", "If this was not you, contact an administrator.")
    return Message(to=user.email, subject="Your RevoBoard password was changed", text=text, html=html, user_id=str(user.id), purpose="password_changed")
