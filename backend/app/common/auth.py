from dataclasses import dataclass
from functools import wraps

from flask_jwt_extended import create_access_token, get_jwt, verify_jwt_in_request

from app.common.errors import AccountDisabled, Forbidden

# admin is deliberately outside the ladder (separate track).
ROLE_RANK = {"guest": 0, "member": 1, "supervisor": 2, "manager": 3}


@dataclass(frozen=True)
class Actor:
    id: str
    role: str


def issue_token(user_id, role) -> str:
    return create_access_token(identity=str(user_id), additional_claims={"role": role})


def _require_active(user_id):
    """A deactivated user's Token stops working at once: `is_active` is read on every authenticated request (ADM-07).

    No revocation list exists; the one cheap query is the whole mechanism.
    """
    from app.common.ids import to_uuid
    from app.extensions import db
    from app.models import User

    uid = to_uuid(user_id)
    if uid is None:
        return
    active = db.session.scalar(db.select(User.is_active).where(User.id == uid))
    if active is False:
        raise AccountDisabled("This account is disabled")


def current_actor():
    """Return the Actor from a valid Token, or None for a Guest."""
    verify_jwt_in_request(optional=True)
    claims = get_jwt()
    if not claims:
        return None
    _require_active(claims["sub"])
    return Actor(id=claims["sub"], role=claims["role"])


def optional_actor():
    """Like current_actor, but a malformed, expired or otherwise unusable Token reads as a Guest (Req 18.24)."""
    from flask_jwt_extended.exceptions import JWTExtendedException
    from jwt.exceptions import PyJWTError

    try:
        return current_actor()
    except (JWTExtendedException, PyJWTError):
        return None


def require_role(*roles):
    """Role comes only from the signed Token claims, never the request body."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()  # missing/invalid -> 401 via jwt callbacks
            claims = get_jwt()
            _require_active(claims.get("sub"))
            if claims.get("role") not in roles:
                raise Forbidden("Insufficient role")
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def register_jwt_callbacks(jwt):
    @jwt.unauthorized_loader
    def _missing(reason):
        return _envelope(reason)

    @jwt.invalid_token_loader
    def _invalid(reason):
        return _envelope(reason)

    @jwt.expired_token_loader
    def _expired(header, payload):
        return _envelope("Token has expired")


def _envelope(message):
    from app.api import render_error

    return render_error(401, "UNAUTHORIZED", message)
