"""Single-use email tokens, stored only as SHA-256 hashes (V17, ACT-06)."""
import hashlib
import secrets
from datetime import timedelta

from app.common import clock
from app.common.errors import TokenExpired, TokenInvalid
from app.extensions import db
from app.models import EmailToken

TTL = timedelta(hours=24)


def _hash(raw):
    return hashlib.sha256(raw.encode()).hexdigest()


def create(user, purpose):
    """A new token for `user`; returns the raw value, which goes into the email and nowhere else. The caller commits."""
    raw = secrets.token_urlsafe(32)  # 256 bits
    now = clock.now()
    db.session.add(EmailToken(user_id=user.id, purpose=purpose, token_hash=_hash(raw), expires_at=now + TTL))
    db.session.flush()
    return raw


def invalidate(user_id, purpose):
    """Mark every unused token of this purpose as used, so only the newest link works."""
    now = clock.now()
    db.session.execute(
        db.update(EmailToken).where(EmailToken.user_id == user_id, EmailToken.purpose == purpose, EmailToken.used_at.is_(None)).values(used_at=now)
    )


def consume(raw):
    """Look up an unused token, mark it used, and return it. 400 TOKEN_INVALID or TOKEN_EXPIRED otherwise."""
    if not isinstance(raw, str) or not raw:
        raise TokenInvalid("This link is not valid")
    row = db.session.scalars(db.select(EmailToken).where(EmailToken.token_hash == _hash(raw)).with_for_update()).first()
    if row is None or row.used_at is not None:
        raise TokenInvalid("This link is not valid or was already used")
    now = clock.now()
    expires = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=now.tzinfo)
    if expires < now:
        raise TokenExpired("This link has expired")
    row.used_at = now
    return row
