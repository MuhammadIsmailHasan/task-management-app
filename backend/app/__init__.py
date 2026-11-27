import os
from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Flask
from flask_cors import CORS

from app.common.auth import register_jwt_callbacks
from app.api import init_api, openapi_config
from app.common.mail import check_config as check_mail_config
from app.extensions import db, jwt, migrate

REQUIRED_ENV = ("ALLOWED_ORIGINS", "JWT_SECRET", "FILE_URL_SECRET", "APP_TIMEZONE")


def _int(env, name, default):
    raw = (env.get(name) or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a whole number") from exc
    if value < 0:
        raise RuntimeError(f"{name} must not be negative")
    return value


def _load_config(overrides):
    env = os.environ
    missing = [k for k in REQUIRED_ENV if not env.get(k, "").strip()]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

    origins = [o.strip() for o in env["ALLOWED_ORIGINS"].split(",") if o.strip()]
    if not origins or "*" in origins:
        raise RuntimeError("ALLOWED_ORIGINS must be an explicit origin list and must not contain '*'")

    tz = env["APP_TIMEZONE"].strip()
    try:
        ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise RuntimeError(f"APP_TIMEZONE is not a valid IANA name: {tz}") from exc

    config = {
        "SQLALCHEMY_DATABASE_URI": env.get("DATABASE_URL") or None,
        "JWT_SECRET_KEY": env["JWT_SECRET"],
        "JWT_ACCESS_TOKEN_EXPIRES": timedelta(hours=24),
        "FILE_URL_SECRET": env["FILE_URL_SECRET"],
        "APP_TIMEZONE": tz,
        "UPLOAD_DIR": os.path.abspath(env.get("UPLOAD_DIR") or "uploads"),
        "ALLOWED_ORIGINS": origins,
        "API_PUBLIC_PREFIX": (env.get("API_PUBLIC_PREFIX") or "").strip().rstrip("/"),
        "APP_ENV": (env.get("APP_ENV") or "production").strip().lower(),
        "RATE_LIMIT_WINDOW_SECONDS": _int(env, "RATE_LIMIT_WINDOW_SECONDS", 900),
        "RATE_LIMIT_LOGIN_PAIR_MAX": _int(env, "RATE_LIMIT_LOGIN_PAIR_MAX", 5),
        "RATE_LIMIT_LOGIN_IP_MAX": _int(env, "RATE_LIMIT_LOGIN_IP_MAX", 20),
        "RATE_LIMIT_AVAILABILITY_MAX": _int(env, "RATE_LIMIT_AVAILABILITY_MAX", 60),
        "RATE_LIMIT_CHANGE_PASSWORD_MAX": _int(env, "RATE_LIMIT_CHANGE_PASSWORD_MAX", 5),
        "TRUSTED_PROXY_COUNT": _int(env, "TRUSTED_PROXY_COUNT", 0),
        "RATE_LIMIT_RESEND_VERIFICATION_MAX": _int(env, "RATE_LIMIT_RESEND_VERIFICATION_MAX", 3),
        "PUBLIC_BASE_URL": (env.get("PUBLIC_BASE_URL") or "").strip().rstrip("/"),
        "SMTP_HOST": (env.get("SMTP_HOST") or "").strip(),
        "SMTP_PORT": (env.get("SMTP_PORT") or "587").strip(),
        "SMTP_USER": (env.get("SMTP_USER") or "").strip(),
        "SMTP_PASSWORD": env.get("SMTP_PASSWORD") or "",
        "MAIL_FROM": (env.get("MAIL_FROM") or "").strip(),
    }
    app_env = (env.get("APP_ENV") or "production").strip().lower()
    config["MAIL_BACKEND"] = (env.get("MAIL_BACKEND") or ("console" if app_env in ("development", "testing") else "smtp")).strip().lower()
    config.update(overrides)
    config.update(openapi_config(config["APP_ENV"]))
    check_mail_config(config)
    return config


def create_app(config_overrides=None):
    app = Flask(__name__)
    app.config.update(_load_config(config_overrides or {}))
    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError("DATABASE_URL is required")

    CORS(app, origins=app.config["ALLOWED_ORIGINS"], supports_credentials=False, expose_headers=["Retry-After"])

    if app.config["TRUSTED_PROXY_COUNT"] > 0:
        from werkzeug.middleware.proxy_fix import ProxyFix

        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=app.config["TRUSTED_PROXY_COUNT"])

    db.init_app(app)
    from app import models

    migrate.init_app(app, db)
    jwt.init_app(app)
    register_jwt_callbacks(jwt)
    api = init_api(app)

    from app.blueprints import register_blueprints

    register_blueprints(api)

    from app.seed import register_cli

    register_cli(app)

    from app.jobs.due import register_cli as register_job_cli

    register_job_cli(app)
    return app
