import json
import logging
from http import HTTPStatus
from pathlib import Path

from flask import jsonify
from flask_smorest import Api
from werkzeug.exceptions import HTTPException

from app.common.envelope import ErrorEnvelopeSchema
from app.common.errors import AppError, error_body
from app.extensions import db

log = logging.getLogger(__name__)

DOCS_ENVS = ("development", "testing")
_CODES = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    429: "RATE_LIMITED",
}


def render_error(status, code, message, details=None):
    return jsonify(error_body(code, message, details)), status


def openapi_config(app_env):
    config = {"API_TITLE": "Kanban Task Management API", "API_VERSION": "v1", "OPENAPI_VERSION": "3.0.3"}
    if app_env in DOCS_ENVS:
        config.update(
            OPENAPI_URL_PREFIX="/api",
            OPENAPI_JSON_PATH="openapi.json",
            OPENAPI_SWAGGER_UI_PATH="docs",
            OPENAPI_SWAGGER_UI_URL="https://cdn.jsdelivr.net/npm/swagger-ui-dist/",
        )
    return config


_LOCATIONS = ("json", "query", "form", "files", "headers", "cookies", "path")


def _details(messages):
    if not isinstance(messages, dict):
        return {"_schema": [str(messages)]}
    flat = {}
    for key, value in messages.items():
        if key in _LOCATIONS and isinstance(value, dict):
            flat.update(_details(value))
        elif isinstance(value, (list, tuple)):
            flat[str(key)] = [x if isinstance(x, str) else str(x) for x in value]
        elif isinstance(value, dict):
            flat[str(key)] = [f"{k}: {v[0] if isinstance(v, list) and v else v}" for k, v in value.items()]
        else:
            flat[str(key)] = [str(value)]
    return flat


class EnvelopeApi(Api):
    ERROR_SCHEMA = ErrorEnvelopeSchema

    def _register_error_handlers(self):
        app = self._app
        app.register_error_handler(AppError, self.handle_app_error)
        app.register_error_handler(HTTPException, self.handle_http_exception)
        app.register_error_handler(Exception, self.handle_unexpected)

    def handle_app_error(self, err):
        db.session.rollback()
        response, status = render_error(err.status, err.code, err.message, err.details)
        retry_after = getattr(err, "retry_after", None)
        if retry_after is not None:
            response.headers["Retry-After"] = str(retry_after)
        return response, status

    def handle_http_exception(self, error):
        status = error.code or 500
        data = getattr(error, "data", None) or {}
        if status == 422:
            raw = data.get("messages") or data.get("errors") or data.get("message") or "Invalid request"
            return render_error(400, "VALIDATION_ERROR", "Validation failed", _details(raw))
        message = data.get("message") or HTTPStatus(status).phrase
        return render_error(status, _CODES.get(status, "ERROR"), message)

    def handle_unexpected(self, err):
        db.session.rollback()
        log.exception("Unhandled exception")
        return render_error(500, "INTERNAL_ERROR", "Internal server error")


def init_api(app):
    api = EnvelopeApi(app)
    app.extensions["api"] = api
    api.spec.components.security_scheme(
        "bearerAuth", {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    )

    @app.cli.command("export-openapi")
    def export_openapi():
        """Write the generated OpenAPI document to backend/openapi.json."""
        path = Path(app.root_path).parent / "openapi.json"
        path.write_text(json.dumps(api.spec.to_dict(), indent=2) + "\n")
        print(f"Wrote {path}")

    return api
