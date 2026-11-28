def _avatar(user):
    from app.common import clock
    from app.common.signing import avatar_url

    return avatar_url(user.id, clock.now()) if user.avatar_path else None


def serialize_user(user):
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
    data = {**serialize_user(user), "role": user.role, "email_verified": user.email_verified_at is not None}
    del data["pending_email"]
    return data


def serialize_member(user):
    return {"id": str(user.id), "full_name": user.full_name, "username": user.username, "avatar_url": _avatar(user)}


def serialize_candidate(user):
    return {**serialize_member(user), "email": user.email}
