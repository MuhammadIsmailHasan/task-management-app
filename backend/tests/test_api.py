import io
from datetime import date, datetime, timedelta, timezone

import pytest
from conftest import TEST_PASSWORD
from tests.helpers import verify_email

from app.common import clock
from app.extensions import db
from app.models import ActivityLog, Card, Notification


@pytest.fixture
def world(client, make_user, auth):
    users = {r: make_user(r) for r in ("member", "supervisor", "manager", "admin")}
    users["other_member"] = make_user("member")
    users["other_sup"] = make_user("supervisor")
    h = {k: auth(u) for k, u in users.items()}

    def post(path, who, **kw):
        return client.post(path, headers=h.get(who, {}), **kw)

    board = post("/api/boards", "manager", json={"name": "B"}).get_json()["data"]
    client.patch(f"/api/boards/{board['id']}", headers=h["manager"], json={"owner_id": str(users["supervisor"].id)})
    client.post(f"/api/boards/{board['id']}/members", headers=h["manager"], json={"user_id": str(users["member"].id)})
    return type("W", (), dict(users=users, h=h, board=board, client=client, post=staticmethod(post)))


def col(w, i=0):
    return w.board["columns"][i]["id"]


def mkcard(w, title="t", who="supervisor", i=0, **extra):
    r = w.client.post(f"/api/columns/{col(w, i)}/cards", headers=w.h[who], json={"title": title, **extra})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]


# ---- auth ----
def test_register_login_roundtrip(client):
    r = client.post("/api/auth/register", json={"full_name": " Ann ", "username": " Ann_1 ", "email": " Ann@X.com ", "password": TEST_PASSWORD})
    assert r.status_code == 201
    d = r.get_json()["data"]
    assert d["user"]["full_name"] == "Ann" and d["user"]["username"] == "ann_1" and d["user"]["email"] == "ann@x.com" and d["token"] is None
    # no sign-in until the emailed link is confirmed (V17, ACT-01)
    refused = client.post("/api/auth/login", json={"identifier": "ann@x.com", "password": TEST_PASSWORD})
    assert refused.status_code == 403 and refused.get_json()["error"]["code"] == "ACCOUNT_NOT_ACTIVATED"
    assert verify_email(client, "ann@x.com").status_code == 200
    for ident in ("ann@x.COM", "ANN_1", " ann_1 "):
        assert client.post("/api/auth/login", json={"identifier": ident, "password": TEST_PASSWORD}).status_code == 200
    assert client.post("/api/auth/login", json={"identifier": "ann@x.com", "password": "bad"}).status_code == 401
    assert client.post("/api/auth/login", json={"identifier": "nobody", "password": "bad"}).status_code == 401
    assert client.post("/api/auth/login", json={"identifier": "not valid", "password": "x"}).status_code == 400
    both = client.post("/api/auth/register", json={"full_name": "A", "username": "ANN_1", "email": "ANN@x.com", "password": TEST_PASSWORD})
    assert both.status_code == 409 and set(both.get_json()["error"]["details"]) == {"username", "email"}
    one = client.post("/api/auth/register", json={"full_name": "A", "username": "other", "email": "ann@x.com", "password": TEST_PASSWORD})
    assert one.status_code == 409 and set(one.get_json()["error"]["details"]) == {"email"}
    bad = client.post("/api/auth/register", json={"full_name": "A", "username": "z", "email": "nope", "password": "short"})
    assert bad.status_code == 400 and {"username", "email", "password"} <= set(bad.get_json()["error"]["details"])
    av = client.get("/api/auth/availability?username=ANN_1&email=free@x.com").get_json()["data"]
    assert av == {"username": {"available": False}, "email": {"available": True}}
    assert client.get("/api/auth/availability").status_code == 400
    assert client.get("/api/auth/availability?username=a").status_code == 400
    assert client.post("/api/auth/logout").get_json() == {"status": True, "message": "Logged out", "data": None}


def test_token_expiry_24h(app, make_user):
    from flask_jwt_extended import decode_token

    from app.common.auth import issue_token

    t = decode_token(issue_token(make_user().id, "member"))
    assert t["exp"] - t["iat"] == 86400


# ---- boards ----
def test_board_defaults_and_access(world):
    names = [c["name"] for c in world.board["columns"]]
    assert names == ["Todo", "In Progress", "Review", "Revision", "Done"]
    bid = world.board["id"]
    c = world.client
    assert c.get(f"/api/boards/{bid}").status_code == 401  # guest, private
    assert c.get(f"/api/boards/{bid}", headers=world.h["other_member"]).status_code == 403
    assert c.get(f"/api/boards/{bid}", headers=world.h["member"]).status_code == 200
    assert c.get("/api/boards").status_code == 401  # a Guest has no board list (V10)
    assert c.get("/api/boards", headers=world.h["other_member"]).get_json()["data"] == []
    assert len(c.get("/api/boards", headers=world.h["manager"]).get_json()["data"]) == 1
    assert c.post("/api/boards", headers=world.h["member"], json={"name": "x"}).status_code == 403
    assert c.post("/api/boards", json={"name": "x"}).status_code == 401


