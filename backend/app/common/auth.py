from dataclasses import dataclass
from functools import wraps

from flask_jwt_extended import create_access_token, get_jwt, verify_jwt_in_request

from app.common.errors import AccountDisabled, Forbidden

ROLE_RANK = {"guest": 0, "member": 1, "supervisor": 2, "manager": 3}


@dataclass(frozen=True)
class Actor:
    id: str
    role: str


def issue_token(user_id, role) -> str:
    return create_access_token(identity=str(user_id), additional_claims={"role": role})


def _require_active(user_id):
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
    verify_jwt_in_request(optional=True)
    claims = get_jwt()
    if not claims:
        return None
    _require_active(claims["sub"])
    return Actor(id=claims["sub"], role=claims["role"])


def optional_actor():
    from flask_jwt_extended.exceptions import JWTExtendedException
    from jwt.exceptions import PyJWTError

    try:
        return current_actor()
    except (JWTExtendedException, PyJWTError):
        return None


def require_role(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
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
