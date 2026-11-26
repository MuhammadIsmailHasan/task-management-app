from app.extensions import db
from app.models.base import TimestampMixin, uuid_fk, uuid_pk


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id = uuid_pk()
    full_name = db.Column(db.String(255), nullable=False)
    username = db.Column(db.String(30), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(
        db.Enum("member", "supervisor", "manager", "admin", name="user_role"),
        nullable=False,
        default="member",
    )
    avatar_path = db.Column(db.String(64), nullable=True)
    # Set by an Admin: an inactive user cannot sign in and has no live Token (V17, Requirement 53).
    is_active = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())
    # Set by the user or an Admin: only users who are active and available show in the member and assignee pickers.
    is_available = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())
    # Null until the address is confirmed by a link (Requirement 59); an Admin-made or older account is verified at creation.
    email_verified_at = db.Column(db.DateTime(timezone=True), nullable=True)
    # A new address waiting for its confirmation link; `email` stays in use until then (Requirement 54).
    pending_email = db.Column(db.String(255), nullable=True)


class EmailToken(TimestampMixin, db.Model):
    """A single-use, hashed, expiring token for a verification or an email-change link (Requirement 59)."""

    __tablename__ = "email_tokens"

    id = uuid_pk()
    user_id = uuid_fk("users.id", nullable=False)
    purpose = db.Column(db.Enum("verify_email", "change_email", name="email_token_purpose"), nullable=False)
    token_hash = db.Column(db.String(64), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)


db.Index("uq_email_tokens_hash", EmailToken.token_hash, unique=True)
db.Index("ix_email_tokens_user_purpose", EmailToken.user_id, EmailToken.purpose)


# Case-insensitive uniqueness (Decision M).
db.Index("uq_users_username_lower", db.func.lower(User.username), unique=True)
db.Index("uq_users_email_lower", db.func.lower(User.email), unique=True)
