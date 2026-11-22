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


class ServiceUnavailable(AppError):
    status = 503
    code = "SERVICE_UNAVAILABLE"


def error_body(code, message, details=None):
    """Error envelope: { status: false, message, error: { code, details? } }."""
    error = {"code": code}
    if details:
        error["details"] = details
    return {"status": False, "message": message, "error": error}