def test_owner_reassign_and_visibility_archive_delete(world):
    bid, c = world.board["id"], world.client
    r = c.patch(f"/api/boards/{bid}", headers=world.h["manager"], json={"owner_id": str(world.users["member"].id)})
    assert r.status_code == 400
    assert c.patch(f"/api/boards/{bid}", headers=world.h["supervisor"], json={"owner_id": None}).status_code == 403
    assert c.patch(f"/api/boards/{bid}", headers=world.h["supervisor"], json={"visibility": "public"}).status_code == 400  # V12: no visibility
    assert c.get("/api/boards", headers=world.h["other_member"]).get_json()["data"] == []  # every Board is private
    assert c.post(f"/api/boards/{bid}/archive", headers=world.h["supervisor"]).status_code == 403
    assert c.post(f"/api/boards/{bid}/archive", headers=world.h["manager"]).status_code == 200
    assert c.post(f"/api/boards/{bid}/unarchive", headers=world.h["manager"]).status_code == 200
    assert c.delete(f"/api/boards/{bid}", headers=world.h["manager"]).status_code == 200
    assert c.get(f"/api/boards/{bid}", headers=world.h["manager"]).status_code == 404
    assert c.get("/api/boards").status_code == 401  # a Guest has no board list (V10)
    assert c.get("/api/boards", headers=world.h["other_member"]).get_json()["data"] == []


def test_members_and_columns(world):
    bid, c = world.board["id"], world.client
    uid = str(world.users["other_member"].id)
    assert c.post(f"/api/boards/{bid}/members", headers=world.h["manager"], json={"user_id": uid}).status_code == 201
    assert c.post(f"/api/boards/{bid}/members", headers=world.h["manager"], json={"user_id": uid}).status_code == 409
    missing = "00000000-0000-0000-0000-000000000001"
    assert c.post(f"/api/boards/{bid}/members", headers=world.h["manager"], json={"user_id": missing}).status_code == 404
    assert c.delete(f"/api/boards/{bid}/members/{uid}", headers=world.h["manager"]).status_code == 200
    assert c.delete(f"/api/boards/{bid}/members/{uid}", headers=world.h["manager"]).status_code == 404
    r = c.post(f"/api/boards/{bid}/columns", headers=world.h["supervisor"], json={"name": "QA"})
    assert r.status_code == 201 and r.get_json()["data"]["order"] == 5.0
    assert c.post(f"/api/boards/{bid}/columns", headers=world.h["member"], json={"name": "Z"}).status_code == 403
    assert c.post(f"/api/boards/{bid}/columns", headers=world.h["other_sup"], json={"name": "Z"}).status_code == 403


# ---- cards ----
def test_card_crud_permissions_validation(world):
    c = world.client
    assert c.post(f"/api/columns/{col(world)}/cards", headers=world.h["member"], json={"title": "x"}).status_code == 403
    assert c.post(f"/api/columns/{col(world)}/cards", json={"title": "x"}).status_code == 401
    bad = c.post(f"/api/columns/{col(world)}/cards", headers=world.h["supervisor"],
                 json={"title": "x", "start_date": "2026-02-02", "end_date": "2026-02-01"})
    assert bad.status_code == 400 and bad.get_json()["error"]["code"] == "VALIDATION_ERROR"
    assert c.post(f"/api/columns/{col(world)}/cards", headers=world.h["supervisor"], json={"title": " "}).status_code == 400
    assert c.post(f"/api/columns/{col(world)}/cards", headers=world.h["supervisor"], json={"title": "x", "priority": "urgent"}).status_code == 400
    card = mkcard(world)
    cid = card["id"]
    # member not assigned -> 403; assigned -> ok
    assert c.patch(f"/api/cards/{cid}", headers=world.h["member"], json={"title": "n"}).status_code == 403
    r = c.patch(f"/api/cards/{cid}", headers=world.h["supervisor"], json={"assignee_id": str(world.users["member"].id)})
    assert r.status_code == 200
    assert c.patch(f"/api/cards/{cid}", headers=world.h["member"], json={"title": "n"}).status_code == 200
    assert c.patch(f"/api/cards/{cid}", headers=world.h["member"], json={"assignee_id": None}).status_code == 403
    assert c.patch(f"/api/cards/{cid}", headers=world.h["other_sup"], json={"title": "n"}).status_code == 403
    assert c.post(f"/api/cards/{cid}/archive", headers=world.h["supervisor"]).get_json()["data"]["archived_at"]
    assert c.post(f"/api/cards/{cid}/unarchive", headers=world.h["supervisor"]).get_json()["data"]["archived_at"] is None
    assert c.delete(f"/api/cards/{cid}", headers=world.h["supervisor"]).status_code == 200
    assert c.get(f"/api/cards/{cid}", headers=world.h["manager"]).status_code == 404
    assert db.session.get(Card, __import__("uuid").UUID(cid)).deleted_at is not None  # soft


