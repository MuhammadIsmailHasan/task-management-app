import hashlib
import hmac
from datetime import timedelta
from math import ceil

from flask import current_app
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.common import clock
from app.common.errors import AppError
from app.extensions import db
from app.models import RateLimitAttempt


class RateLimited(AppError):
    status = 429
    code = "RATE_LIMITED"

    def __init__(self, retry_after):
        super().__init__("Too many attempts. Try again later.", details={"retry_after": int(retry_after)})
        self.retry_after = int(retry_after)


def blocked_until(times, now, window, limit):
    live = sorted(t for t in times if t > now - window)
    if len(live) < limit:
        return None
    return max(1, ceil((live[len(live) - limit] + window - now).total_seconds()))


def _cfg(name):
    return current_app.config[name]


def _window():
    return timedelta(seconds=_cfg("RATE_LIMIT_WINDOW_SECONDS"))


def key_hash(scope, *parts):
    secret = current_app.config["JWT_SECRET_KEY"].encode()
    return hmac.new(secret, f"ratelimit:{scope}:{'|'.join(parts)}".encode(), hashlib.sha256).hexdigest()


def pair_key(identifier, ip):
    return key_hash("pair", identifier.strip().lower(), ip or "")


def ip_key(scope, ip):
    return key_hash(scope, ip or "")


def user_key(user_id):
    return key_hash("chpw", str(user_id))


def _times(session, scope, key):
    return list(
        session.execute(
            select(RateLimitAttempt.created_at).where(RateLimitAttempt.scope == scope, RateLimitAttempt.key_hash == key)
        ).scalars()
    )


def _aware(value):
    return value if value.tzinfo else value.replace(tzinfo=clock.now().tzinfo)


def _wait(session, scope, key, limit):
    now = clock.now()
    return blocked_until([_aware(t) for t in _times(session, scope, key)], now, _window(), limit)


def _lock(session, scope, key):
    if session.get_bind().dialect.name == "postgresql":
        session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": scope + key})


def _record(session, entries):
    now = clock.now()
    for scope, key in entries:
        _lock(session, scope, key)
        session.add(RateLimitAttempt(scope=scope, key_hash=key, created_at=now))
        session.execute(delete(RateLimitAttempt).where(RateLimitAttempt.scope == scope, RateLimitAttempt.created_at <= now - _window()))


def _record_committed(entries):
    with Session(db.engine) as session:
        _record(session, entries)
        session.commit()


def check_login(identifier, ip):
    waits = [
        _wait(db.session, "login_pair", pair_key(identifier, ip), _cfg("RATE_LIMIT_LOGIN_PAIR_MAX")),
        _wait(db.session, "login_ip", ip_key("login_ip", ip), _cfg("RATE_LIMIT_LOGIN_IP_MAX")),
    ]
    waits = [w for w in waits if w]
    if waits:
        raise RateLimited(max(waits))


def record_login_failure(identifier, ip):
    _record_committed([("login_pair", pair_key(identifier, ip)), ("login_ip", ip_key("login_ip", ip))])


def reset_pair(identifier, ip):
    db.session.execute(delete(RateLimitAttempt).where(RateLimitAttempt.scope == "login_pair", RateLimitAttempt.key_hash == pair_key(identifier, ip)))
    db.session.commit()


def hit_availability(ip):
    key = ip_key("availability", ip)
    with Session(db.engine) as session:
        _lock(session, "availability", key)
        wait = _wait(session, "availability", key, _cfg("RATE_LIMIT_AVAILABILITY_MAX"))
        if wait:
            session.rollback()
            raise RateLimited(wait)
        _record(session, [("availability", key)])
        session.commit()


def check_change_password(user_id):
    wait = _wait(db.session, "change_password", user_key(user_id), _cfg("RATE_LIMIT_CHANGE_PASSWORD_MAX"))
    if wait:
        raise RateLimited(wait)


def record_change_password_failure(user_id):
    _record_committed([("change_password", user_key(user_id))])


def reset_change_password(user_id):
    db.session.execute(delete(RateLimitAttempt).where(RateLimitAttempt.scope == "change_password", RateLimitAttempt.key_hash == user_key(user_id)))


def hit_resend(address, ip):
    entries = [("resend_verification", key_hash("resend", str(address)))]
    if ip:
        entries.append(("resend_verification_ip", key_hash("resend_ip", ip)))
    per_address = _cfg("RATE_LIMIT_RESEND_VERIFICATION_MAX")
    limits = {"resend_verification": per_address, "resend_verification_ip": per_address * 3 + 1}
    with Session(db.engine) as session:
        for scope, key in entries:
            _lock(session, scope, key)
        waits = [w for scope, key in entries if (w := _wait(session, scope, key, limits[scope]))]
        if waits:
            session.rollback()
            raise RateLimited(max(waits))
        _record(session, entries)
        session.commit()


def count(scope):
    return db.session.execute(select(func.count()).select_from(RateLimitAttempt).where(RateLimitAttempt.scope == scope)).scalar()
