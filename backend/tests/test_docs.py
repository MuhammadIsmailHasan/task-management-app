import json
import re

import pytest


def documented(spec):
    return {(m.upper(), p) for p, ops in spec["paths"].items() for m in ops if m in ("get", "post", "patch", "put", "delete")}


def registered(app):
    out = set()
    for rule in app.url_map.iter_rules():
        if rule.endpoint == "static" or not rule.rule.startswith("/api/") or rule.rule in ("/api/docs", "/api/openapi.json") or rule.rule.startswith("/api/docs/"):
            continue
        path = re.sub(r"<(?:[^:>]+:)?([^>]+)>", r"{\1}", rule.rule)
        for m in rule.methods - {"HEAD", "OPTIONS"}:
            out.add((m, path))
    return out


@pytest.mark.parametrize("env", ["development", "testing"])
def test_docs_served_in_dev_and_testing(make_app, env):
    c = make_app(env).test_client()
    assert c.get("/api/docs").status_code == 200
    r = c.get("/api/openapi.json")
    assert r.status_code == 200 and r.get_json()["openapi"].startswith("3.")


@pytest.mark.parametrize("env", ["production", "", "staging", "anything"])
def test_docs_hidden_otherwise(make_app, env):
    c = make_app(env).test_client()
    for path in ("/api/docs", "/api/openapi.json"):
        r = c.get(path)
        assert r.status_code == 404 and r.get_json()["error"]["code"] == "NOT_FOUND"


def test_unset_app_env_defaults_to_production(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.setenv("MAIL_BACKEND", "console")
    from app import create_app

    app = create_app({"TESTING": True})
    assert app.config["APP_ENV"] == "production"
    assert app.test_client().get("/api/docs").status_code == 404


def test_every_route_is_documented_and_reverse(app):
    spec = app.extensions["api"].spec.to_dict()
    assert registered(app) == documented(spec)


def test_spec_has_bearer_and_error_responses(app):
    spec = app.extensions["api"].spec.to_dict()
    assert spec["components"]["securitySchemes"]["bearerAuth"]["scheme"] == "bearer"
    op = spec["paths"]["/api/cards/{card_id}"]["patch"]
    assert op["security"] == [{"bearerAuth": []}]
    assert {"400", "401", "403", "404"} <= set(op["responses"])
    assert spec["paths"]["/api/auth/login"]["post"]["security"] == []
    assert "201" in spec["paths"]["/api/auth/register"]["post"]["responses"]


def test_committed_openapi_json_is_current(app):
    import pathlib

    committed = pathlib.Path(__file__).resolve().parents[1] / "openapi.json"
    assert committed.exists(), "run: flask export-openapi"
    def canon(text):
        return json.loads(text.replace("UNPROCESSABLE_CONTENT", "UNPROCESSABLE_ENTITY").replace("Unprocessable Content", "Unprocessable Entity"))

    assert canon(committed.read_text()) == canon(json.dumps(app.extensions["api"].spec.to_dict()))