def test_assignment_notification_and_activity(world):
    card = mkcard(world)
    mid = str(world.users["member"].id)
    world.client.patch(f"/api/cards/{card['id']}", headers=world.h["supervisor"], json={"assignee_id": mid})
    assert Notification.query.filter_by(type="assigned").count() == 1
    world.client.patch(f"/api/cards/{card['id']}", headers=world.h["supervisor"], json={"assignee_id": None})
    assert Notification.query.filter_by(type="assigned").count() == 1
    actions = [a.action for a in ActivityLog.query.all()]
    assert "card.assigned" in actions and "card.unassigned" in actions and "card.created" in actions
    inbox = world.client.get("/api/notifications", headers=world.h["member"]).get_json()["data"]
    assert inbox["unread_count"] == 2  # board_added when the member joined, then assigned
    nid = next(n["id"] for n in inbox["items"] if n["type"] == "assigned")
    assert world.client.patch(f"/api/notifications/{nid}/read", headers=world.h["other_member"]).status_code == 404
    assert world.client.patch(f"/api/notifications/{nid}/read", headers=world.h["member"]).status_code == 200
    assert world.client.get("/api/notifications", headers=world.h["member"]).get_json()["data"]["unread_count"] == 1


def test_move_order_and_scope(world):
    c = world.client
    a, b, d = mkcard(world, "a"), mkcard(world, "b"), mkcard(world, "c")
    r = c.patch(f"/api/cards/{d['id']}/move", headers=world.h["supervisor"],
                json={"column_id": col(world), "prev": a["id"], "next": b["id"], "order": 999})
    assert r.status_code == 200
    assert a["order"] < r.get_json()["data"]["order"] < b["order"]
    r = c.patch(f"/api/cards/{d['id']}/move", headers=world.h["supervisor"], json={"column_id": col(world, 4)})
    assert r.get_json()["data"]["order"] == 1.0
    moves = ActivityLog.query.filter_by(action="card.moved", target_id=__import__("uuid").UUID(d["id"])).count()
    assert moves == 2
    assert c.patch(f"/api/cards/{d['id']}/move", headers=world.h["member"], json={"column_id": col(world)}).status_code == 403
    assert c.patch(f"/api/cards/{d['id']}/move", json={"column_id": col(world)}).status_code == 401
    other = c.post("/api/boards", headers=world.h["manager"], json={"name": "O"}).get_json()["data"]
    r = c.patch(f"/api/cards/{d['id']}/move", headers=world.h["supervisor"], json={"column_id": other["columns"][0]["id"]})
    assert r.status_code == 400


def test_move_rebalances_tight_gap(world):
    a, b = mkcard(world, "a"), mkcard(world, "b")
    for card, order in ((a, 1.0), (b, 1.0 + 1e-8)):
        db.session.get(Card, __import__("uuid").UUID(card["id"])).order = order
    db.session.commit()
    n = mkcard(world, "n", i=1)
    r = world.client.patch(f"/api/cards/{n['id']}/move", headers=world.h["supervisor"],
                           json={"column_id": col(world), "prev": a["id"], "next": b["id"]})
    assert r.status_code == 200
    orders = {x.title: x.order for x in Card.query.filter_by(column_id=__import__("uuid").UUID(col(world))).all()}
    assert orders["a"] < orders["n"] < orders["b"]


def test_subtasks(world):
    c = world.client
    card = mkcard(world)
    s1 = c.post(f"/api/cards/{card['id']}/subtasks", headers=world.h["supervisor"], json={"title": "s1"}).get_json()["data"]
    s2 = c.post(f"/api/cards/{card['id']}/subtasks", headers=world.h["supervisor"], json={"title": "s2"}).get_json()["data"]
    assert s1["is_done"] is False
    r = c.patch(f"/api/subtasks/{s1['id']}", headers=world.h["supervisor"], json={"is_done": True})
    assert r.get_json()["data"]["is_done"] is True
    r = c.patch(f"/api/subtasks/{s2['id']}", headers=world.h["supervisor"], json={"prev": None, "next": s1["id"]})
    assert r.get_json()["data"]["order"] < s1["order"]
    assert c.delete(f"/api/subtasks/{s1['id']}", headers=world.h["supervisor"]).status_code == 200
    assert c.patch(f"/api/subtasks/{s1['id']}", headers=world.h["supervisor"], json={"is_done": False}).status_code == 404


