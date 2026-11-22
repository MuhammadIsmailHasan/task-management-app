import logging

from sqlalchemy.exc import SQLAlchemyError

from app.blueprints.health import repository as repo
from app.common.errors import ServiceUnavailable

log = logging.getLogger(__name__)


def check():
    try:
        repo.ping()
    except SQLAlchemyError as exc:
        log.warning("Health check failed: %s", type(exc).__name__)  # the message can hold the host and the user
        raise ServiceUnavailable("Database unavailable") from exc
    return {"database": "ok"}
