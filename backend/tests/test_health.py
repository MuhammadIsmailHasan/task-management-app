import socket
import time

from app import create_app


def test_health_is_public_and_enveloped(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.get_json() == {"status": True, "message": "OK", "data": {"database": "ok"}}


def test_health_is_503_without_leaking_the_connection(app, client, monkeypatch):
    from sqlalchemy.exc import OperationalError

    from app.blueprints.health import repository

    def down():
        raise OperationalError("SELECT 1", {}, Exception("host=db.internal password=hunter2"))

    monkeypatch.setattr(repository, "ping", down)
    r = client.get("/api/health")
    assert r.status_code == 503
    assert r.get_json() == {"status": False, "message": "Database unavailable", "error": {"code": "SERVICE_UNAVAILABLE"}}


def test_health_answers_within_five_seconds_when_the_database_hangs():
    with socket.socket() as silent:
        silent.bind(("127.0.0.1", 0))
        silent.listen()
        app = create_app({"SQLALCHEMY_DATABASE_URI": f"postgresql+psycopg://probe@127.0.0.1:{silent.getsockname()[1]}/probe"})
        started = time.monotonic()
        assert app.test_client().get("/api/health").status_code == 503
        assert time.monotonic() - started < 5
