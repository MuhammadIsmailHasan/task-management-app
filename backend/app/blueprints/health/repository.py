from flask import current_app
from sqlalchemy import create_engine, make_url, text
from sqlalchemy.pool import NullPool


def _engine():
    """An engine apart from the request pool, so a busy or hung pool cannot stall the check.

    The connect timeout applies to each address (`localhost` has two), so 2 seconds each plus 1 for the query stays within 5.
    """
    engine = current_app.extensions.get("health_engine")
    if engine is None:
        url = make_url(current_app.config["SQLALCHEMY_DATABASE_URI"])
        args = {}
        if url.get_backend_name() == "postgresql":
            args = {"connect_timeout": 2, "options": "-c statement_timeout=900"}
        engine = create_engine(url, poolclass=NullPool, connect_args=args)
        current_app.extensions["health_engine"] = engine
    return engine


def ping():
    with _engine().connect() as connection:
        connection.execute(text("SELECT 1"))
