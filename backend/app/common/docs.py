"""Small helpers that attach OpenAPI metadata to smorest views."""
from app.common.envelope import ErrorEnvelopeSchema

_ERR = {
    400: "Validation error",
    401: "Missing, invalid or expired Token",
    403: "Role or board access insufficient",
    404: "Resource not found",
    409: "Conflict",
    429: "Rate limited; see Retry-After and error.details.retry_after",
    503: "Database unavailable",
}


def endpoint(blp, summary, description=None, *, auth="required", errors=(400, 401, 403, 404), **doc):
    """auth: 'required' | 'optional' (Guests allowed) | 'none'."""

    def deco(fn):
        extra = dict(doc)
        if auth == "required":
            extra["security"] = [{"bearerAuth": []}]
        elif auth == "optional":
            extra["security"] = [{"bearerAuth": []}, {}]
        else:
            extra["security"] = []
        fn = blp.doc(summary=summary, description=description or summary, **extra)(fn)
        for code in sorted(errors, reverse=True):
            fn = blp.alt_response(code, schema=ErrorEnvelopeSchema, description=_ERR[code])(fn)
        return fn

    return deco
