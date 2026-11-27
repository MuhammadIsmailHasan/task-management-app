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
    raw = secrets.token_urlsafe(32)
    now = clock.now()
    db.session.add(EmailToken(user_id=user.id, purpose=purpose, token_hash=_hash(raw), expires_at=now + TTL))
    db.session.flush()
    return raw


def invalidate(user_id, purpose):
    now = clock.now()
    db.session.execute(
        db.update(EmailToken).where(EmailToken.user_id == user_id, EmailToken.purpose == purpose, EmailToken.used_at.is_(None)).values(used_at=now)
    )


def consume(raw):
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
