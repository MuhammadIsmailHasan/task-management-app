import secrets

from flask import current_app

from app.blueprints.activity import repository as activity
from app.blueprints.auth import repository as auth_repo
from app.blueprints.auth import service as auth_service
from app.blueprints.users import repository as repo
from app.blueprints.users.dto import ROLES
from app.common.errors import CannotDeactivateSelf, Conflict, Forbidden, NotFound, UserHasOpenWork, ValidationError
from app.common.ids import to_uuid
from app.common.validation import normalize_email, normalize_username
from app.common import clock
from app.common.file_store import FileStore
from app.common.images import AVATAR_TYPES, MAX_AVATAR_BYTES, detect_image_type
from app.common.signing import verify_avatar_signature
from app.extensions import db


def list_users(page=1, per_page=20):
    return repo.list_page(page, per_page)


def _role(value):
    if value not in ROLES:
        raise ValidationError("role must be one of: " + ", ".join(ROLES))
    return value


def create_user(actor, data):
    role = _role(data.get("role", "member"))
    user = auth_service.create_account(data["full_name"], data["username"], data["email"], data["password"], role, verified=True)
    activity.add(to_uuid(actor.id), "user.created", "user", user.id, {"role": role})
    db.session.commit()
    return user


def update_user(actor, user_id, data):
    uid = to_uuid(user_id)
    user = auth_repo.get_by_id(uid) if uid else None
    if user is None:
        raise NotFound("User not found")
    changed = []
    if "full_name" in data:
        if not isinstance(data["full_name"], str) or not data["full_name"].strip():
            raise ValidationError("full_name is required")
        user.full_name = data["full_name"].strip()
        changed.append("full_name")
    if "username" in data or "email" in data:
        username = normalize_username(data.get("username", user.username))
        email = normalize_email(data.get("email", user.email))
        details = auth_service.duplicate_details(username, email, exclude_id=user.id)
        if details:
            raise Conflict("Username or email already registered", details=details)
        for field, value in (("username", username), ("email", email)):
            if getattr(user, field) != value:
                setattr(user, field, value)
                changed.append(field)
    if changed:
        activity.add(to_uuid(actor.id), "user.updated", "user", user.id, {"fields": changed})
    if "is_available" in data and bool(data["is_available"]) != user.is_available:
        user.is_available = bool(data["is_available"])
        activity.add(to_uuid(actor.id), "user.updated", "user", user.id, {"fields": ["is_available"], "is_available": user.is_available})
    if "is_active" in data and bool(data["is_active"]) != user.is_active:
        _set_active(actor, user, bool(data["is_active"]))
    if "role" in data:
        role = _role(data["role"])
        if role != user.role:
            activity.add(
                to_uuid(actor.id), "user.role_changed", "user", user.id, {"from": user.role, "to": role}
            )
            user.role = role
            if role in ("manager", "admin"):
                _drop_board_access(actor, user)
    db.session.commit()
    return user


def _set_active(actor, user, active):
    """Turn an account on or off (ADM-05 to ADM-07). Off is refused for oneself and while the user has open work."""
    if not active:
        if str(user.id) == actor.id:
            raise CannotDeactivateSelf("You cannot deactivate your own account")
        cards_total, cards = repo.open_assigned(user.id)
        boards_total, boards = repo.open_owned_boards(user.id)
        if cards_total or boards_total:
            raise UserHasOpenWork(
                "Reassign or finish this work first.",
                details={
                    "cards": [{"id": str(c.id), "title": c.title, "board_id": str(c.board_id), "board_slug": c.slug, "board_name": c.name} for c in cards],
                    "boards": [{"id": str(b.id), "slug": b.slug, "name": b.name, "open_card_count": int(b.open)} for b in boards],
                    "cards_total": cards_total,
                    "boards_total": boards_total,
                },
            )
    user.is_active = active
    activity.add(to_uuid(actor.id), "user.activated" if active else "user.deactivated", "user", user.id, {})


def _drop_board_access(actor, user):
    """A new Manager or Admin sees every Board, so BoardMember rows and pending requests go (Requirement 22, criterion 6)."""
    from app.blueprints.boards import repository as boards_repo
    from app.blueprints.invites import repository as invites_repo

    for member in boards_repo.memberships_of(user.id):
        activity.add(to_uuid(actor.id), "board.member_removed", "board", member.board_id, {"user_id": str(user.id)})
        boards_repo.delete_member(member)
    invites_repo.delete_pending_of_user(user.id)


# ---- avatar (V10, Decision R) --------------------------------------------------------------------

_store = FileStore("avatars")


def _file_error(message):
    return ValidationError(message, details={"file": [message]})


def _locked_user(actor):
    user = db.session.scalars(db.select(auth_repo.User).where(auth_repo.User.id == to_uuid(actor.id)).with_for_update()).first()
    if user is None:
        raise NotFound("User not found")
    return user


def set_avatar(actor, stream):
    """Write the new file, switch the row under a lock, then delete the old file (best effort)."""
    if stream is None:
        raise _file_error("file is required")
    data = stream.read(MAX_AVATAR_BYTES + 1)
    if not data:
        raise _file_error("file is empty")
    if len(data) > MAX_AVATAR_BYTES:
        raise _file_error("file must be at most 2 MB")
    kind = detect_image_type(data)
    if kind is None:
        raise _file_error("file must be a PNG, JPEG or WebP image")
    name = f"{secrets.token_hex(16)}.{kind}"
    _store.save(name, data)
    try:
        user = _locked_user(actor)
        old, user.avatar_path = user.avatar_path, name
        activity.add(user.id, "user.profile_updated", "user", user.id, {"fields": ["avatar"]})
        db.session.commit()
    except Exception:
        db.session.rollback()
        _store.delete(name)
        raise
    if old:
        _store.delete(old)
    return user


def clear_avatar(actor):
    user = _locked_user(actor)
    old = user.avatar_path
    if old is None:
        db.session.rollback()
        return user
    user.avatar_path = None
    activity.add(user.id, "user.profile_updated", "user", user.id, {"fields": ["avatar"]})
    db.session.commit()
    _store.delete(old)
    return user


def open_avatar(user_id, exp, sig):
    uid = to_uuid(user_id)
    if uid is None or not verify_avatar_signature(uid, exp, sig, clock.now()):
        raise Forbidden("Invalid or expired avatar link")
    user = auth_repo.get_by_id(uid)
    if user is None or not user.avatar_path:
        raise NotFound("No avatar")
    kind = user.avatar_path.rsplit(".", 1)[-1]
    return _store.path(user.avatar_path), AVATAR_TYPES[kind]