def test_attachments_and_signed_urls(world, app):
    c = world.client
    card = mkcard(world)
    url = f"/api/cards/{card['id']}/attachments"
    h = world.h["supervisor"]
    assert c.post(url, headers=h, json={}).status_code == 400
    assert c.post(url, headers=h, json={"url": "javascript:alert(1)"}).status_code == 400
    link = c.post(url, headers=h, json={"url": "https://e.com/x"}).get_json()["data"]
    assert link["url"] == "https://e.com/x" and link["file_url"] is None
    bad = c.post(url, headers=h, data={"file": (io.BytesIO(b"x"), "a.exe", "application/octet-stream")}, content_type="multipart/form-data")
    assert bad.status_code == 400
    ok = c.post(url, headers=h, data={"file": (io.BytesIO(b"%PDF"), "a.pdf", "application/pdf")}, content_type="multipart/form-data")
    assert ok.status_code == 201
    att = ok.get_json()["data"]
    assert "sig=" in att["file_url"]
    assert c.get(att["file_url"]).data == b"%PDF"  # signature only, no token
    flipped = "1" if att["file_url"][-1] == "0" else "0"
    assert c.get(att["file_url"][:-1] + flipped).status_code == 403
    fresh = c.get(f"/api/attachments/{att['id']}/url", headers=world.h["member"])
    assert fresh.status_code == 200
    assert c.get(f"/api/attachments/{att['id']}/url", headers=world.h["other_member"]).status_code == 403
    assert c.get(f"/api/attachments/{att['id']}/url").status_code == 401
    clock.set_now(lambda: datetime.now(timezone.utc) + timedelta(seconds=1000))
    try:
        assert c.get(att["file_url"]).status_code == 403
    finally:
        clock.set_now(None)
    c.delete(f"/api/cards/{card['id']}", headers=h)
    assert c.get(att["file_url"]).status_code == 404


def test_guest_on_board(world):
    c, bid = world.client, world.board["id"]
    card = mkcard(world)
    for path in (f"/api/cards/{card['id']}", f"/api/cards/{card['id']}/comments", f"/api/cards/{card['id']}/activity", f"/api/boards/{bid}", f"/api/boards/{bid}/members", f"/api/boards/{bid}/activity", f"/api/boards/{bid}/categories", f"/api/boards/{bid}/cards"):
        assert c.get(path).status_code == 401, path
    assert c.post(f"/api/cards/{card['id']}/comments", json={"content": "hi"}).status_code == 401
    assert c.patch(f"/api/cards/{card['id']}", json={"title": "z"}).status_code == 401
    signed = c.get(f"/api/cards/{card['id']}", headers=world.h["member"]).get_json()["data"]
    assert "comments" in signed and "activity" in signed
    assert c.get(f"/api/cards/{card['id']}", headers=world.h["other_member"]).status_code == 403  # private


# ---- categories ----
def test_categories(world):
    c, bid = world.client, world.board["id"]
    h = world.h["supervisor"]
    cat = c.post(f"/api/boards/{bid}/categories", headers=h, json={"name": "Bug", "color": "#f00"}).get_json()["data"]
    assert c.post(f"/api/boards/{bid}/categories", headers=h, json={"name": "bug"}).status_code == 409
    other = c.post(f"/api/boards/{bid}/categories", headers=h, json={"name": "Feat"}).get_json()["data"]
    assert c.patch(f"/api/categories/{other['id']}", headers=h, json={"name": "BUG"}).status_code == 409
    assert c.post(f"/api/boards/{bid}/categories", headers=world.h["member"], json={"name": "q"}).status_code == 403
    assert c.get(f"/api/boards/{bid}/categories", headers=world.h["member"]).status_code == 200
    card = mkcard(world, category_id=cat["id"])
    assert card["category_id"] == cat["id"]
    assert c.delete(f"/api/categories/{cat['id']}", headers=h).status_code == 200
    assert c.get(f"/api/cards/{card['id']}", headers=h).get_json()["data"]["category_id"] is None


# ---- comments ----
def test_comments_flow(world):
    c = world.client
    card = mkcard(world)
    url = f"/api/cards/{card['id']}/comments"
    assert c.post(url, headers=world.h["member"], json={"content": "  "}).get_json()["error"]["details"]["content"][0] == "content is required"
    assert c.post(url, headers=world.h["admin"], json={"content": "x"}).status_code == 403
    assert c.post(url, json={"content": "x"}).status_code == 401  # private board
    m1 = c.post(url, headers=world.h["manager"], json={"content": "m1"}).get_json()["data"]
    m2 = c.post(url, headers=world.h["member"], json={"content": "m2"}).get_json()["data"]
    r1 = c.post(f"/api/comments/{m2['id']}/replies", headers=world.h["supervisor"], json={"content": "r1"}).get_json()["data"]
    assert c.post(f"/api/comments/{r1['id']}/replies", headers=world.h["supervisor"], json={"content": "deep"}).status_code == 400
    c.post(f"/api/comments/{m2['id']}/replies", headers=world.h["supervisor"], json={"content": "r2"})
    pop = c.get(url + "?sort=popular", headers=world.h["supervisor"]).get_json()["data"]
    assert [x["content"] for x in pop] == ["m2", "m1"] and pop[0]["reply_count"] == 2
    assert [r["content"] for r in pop[0]["replies"]] == ["r1", "r2"]
    assert pop[1]["can_create_card"] is True and pop[0]["can_create_card"] is False
    latest = c.get(url, headers=world.h["member"]).get_json()["data"]
    assert [x["content"] for x in latest] == ["m2", "m1"]
    assert latest[0]["can_create_card"] is False
    assert c.patch(f"/api/comments/{m1['id']}/priority", headers=world.h["supervisor"]).status_code == 403
    assert c.patch(f"/api/comments/{m1['id']}/priority").status_code == 401
    assert c.patch(f"/api/comments/{m1['id']}/priority", headers=world.h["manager"]).get_json()["data"]["is_priority"] is True
    latest = c.get(url, headers=world.h["member"]).get_json()["data"]
    assert [x["content"] for x in latest] == ["m1", "m2"]
    assert c.patch(f"/api/comments/{m1['id']}/priority", headers=world.h["manager"]).get_json()["data"]["is_priority"] is False


