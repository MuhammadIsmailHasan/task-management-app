"""Properties 3, 4, 5 and 51 and the Board_Access matrix (V12: every Board is private)."""
import pytest
from hypothesis import given, strategies as st

from helpers import PROP, RELATIONS, STAFF, UUID0, Env


def can_access(rel):
    return rel in {"manager", "admin", "owner", "sup_member", "member"}  # a Guest reads nothing here (V10); no public Boards (V12)


def denied(rel):
    return 401 if rel == "guest" else 403


def oracle(action, rel):
    acc = can_access(rel)
    if action in ("get_board", "list_categories", "search", "attachment_url"):
        return 200 if acc else denied(rel)
    if action in ("create_column", "create_category"):
        if rel == "guest":
            return 401
        if not acc:
            return 403
        if action == "create_column":  # V17: the Board_Owner, a Manager, and an Admin only (COL-01)
            return 201 if rel in {"manager", "admin", "owner"} else 403
        return 201 if rel in STAFF else 403
    if action == "comment":
        if not acc:
            return denied(rel)
        return 201 if rel in {"manager", "owner", "sup_member", "sup_other", "member", "member_other"} else 403
    if action == "analytics":
        if rel == "guest":
            return 401
        return 200 if rel in ("manager", "owner") else 403
    if action == "activity":
        if not acc:
            return denied(rel)
        return 403 if rel == "guest" else 200
    raise AssertionError(action)


ACTIONS = ("get_board", "list_categories", "search", "attachment_url", "create_column", "create_category", "comment", "analytics", "activity")


def call(env, action, rel, ids):
    c, h = env.c, env.h[rel]
    if action == "get_board":
        return c.get(f"/api/boards/{env.bid}", headers=h)
    if action == "list_categories":
        return c.get(f"/api/boards/{env.bid}/categories", headers=h)
    if action == "search":
        return c.get(f"/api/boards/{env.bid}/cards", headers=h)
    if action == "attachment_url":
        return c.get(f"/api/attachments/{ids['att']}/url", headers=h)
    if action == "create_column":
        return c.post(f"/api/boards/{env.bid}/columns", headers=h, json={"name": "C"})
    if action == "create_category":
        return c.post(f"/api/boards/{env.bid}/categories", headers=h, json={"name": "K"})
    if action == "comment":
        return c.post(f"/api/cards/{ids['card']}/comments", headers=h, json={"content": "x"})
    if action == "analytics":
        return c.get(f"/api/boards/{env.bid}/analytics", headers=h)
    if action == "activity":
        return c.get(f"/api/cards/{ids['card']}/activity", headers=h)


def test_board_access_matrix_exhaustive(client):
    """Properties 3, 4, 5 and tasks 4.3, 14.3: every relation x action on public and private boards."""
    for rel in RELATIONS:
        for action in ACTIONS:
            env = Env(client)
            card = env.card()
            att = client.post(f"/api/cards/{card['id']}/attachments", headers=env.h["manager"], json={"url": "https://e.com/x"}).get_json()["data"]
            r = call(env, action, rel, {"card": card["id"], "att": att["id"]})
            assert r.status_code == oracle(action, rel), (rel, action, r.get_json())
            body = r.get_json()
            assert body["status"] is (r.status_code < 400)


@PROP
@given(rel=st.sampled_from(RELATIONS), action=st.sampled_from(ACTIONS))
def test_property_4_board_access_function(client, rel, action):
    env = Env(client)
    card = env.card()
    att = client.post(f"/api/cards/{card['id']}/attachments", headers=env.h["manager"], json={"url": "https://e.com/x"}).get_json()["data"]
    assert call(env, action, rel, {"card": card["id"], "att": att["id"]}).status_code == oracle(action, rel)


@PROP
@given(rel=st.sampled_from(RELATIONS))
def test_property_5_401_vs_403_vs_404(client, rel):
    env = Env(client)
    # unknown or malformed ids are 404 for any caller who passes the role gate
    expected = 401 if rel == "guest" else 404  # a Guest has no Token: 401 comes before any lookup (V10)
    for path in (f"/api/boards/{UUID0}", "/api/boards/not-a-uuid"):
        r = client.get(path, headers=env.h[rel])
        assert r.status_code == expected
    # a soft-deleted board is 404 for everyone, including its owner and managers
    client.delete(f"/api/boards/{env.bid}", headers=env.h["manager"])
    assert client.get(f"/api/boards/{env.bid}", headers=env.h[rel]).status_code == expected
    # no Token on a protected endpoint is 401, a Token without the role is 403
    assert client.get("/api/notifications").status_code == 401
    assert client.get("/api/users", headers=env.h["manager"]).status_code == 403
    assert client.get("/api/users").status_code == 401


@PROP
@given(rel=st.sampled_from(RELATIONS))
def test_property_51_board_access_and_list(client, rel):
    env = Env(client)
    other = client.post("/api/boards", headers=env.h["manager"], json={"name": "P"}).get_json()["data"]
    gone = client.post("/api/boards", headers=env.h["manager"], json={"name": "G"}).get_json()["data"]
    client.delete(f"/api/boards/{gone['id']}", headers=env.h["manager"])
    listing = client.get("/api/boards", headers=env.h[rel])
    if rel == "guest":
        assert listing.status_code == 401
        return
    ids = {b["id"] for b in listing.get_json()["data"]}
    # Manager and Admin see every live Board; everyone else sees only the Boards they own or belong to
    expected = {other["id"], env.bid} if rel in ("manager", "admin") else ({env.bid} if can_access(rel) else set())
    assert ids == expected
    assert all("visibility" not in b for b in listing.get_json()["data"])
    if rel in ("manager", "admin"):
        assert "visibility" not in client.get(f"/api/boards/{env.bid}", headers=env.h[rel]).get_json()["data"]
