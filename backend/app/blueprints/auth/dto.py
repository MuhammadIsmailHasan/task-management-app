"""Plain serializers (no marshmallow, no Flask)."""


def _avatar(user):
    from app.common import clock
    from app.common.signing import avatar_url

    return avatar_url(user.id, clock.now()) if user.avatar_path else None


def serialize_user(user):
    """The user as they see themselves: the Admin screens, login, and `/auth/me`. It carries the two flags and, for its
    owner only, an email change still waiting for its link (`pending_email`, PRF-03)."""
    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "username": user.username,
        "email": user.email,
        "avatar_url": _avatar(user),
        "is_active": user.is_active,
        "is_available": user.is_available,
        "pending_email": user.pending_email,
    }


def serialize_user_admin(user):
    """The Admin's view of a user: `pending_email` is its owner's alone (PRF-03)."""
    data = {**serialize_user(user), "role": user.role}
    del data["pending_email"]
    return data


def serialize_member(user):
    """A person as other users see them: never the email."""
    return {"id": str(user.id), "full_name": user.full_name, "username": user.username, "avatar_url": _avatar(user)}


def serialize_candidate(user):
    """Candidate rows go to board staff only, so the email is included (Decision S)."""
    return {**serialize_member(user), "email": user.email}