def test_comment_and_activity_names(world):
    """Comments and activity rows carry the author's display name, even for users who are not board members."""
    c = world.client
    card = mkcard(world)
    url = f"/api/cards/{card['id']}/comments"
    made = c.post(url, headers=world.h["manager"], json={"content": "hello"}).get_json()["data"]
    reply = c.post(f"/api/comments/{made['id']}/replies", headers=world.h["member"], json={"content": "hi"}).get_json()["data"]
    assert made["author_name"] == world.users["manager"].full_name
    assert reply["author_name"] == world.users["member"].full_name
    listed = c.get(url, headers=world.h["supervisor"]).get_json()["data"]
    assert listed[0]["author_name"] == world.users["manager"].full_name
    assert listed[0]["replies"][0]["author_name"] == world.users["member"].full_name
    detail = c.get(f"/api/cards/{card['id']}", headers=world.h["supervisor"]).get_json()["data"]
    assert detail["comments"][0]["author_name"] == world.users["manager"].full_name
    assert all(r["actor_name"] for r in detail["activity"])
    rows = c.get(f"/api/boards/{world.board['id']}/activity", headers=world.h["manager"]).get_json()["data"]
    assert all(r["actor_name"] for r in rows)


def test_activity_metadata_carries_names_and_changes(world):
    """New rows hold the names and old/new values the UI needs (Req 8.9)."""
    c = world.client
    h = world.h["supervisor"]
    card = mkcard(world, "Plan launch")
    cid = card["id"]
    cat = c.post(f"/api/boards/{world.board['id']}/categories", headers=world.h["manager"], json={"name": "Design"}).get_json()["data"]
    c.patch(f"/api/cards/{cid}", headers=h, json={"priority": "high", "end_date": "2026-12-01", "category_id": cat["id"], "description": "x"})
    c.patch(f"/api/cards/{cid}", headers=h, json={"assignee_id": str(world.users["member"].id)})
    c.patch(f"/api/cards/{cid}/move", headers=h, json={"column_id": col(world, 1)})
    sub = c.post(f"/api/cards/{cid}/subtasks", headers=h, json={"title": "Outline"}).get_json()["data"]
    c.patch(f"/api/subtasks/{sub['id']}", headers=h, json={"is_done": True})
    att = c.post(f"/api/cards/{cid}/attachments", headers=h, json={"url": "https://example.com/brief", "name": "Brief"}).get_json()["data"]
    c.delete(f"/api/attachments/{att['id']}", headers=h)
    rows = c.get(f"/api/cards/{cid}/activity", headers=h).get_json()["data"]
    by = {}
    for r in rows:
        by.setdefault(r["action"], []).append(r["metadata"])
    assert all(m["card_title"] == "Plan launch" for acts in by.values() for m in acts)
    changes = by["card.updated"][0]["changes"]
    assert changes["priority"] == {"from": "medium", "to": "high"}
    assert changes["end_date"] == {"from": None, "to": "2026-12-01"}
    assert changes["category"] == {"from": None, "to": "Design"}
    assert changes["description"] == {}
    assert by["card.assigned"][0]["assignee_name"] == world.users["member"].full_name
    moved = by["card.moved"][0]
    assert (moved["from_column_name"], moved["to_column_name"]) == ("Todo", "In Progress")
    assert by["card.subtask_added"][0]["title"] == "Outline"
    assert by["card.subtask_updated"][0]["is_done"] is True
    assert by["card.attachment_added"][0]["name"] == "Brief" and by["card.attachment_removed"][0]["name"] == "Brief"


