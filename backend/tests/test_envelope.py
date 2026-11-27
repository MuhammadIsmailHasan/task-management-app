import re

import pytest
from conftest import TEST_PASSWORD
from hypothesis import HealthCheck, given, settings, strategies as st

from app.common.auth import issue_token

UUID0 = "00000000-0000-0000-0000-000000000000"


def check_envelope(resp):
    body = resp.get_json()
    assert isinstance(body, dict), resp.data
    assert body["status"] is (resp.status_code < 400)
    assert isinstance(body["message"], str) and body["message"]
    if resp.status_code < 400:
        assert set(body) == {"status", "message", "data"}
    else:
        assert set(body) == {"status", "message", "error"}
        assert "message" not in body["error"] and "code" in body["error"]
        assert set(body["error"]) <= {"code", "details"}
        if body["error"]["code"] == "VALIDATION_ERROR" and "details" in body["error"]:
            assert all(isinstance(v, list) and v and all(isinstance(m, str) for m in v) for v in body["error"]["details"].values())
        else:
            assert "details" not in body["error"]
        assert resp.status_code in (400, 401, 403, 404, 405, 409, 500)
    return body


def api_rules(app):
    for rule in app.url_map.iter_rules():
        if rule.endpoint == "static" or not rule.rule.startswith("/api/"):
            continue
        if rule.rule in ("/api/docs", "/api/openapi.json") or rule.rule.startswith("/api/docs/"):
            continue
        yield rule


def test_success_and_error_shapes(client, make_user, auth):
    r = client.post("/api/auth/register", json={"full_name": "A", "username": "aaa", "email": "a@x.com", "password": TEST_PASSWORD})
    assert check_envelope(r)["message"] == "User registered"
    assert check_envelope(client.post("/api/auth/logout"))["data"] is None
    assert check_envelope(client.get("/api/boards", headers=auth(make_user("member", "env1"))))["data"] == []


def test_validation_is_400_never_422(client, make_user, auth):
    for path, body in (
        ("/api/auth/register", {}),
        ("/api/auth/register", {"full_name": "A", "username": "x", "email": "x", "password": "short"}),
        ("/api/auth/login", {"identifier": "x"}),
    ):
        r = client.post(path, json=body)
        assert r.status_code == 400
        assert check_envelope(r)["error"]["code"] == "VALIDATION_ERROR"
    manager = make_user("manager")
    r = client.post("/api/boards", headers=auth(manager), json={"name": "B", "visibility": "public"})
    assert r.status_code == 400 and "visibility" in check_envelope(r)["error"]["details"]
    r = client.post("/api/auth/login", data="{not json", content_type="application/json")
    assert r.status_code == 400
    check_envelope(r)
    b = client.post("/api/boards", headers=auth(manager), json={"name": "B"}).get_json()["data"]
    r = client.get(f"/api/boards/{b['id']}/cards?filter[priority]=urgent", headers=auth(manager))
    assert r.status_code == 400 and check_envelope(r)["error"]["code"] == "VALIDATION_ERROR"
    r = client.get(f"/api/cards/{UUID0}/comments?sort=bogus", headers=auth(manager))
    assert r.status_code == 400


def test_404_405_401_500_envelopes(app, client, make_app):
    assert client.get("/api/does-not-exist").get_json()["error"]["code"] == "NOT_FOUND"
    r = client.put("/api/boards")
    assert r.status_code == 405 and check_envelope(r)["error"]["code"] == "METHOD_NOT_ALLOWED"
    r = client.get("/api/notifications")
    assert r.status_code == 401 and check_envelope(r)["error"]["code"] == "UNAUTHORIZED"
    r = client.get("/api/notifications", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401
    check_envelope(r)

    def boom():
        raise RuntimeError("secret detail")

    other = make_app("testing")
    other.add_url_rule("/api/boom", "boom", boom)
    other.config["PROPAGATE_EXCEPTIONS"] = False
    r = other.test_client().get("/api/boom")
    body = check_envelope(r)
    assert r.status_code == 500 and body["error"]["code"] == "INTERNAL_ERROR" and "secret" not in body["message"]


def test_expired_token_is_401_envelope(app, client, make_user):
    from datetime import timedelta

    from flask_jwt_extended import create_access_token

    tok = create_access_token(identity=str(make_user().id), additional_claims={"role": "member"}, expires_delta=timedelta(seconds=-5))
    r = client.get("/api/notifications", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 401
    check_envelope(r)


def test_file_route_error_is_enveloped(client):
    r = client.get(f"/api/attachments/{UUID0}/file?exp=1&sig=bad")
    assert r.status_code in (403, 404)
    check_envelope(r)


def test_every_route_returns_envelope(app, client, make_user):
    admin = make_user("admin")
    headers = {"Authorization": f"Bearer {issue_token(admin.id, admin.role)}"}
    for rule in api_rules(app):
        path = re.sub(r"<[^>]+>", UUID0, rule.rule)
        for method in rule.methods - {"HEAD", "OPTIONS"}:
            for h in ({}, headers):
                r = client.open(path, method=method, json={} if method != "GET" else None, headers=h)
                check_envelope(r)


@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
@given(
    body=st.recursive(
        st.none() | st.booleans() | st.integers() | st.text(max_size=20),
        lambda c: st.lists(c, max_size=3) | st.dictionaries(st.sampled_from(["full_name", "username", "email", "identifier", "password", "x"]), c, max_size=4),
        max_leaves=8,
    )
)
def test_property_36_arbitrary_bodies(client, body):
    for path in ("/api/auth/register", "/api/auth/login"):
        r = client.post(path, json=body)
        assert r.status_code != 422 and r.status_code < 500
        check_envelope(r)
