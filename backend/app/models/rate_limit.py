from app.extensions import db
from app.models.base import uuid_pk


class RateLimitAttempt(db.Model):
    __tablename__ = "rate_limit_attempts"

    id = uuid_pk()
    scope = db.Column(
        db.Enum("login_pair", "login_ip", "availability", "change_password", name="rate_limit_scope"),
        nullable=False,
    )
    key_hash = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False)

    __table_args__ = (db.Index("ix_rate_limit_scope_key_created", "scope", "key_hash", "created_at"),)