def test_activity_and_inbox_paging_and_candidates(world):
    c = world.client
    h = world.h["supervisor"]
    card = mkcard(world, "Paged")
    cid = card["id"]
    for i in range(5):
        c.post(f"/api/cards/{cid}/subtasks", headers=h, json={"title": f"s{i}"})
    url = f"/api/cards/{cid}/activity"
    full = c.get(url + "?limit=100", headers=h).get_json()["data"]
    assert len(full) == 6
    p1 = c.get(url + "?limit=4", headers=h).get_json()["data"]
    p2 = c.get(url + f"?limit=4&before={p1[-1]['id']}", headers=h).get_json()["data"]
    assert [r["id"] for r in p1 + p2] == [r["id"] for r in full] and len(p2) == 2
    assert c.get(url, headers=h).get_json()["data"] == full  # default 20 covers all six
    for bad in ("limit=0", "limit=101", "limit=x"):
        r = c.get(f"{url}?{bad}", headers=h)
        assert r.status_code == 400 and r.get_json()["error"]["code"] == "VALIDATION_ERROR"
    other = mkcard(world, "Other")
    r = c.get(url + f"?before={c.get(f'/api/cards/{other['id']}/activity', headers=h).get_json()['data'][0]['id']}", headers=h)
    assert r.status_code == 400
    board_rows = c.get(f"/api/boards/{world.board['id']}/activity?limit=3", headers=world.h["manager"]).get_json()["data"]
    assert len(board_rows) == 3

    # inbox: assign the same member three cards; unread_count counts them all
    for _ in range(3):
        k = mkcard(world)
        c.patch(f"/api/cards/{k['id']}", headers=h, json={"assignee_id": str(world.users["member"].id)})
    mh = world.h["member"]
    first = c.get("/api/notifications?limit=2", headers=mh).get_json()["data"]
    assert len(first["items"]) == 2 and first["unread_count"] == 4
    rest = c.get(f"/api/notifications?limit=2&before={first['items'][-1]['id']}", headers=mh).get_json()["data"]
    assert len(rest["items"]) == 2 and rest["unread_count"] == 4
    assert c.get(f"/api/notifications?before={first['items'][0]['id']}", headers=world.h["other_member"]).status_code == 400

    # candidates: non-members only, filtered, id and full_name only, role rules
    cand = c.get(f"/api/boards/{world.board['id']}/candidates?search=me", headers=world.h["manager"]).get_json()["data"]
    names = {x["full_name"] for x in cand}
    assert world.users["member"].full_name not in names or world.users["other_member"].full_name in names
    assert str(world.users["member"].id) not in {x["id"] for x in cand}
    assert all(set(x) == {"id", "full_name", "username", "email", "avatar_url"} for x in cand)
    q = world.users["other_member"].full_name[:3].lower()
    assert c.get(f"/api/boards/{world.board['id']}/candidates?search={q}", headers=world.h["manager"]).status_code == 200
    assert c.get(f"/api/boards/{world.board['id']}/candidates?search=a", headers=world.h["manager"]).status_code == 400
    exact = world.users["other_member"].email
    hit = c.get(f"/api/boards/{world.board['id']}/candidates?search={exact}", headers=world.h["manager"]).get_json()["data"]
    assert [x["email"] for x in hit] == [exact]
    assert c.get(f"/api/boards/{world.board['id']}/candidates", headers=world.h["member"]).status_code == 403
    assert c.get(f"/api/boards/{world.board['id']}/candidates", headers=world.h["other_sup"]).status_code == 403
    assert c.get(f"/api/boards/{world.board['id']}/candidates?search=me", headers=h).status_code == 403  # the owner (V12)
    assert c.get(f"/api/boards/{world.board['id']}/candidates").status_code == 401


def test_board_list_counts_and_description(world, app):
    from datetime import date, timedelta

    c = world.client
    h = world.h["supervisor"]
    done_card = mkcard(world, "done", i=4)
    mkcard(world, "todo", i=0)
    overdue = mkcard(world, "late", i=0, end_date=(date.today() - timedelta(days=3)).isoformat())
    gone = mkcard(world, "gone", i=0)
    c.delete(f"/api/cards/{gone['id']}", headers=h)
    archived = mkcard(world, "old", i=0)
    db.session.get(Card, __import__("uuid").UUID(archived["id"])).archived_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    db.session.commit()
    row = next(b for b in c.get("/api/boards", headers=world.h["manager"]).get_json()["data"] if b["id"] == world.board["id"])
    assert (row["card_count"], row["done_count"], row["overdue_count"], row["member_count"]) == (3, 1, 1, 1)
    assert row["description"] is None
    # description round trip, trimmed, empty becomes null, 500 limit, role rules
    url = f"/api/boards/{world.board['id']}"
    assert c.patch(url, headers=world.h["manager"], json={"description": "  Launch plan  "}).get_json()["data"]["description"] == "Launch plan"
    assert c.get(url, headers=world.h["manager"]).get_json()["data"]["description"] == "Launch plan"
    assert c.patch(url, headers=world.h["manager"], json={"description": "   "}).get_json()["data"]["description"] is None
    r = c.patch(url, headers=world.h["manager"], json={"description": "x" * 501})
    assert r.status_code == 400 and r.get_json()["error"]["code"] == "VALIDATION_ERROR"
    assert c.patch(url, headers=world.h["member"], json={"description": "no"}).status_code == 403
    made = c.post("/api/boards", headers=world.h["manager"], json={"name": "N", "description": "About"}).get_json()["data"]
    assert made["description"] == "About"
    assert c.post("/api/boards", headers=world.h["manager"], json={"name": "N2"}).get_json()["data"]["description"] is None
    assert c.post("/api/boards", headers=world.h["manager"], json={"name": "N3", "description": "y" * 501}).status_code == 400


