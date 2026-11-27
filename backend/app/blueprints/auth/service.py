from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy.exc import IntegrityError

from app.blueprints.activity import repository as activity
from app.blueprints.auth import repository as repo
from app.blueprints.auth.dto import serialize_user
from app.common import clock, email_tokens, mail, rate_limiter
from app.common.auth import issue_token
from app.common.errors import AccountDisabled, AccountNotActivated, Conflict, NotFound, Unauthorized, ValidationError
from app.common.ids import to_uuid
from app.common.validation import classify_identifier, is_email_shape, is_username, normalize_email, normalize_username
from app.extensions import db

_hasher = PasswordHasher()
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def duplicate_details(username, email, exclude_id=None):
    details = {}
    other = repo.get_by_username(username)
    if other is not None and other.id != exclude_id:
        details["username"] = ["username is already taken"]
    other = repo.get_by_email(email)
    if other is not None and other.id != exclude_id:
        details["email"] = ["email is already registered"]
    return details


def create_account(full_name, username, email, password, role="member", verified=False):
    username, email = normalize_username(username), normalize_email(email)
    details = duplicate_details(username, email)
    if details:
        raise Conflict("Username or email already registered", details=details)
    try:
        with db.session.begin_nested():
            return repo.create_user(full_name, username, email, _hasher.hash(password), role, verified)
    except IntegrityError:
        raise Conflict("Username or email already registered", details=duplicate_details(username, email) or None)


def register(data):
    user = create_account(data["full_name"], data["username"], data["email"], data["password"], "member")
    raw = email_tokens.create(user, "verify_email")
    db.session.commit()
    mail.send(mail.verification_email(user, raw))
    return {"user": serialize_user(user), "token": None}


def login(data, client_ip=None):
    kind, value = classify_identifier(data["identifier"])
    rate_limiter.check_login(value, client_ip)
    user = repo.get_by_email(value) if kind == "email" else repo.get_by_username(value)
    password_hash = user.password_hash if user is not None else _DUMMY_HASH
    try:
        _hasher.verify(password_hash, data["password"])
    except VerifyMismatchError:
        user = None
    if user is None:
        rate_limiter.record_login_failure(value, client_ip)
        raise Unauthorized("Invalid credentials")
    if not user.is_active:
        raise AccountDisabled("This account is disabled")
    if user.email_verified_at is None:
        raise AccountNotActivated("Confirm your email address first")
    rate_limiter.reset_pair(value, client_ip)
    return {"user": serialize_user(user), "token": issue_token(user.id, user.role)}


def availability(username=None, email=None, client_ip=None):
    if username is None and email is None:
        raise ValidationError("Supply a username or an email", details={"username": ["username or email is required"]})
    rate_limiter.hit_availability(client_ip)
    result, problems = {}, {}
    if username is not None:
        value = normalize_username(username)
        if is_username(value):
            result["username"] = {"available": repo.get_by_username(value) is None}
        else:
            problems["username"] = ["username must be 3 to 30 characters: letters, digits, underscore or dot"]
    if email is not None:
        value = normalize_email(email)
        if is_email_shape(value):
            result["email"] = {"available": repo.get_by_email(value) is None}
        else:
            problems["email"] = ["email must be a valid email address"]
    if problems:
        raise ValidationError("Validation failed", details=problems)
    return result


def _me(actor):
    user = repo.get_by_id(to_uuid(actor.id))
    if user is None:
        raise NotFound("User not found")
    return user


def get_me(actor):
    return serialize_user(_me(actor))


def update_me(actor, data):
    user = _me(actor)
    changed, send_to = [], None
    if "full_name" in data:
        user.full_name = data["full_name"]
        changed.append("full_name")
    if "username" in data:
        username = normalize_username(data["username"])
        other = repo.get_by_username(username)
        if other is not None and other.id != user.id:
            raise Conflict("Username already taken", details={"username": ["username is already taken"]})
        if username != user.username:
            user.username = username
            changed.append("username")
    if "is_available" in data:
        user.is_available = bool(data["is_available"])
        changed.append("is_available")
    if "email" in data:
        send_to = _request_email_change(user, normalize_email(data["email"]))
        if send_to:
            changed.append("email")
    if changed:
        activity.add(user.id, "user.profile_updated", "user", user.id, {"fields": changed})
    db.session.commit()
    if send_to:
        mail.send(mail.change_email_email(user, send_to))
    return serialize_user(user)


def _request_email_change(user, email):
    if email == user.email:
        user.pending_email = None
        email_tokens.invalidate(user.id, "change_email")
        return None
    other = repo.get_by_email(email)
    pending_elsewhere = db.session.scalar(db.select(db.func.count()).select_from(repo.User).where(db.func.lower(repo.User.pending_email) == email, repo.User.id != user.id))
    if (other is not None and other.id != user.id) or pending_elsewhere:
        raise Conflict("Email already registered", details={"email": ["email is already registered"]})
    email_tokens.invalidate(user.id, "change_email")
    user.pending_email = email
    return email_tokens.create(user, "change_email")


def resend_email_change(actor):
    user = _me(actor)
    if not user.pending_email:
        raise NotFound("No email change is waiting")
    rate_limiter.hit_resend(user.id, None)
    email_tokens.invalidate(user.id, "change_email")
    raw = email_tokens.create(user, "change_email")
    db.session.commit()
    mail.send(mail.change_email_email(user, raw))
    return serialize_user(user)


def cancel_email_change(actor):
    user = _me(actor)
    user.pending_email = None
    email_tokens.invalidate(user.id, "change_email")
    db.session.commit()
    return serialize_user(user)


def verify(data):
    row = email_tokens.consume(data["token"])
    user = repo.get_by_id(row.user_id)
    if user is None:
        raise NotFound("User not found")
    if row.purpose == "verify_email":
        user.email_verified_at = clock.now()
    else:
        new = user.pending_email
        if not new:
            raise Conflict("This email change was cancelled")
        other = repo.get_by_email(new)
        if other is not None and other.id != user.id:
            db.session.rollback()
            raise Conflict("Email already registered", details={"email": ["email is already registered"]})
        user.email, user.pending_email = new, None
    db.session.commit()
    return {"purpose": row.purpose}


RESEND_MESSAGE = "If that address needs confirming, a new link was sent"


def resend_verification(email, client_ip=None):
    address = normalize_email(email)
    rate_limiter.hit_resend(address, client_ip)
    user = repo.get_by_email(address)
    if user is not None and user.email_verified_at is None:
        email_tokens.invalidate(user.id, "verify_email")
        raw = email_tokens.create(user, "verify_email")
        db.session.commit()
        mail.send(mail.verification_email(user, raw))
    return {"message": RESEND_MESSAGE}


def change_password(actor, data):
    user = _me(actor)
    rate_limiter.check_change_password(user.id)
    try:
        _hasher.verify(user.password_hash, data["current_password"])
    except VerifyMismatchError:
        rate_limiter.record_change_password_failure(user.id)
        raise ValidationError(
            "Current password is incorrect", details={"current_password": ["current password is incorrect"]}
        )
    user.password_hash = _hasher.hash(data["new_password"])
    activity.add(user.id, "user.password_changed", "user", user.id, {})
    rate_limiter.reset_change_password(user.id)
    db.session.commit()
    mail.send(mail.password_changed_email(user, clock.now()))
