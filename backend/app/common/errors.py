class AppError(Exception):
    status = 500
    code = "INTERNAL_ERROR"

    def __init__(self, message="Internal server error", details=None):
        super().__init__(message)
        self.message = message
        self.details = details


class ValidationError(AppError):
    status = 400
    code = "VALIDATION_ERROR"


class Unauthorized(AppError):
    status = 401
    code = "UNAUTHORIZED"


class Forbidden(AppError):
    status = 403
    code = "FORBIDDEN"


class NotFound(AppError):
    status = 404
    code = "NOT_FOUND"


class Conflict(AppError):
    status = 409
    code = "CONFLICT"


class ColumnNotEmpty(Conflict):
    code = "COLUMN_NOT_EMPTY"


class ColumnLocked(Conflict):
    code = "COLUMN_LOCKED"


class CardArchived(Conflict):
    code = "CARD_ARCHIVED"


class CardNotArchived(Conflict):
    code = "CARD_NOT_ARCHIVED"


class CardInDone(Conflict):
    code = "CARD_IN_DONE"


class AccountDisabled(Forbidden):
    code = "ACCOUNT_DISABLED"


class AccountNotActivated(Forbidden):
    code = "ACCOUNT_NOT_ACTIVATED"


class TokenInvalid(ValidationError):
    code = "TOKEN_INVALID"


class TokenExpired(ValidationError):
    code = "TOKEN_EXPIRED"


class UserHasOpenWork(Conflict):
    code = "USER_HAS_OPEN_WORK"


class CannotDeactivateSelf(Conflict):
    code = "CANNOT_DEACTIVATE_SELF"


class ServiceUnavailable(AppError):
    status = 503
    code = "SERVICE_UNAVAILABLE"


def error_body(code, message, details=None):
    error = {"code": code}
    if details:
        error["details"] = details
    return {"status": False, "message": message, "error": error}