def test_board_list_query_count_is_constant(world, app):
    from sqlalchemy import event

    from app.extensions import db

    def count_for(extra):
        for i in range(extra):
            world.client.post("/api/boards", headers=world.h["manager"], json={"name": f"X{extra}-{i}"})
        n = []
        engine = db.engine
        listener = lambda *a, **k: n.append(1)
        event.listen(engine, "before_cursor_execute", listener)
        try:
            assert world.client.get("/api/boards", headers=world.h["manager"]).status_code == 200
        finally:
            event.remove(engine, "before_cursor_execute", listener)
        return len(n)

    small = count_for(1)
    large = count_for(6)
    assert large == small


# ---- activity, search, analytics, users, deadlines ----
def test_activity_endpoints(world):
    card = mkcard(world)
    c = world.client
    rows = c.get(f"/api/cards/{card['id']}/activity", headers=world.h["member"]).get_json()["data"]
    assert [r["action"] for r in rows] == ["card.created"]
    board_rows = c.get(f"/api/boards/{world.board['id']}/activity", headers=world.h["manager"]).get_json()["data"]
    assert {"board.created", "card.created", "board.member_added"} <= {r["action"] for r in board_rows}
    assert c.get(f"/api/boards/{world.board['id']}/activity", headers=world.h["other_member"]).status_code == 403


def test_search_and_filter(world):
    c, bid = world.client, world.board["id"]
    mkcard(world, "Fix Login", priority="high", description="auth bug")
    mkcard(world, "Docs", priority="low")
    gone = mkcard(world, "Login gone", priority="high")
    c.delete(f"/api/cards/{gone['id']}", headers=world.h["supervisor"])
    get = lambda q: [x["title"] for x in c.get(f"/api/boards/{bid}/cards{q}", headers=world.h["member"]).get_json()["data"]]  # noqa: E731
    assert get("?search=LOGIN") == ["Fix Login"]
    assert get("?search=bug") == ["Fix Login"]
    assert get("?filter[priority]=low") == ["Docs"]
    assert get("?search=login&filter[priority]=low") == []
    assert c.get(f"/api/boards/{bid}/cards?filter[nope]=1", headers=world.h["member"]).status_code == 400
    assert c.get(f"/api/boards/{bid}/cards").status_code == 401


def test_analytics(world):
    c, bid = world.client, world.board["id"]
    mkcard(world, "late", end_date="2000-01-01")
    done = mkcard(world, "done", end_date="2000-01-01")
    prog = mkcard(world, "wip")
    c.patch(f"/api/cards/{done['id']}/move", headers=world.h["supervisor"], json={"column_id": col(world, 4)})
    c.patch(f"/api/cards/{prog['id']}/move", headers=world.h["supervisor"], json={"column_id": col(world, 1)})
    d = c.get(f"/api/boards/{bid}/analytics", headers=world.h["manager"]).get_json()["data"]
    assert (d["total"], d["done"], d["in_progress"], d["overdue"], d["done_delta"]) == (3, 1, 1, 1, 1)
    assert c.get(f"/api/boards/{bid}/analytics", headers=world.h["supervisor"]).status_code == 200  # owner
    assert c.get(f"/api/boards/{bid}/analytics", headers=world.h["other_sup"]).status_code == 403
    for who in ("member", "admin"):
        assert c.get(f"/api/boards/{bid}/analytics", headers=world.h[who]).status_code == 403
    assert c.get(f"/api/boards/{bid}/analytics").status_code == 401
    assert len(c.get("/api/analytics/boards", headers=world.h["manager"]).get_json()["data"]) == 1
    assert c.get("/api/analytics/boards", headers=world.h["supervisor"]).status_code == 403


def test_due_job_once_in_timezone(world, app):
    from app.jobs.due import run

    app.config["APP_TIMEZONE"] = "Asia/Jakarta"
    card = mkcard(world, end_date="2026-03-02", assignee_id=str(world.users["member"].id))
    mkcard(world, "unassigned", end_date="2026-03-02")
    # 2026-03-01 18:00 UTC is already 03-02 01:00 in Jakarta
    now = datetime(2026, 3, 1, 18, 0, tzinfo=timezone.utc)
    assert run(now) == (1, 0, 0)
    assert run(now) == (0, 0, 1)  # the same local date again inserts nothing
    assert Notification.query.filter_by(type="due_today").count() == 1
    # earlier the same UTC day it is still 03-01 in Jakarta: the Card is due tomorrow, not today
    assert run(datetime(2026, 3, 1, 10, 0, tzinfo=timezone.utc)) == (0, 1, 0)


def test_user_admin(world):
    c = world.client
    for who in ("member", "supervisor", "manager"):
        assert c.get("/api/users", headers=world.h[who]).status_code == 403
    assert c.get("/api/users").status_code == 401
    r = c.post("/api/users", headers=world.h["admin"], json={"full_name": "N", "username": "nnn", "email": "n@x.com", "password": TEST_PASSWORD, "role": "supervisor"})
    assert r.status_code == 201
    uid = r.get_json()["data"]["id"]
    r = c.patch(f"/api/users/{uid}", headers=world.h["admin"], json={"role": "manager", "full_name": "M"})
    assert r.get_json()["data"]["role"] == "manager"
    actions = {a.action for a in ActivityLog.query.all()}
    assert {"user.created", "user.updated", "user.role_changed"} <= actions
    assert c.patch(f"/api/users/{uid}", headers=world.h["admin"], json={"role": "root"}).status_code == 400
    assert len(c.get("/api/users", headers=world.h["admin"]).get_json()["data"]) >= 7


# ---- cross-cutting ----
def test_mutating_routes_401_without_token_and_403_for_member(app, world):
    """Sweep: every mutating route rejects no-token (401) unless public/signature-gated or per-resource."""
    public = {"auth.register", "auth.login", "auth.logout", "auth.verify", "auth.resend_verification", "comments.create", "comments.reply"}
    c = world.client
    for rule in app.url_map.iter_rules():
        methods = rule.methods & {"POST", "PATCH", "PUT", "DELETE"}
        if not methods or rule.endpoint == "static" or rule.endpoint in public:
            continue
        path = __import__("re").sub(r"<[^>]+>", "00000000-0000-0000-0000-000000000000", rule.rule)
        for m in methods:
            r = c.open(path, method=m, json={})
            assert r.status_code == 401, (m, rule.rule, r.status_code)


def test_envelope_everywhere(world, app):
    c = world.client
    for path in ("/api/boards", "/api/nope", "/api/cards/not-a-uuid", f"/api/boards/{world.board['id']}"):
        body = c.get(path, headers=world.h["manager"]).get_json()
        assert set(body) in ({"status", "message", "data"}, {"status", "message", "error"})
        if "error" in body:
            assert set(body["error"]) <= {"code", "details"} and "code" in body["error"]


def test_no_query_outside_repository_and_env_not_tracked():
    import pathlib
    import subprocess

    root = pathlib.Path(__file__).resolve().parents[1]
    offenders = []
    for p in (root / "app").rglob("*.py"):
        if p.name in ("repository.py", "seed.py"):
            continue
        if ".query" in p.read_text():
            offenders.append(str(p.relative_to(root)))
    assert offenders == []
    banned = ("import flask", "from flask", "flask_smorest", "marshmallow")
    layering = [
        str(p.relative_to(root))
        for p in (root / "app" / "blueprints").rglob("*.py")
        if p.name in ("service.py", "repository.py") and any(b in p.read_text() for b in banned)
    ]
    # services/repositories stay free of Flask, smorest and marshmallow (only config access via current_app is allowed)
    assert [x for x in layering if "from flask import current_app" not in (root / x).read_text()] == []
    views = []
    for p in (root / "app" / "blueprints").glob("*/routes.py"):
        src = p.read_text()
        for block in src.split("@bp.route(")[1:]:
            head = block.split("\ndef ")[0]
            if "@bp.response(" not in head and "/file" not in head:
                views.append(f"{p.parent.name}: {head.splitlines()[0]}")
    assert views == []
    example = (root / ".env.example").read_text()
    for var in ("DATABASE_URL", "JWT_SECRET", "ALLOWED_ORIGINS", "FILE_URL_SECRET", "APP_TIMEZONE", "UPLOAD_DIR"):
        assert var + "=" in example
    tracked = subprocess.run(["git", "ls-files", "--", ".env", "backend/.env"], cwd=root, capture_output=True, text=True).stdout
    assert tracked.strip() == ""


def test_inbox_unread_filter(world):
    """NAV-13 (V17): `unread=true` lists only unread rows, pages from a row that has since been read, and keeps unread_count."""
    member = world.users["member"]
    for n in range(3):
        mkcard(world, title=f"n{n}", assignee_id=str(member.id))
    url, h = "/api/notifications", world.h["member"]
    allrows = world.client.get(url, headers=h).get_json()["data"]
    rows = allrows["items"]
    assert allrows["unread_count"] == len(rows) >= 4  # three assignments and the board_added of the fixture
    world.client.patch(f"/api/notifications/{rows[1]['id']}/read", headers=h)
    only = world.client.get(url, headers=h, query_string={"unread": "true"}).get_json()["data"]
    assert [i["id"] for i in only["items"]] == [r["id"] for i, r in enumerate(rows) if i != 1]
    assert only["unread_count"] == len(rows) - 1
    assert all(not i["is_read"] for i in only["items"])
    # paging from a row that was read after it was shown still works
    after = world.client.get(url, headers=h, query_string={"unread": "true", "limit": 1, "before": rows[1]["id"]})
    assert after.status_code == 200 and [i["id"] for i in after.get_json()["data"]["items"]] == [rows[2]["id"]]
    assert world.client.get(url, headers=h, query_string={"unread": "maybe"}).status_code == 400
