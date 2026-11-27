import pytest

from app.extensions import db
from app.models import Subtask
from helpers import Env, UUID0, mkuser, hdr, reset_db


def test_users_are_ordered_by_role_then_name_and_paged(client):
    env = Env(client)
    for i in range(7):
        mkuser("member")
    got = []
    page = 1
    while True:
        r = client.get(f"/api/users?page={page}&per_page=4", headers=env.h["admin"]).get_json()["data"]
        got += r["items"]
        assert r["total"] == 14 and r["per_page"] == 4
        if len(got) >= r["total"]:
            break
        page += 1
    assert len({u["id"] for u in got}) == 14
    order = {"admin": 0, "manager": 1, "supervisor": 2, "member": 3}
    keys = [(order[u["role"]], u["full_name"].lower(), u["id"]) for u in got]
    assert keys == sorted(keys)
    beyond = client.get("/api/users?page=99", headers=env.h["admin"]).get_json()["data"]
    assert beyond["items"] == [] and beyond["total"] == 14


@pytest.mark.parametrize("query", ["page=0", "per_page=0", "per_page=101", "page=x"])
def test_users_paging_validation(client, query):
    env = Env(client)
    r = client.get(f"/api/users?{query}", headers=env.h["admin"])
    assert r.status_code == 400 and r.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_boards_search_and_sort(client):
    env = Env(client)
    m = env.h["manager"]
    for name in ("Sales plan", "100%_done", "Marketing"):
        client.post("/api/boards", headers=m, json={"name": name})
    names = lambda q="": [b["name"] for b in client.get(f"/api/boards{q}", headers=m).get_json()["data"]]
    assert set(names("?q=SALES")) == {"Sales plan"}
    assert names("?q=%25") == ["100%_done"]
    assert names("?q=_") == ["100%_done"]
    assert names("?q=nothing") == []
    assert sorted(names("?sort=created_at&order=asc")) == sorted(names("?sort=created_at&order=desc")) == sorted(names())
    for bad in ("sort=name", "order=up", "q=" + "x" * 101):
        assert client.get(f"/api/boards?{bad}", headers=m).status_code == 400


def test_a_column_change_moves_the_board_updated_at(client):
    from datetime import datetime, timezone

    from app.common import clock
    from app.models import Board

    env = Env(client)
    clock.set_now(lambda: datetime(2031, 1, 1, tzinfo=timezone.utc))
    try:
        client.post(f"/api/boards/{env.bid}/columns", headers=env.h["manager"], json={"name": "Extra"})
    finally:
        clock.set_now(None)
    db.session.expire_all()
    assert db.session.get(Board, __import__("uuid").UUID(env.bid)).updated_at.year == 2031


def test_admin_reads_the_dashboard_and_a_member_does_not(client):
    env = Env(client)
    assert client.get("/api/analytics/dashboard", headers=env.h["admin"]).status_code == 200
    assert client.get(f"/api/analytics/dashboard?board={env.bid}", headers=env.h["admin"]).status_code == 200
    assert client.get("/api/analytics/dashboard", headers=env.h["member"]).status_code == 403


def test_a_supervisor_still_sees_only_the_boards_it_owns(client):
    env = Env(client)
    assert client.get(f"/api/analytics/dashboard?board={env.bid}", headers=env.h["sup_member"]).status_code == 403
    assert client.get(f"/api/analytics/dashboard?board={env.bid}", headers=env.h["owner"]).status_code == 200


def test_my_tasks_and_assignment_are_closed_to_manager_and_admin(client):
    env = Env(client)
    assert client.get("/api/me/cards", headers=env.h["manager"]).status_code == 403
    assert client.get("/api/me/cards", headers=env.h["admin"]).status_code == 403
    assert client.get("/api/me/cards", headers=env.h["member"]).status_code == 200
    card = env.card()
    for who in ("manager", "admin"):
        r = client.patch(f"/api/cards/{card['id']}", headers=env.h["owner"], json={"assignee_id": env.uid(who)})
        assert r.status_code == 400 and "assignee_id" in r.get_json()["error"]["details"]


def test_comments_page_covers_every_comment_once(client):
    env = Env(client)
    card = env.card(assignee_id=env.uid("member"))
    url = f"/api/cards/{card['id']}/comments"
    for i in range(7):
        c = client.post(url, headers=env.h["member"], json={"content": f"c{i}"}).get_json()["data"]
        client.post(f"/api/comments/{c['id']}/replies", headers=env.h["manager"], json={"content": "r"})
    seen, offset = [], 0
    while True:
        r = client.get(f"{url}?limit=3&offset={offset}", headers=env.h["member"]).get_json()["data"]
        assert r["total"] == 7 and all(len(c["replies"]) == 1 for c in r["items"])
        seen += [c["id"] for c in r["items"]]
        offset += 3
        if offset >= r["total"]:
            break
    full = client.get(url, headers=env.h["member"]).get_json()["data"]
    assert seen == [c["id"] for c in full["items"]] and len(set(seen)) == 7 and full["total"] == 7
    assert client.get(f"{url}?limit=0", headers=env.h["member"]).status_code == 400
    assert client.get(f"{url}?limit=51", headers=env.h["member"]).status_code == 400


def _post(client, who, env, path, body=None):
    return client.post(path, headers=env.h[who], json=body or {})


@pytest.fixture
def card_env(client):
    env = Env(client)
    card = env.card(assignee_id=env.uid("member"))
    return env, card


def test_assigned_member_edits_only_the_description(client, card_env):
    env, card = card_env
    url = f"/api/cards/{card['id']}"
    h = env.h["member"]
    assert client.patch(url, headers=h, json={"description": "d"}).status_code == 200
    for body in ({"title": "x"}, {"priority": "high"}, {"description": "d", "title": "x"}, {"assignee_id": None}):
        r = client.patch(url, headers=h, json=body)
        assert r.status_code == 403, body
    assert client.get(url, headers=h).get_json()["data"]["title"] == "t"
    assert client.patch(url, headers=env.h["member_other"], json={"description": "d"}).status_code == 403


def test_assigned_member_moves_the_card_but_another_member_does_not(client, card_env):
    env, card = card_env
    body = {"column_id": env.cols[1]}
    assert client.patch(f"/api/cards/{card['id']}/move", headers=env.h["member"], json=body).status_code == 200
    assert client.patch(f"/api/cards/{card['id']}/move", headers=env.h["member_other"], json=body).status_code == 403


def test_subtask_rules_for_the_assigned_member(client, card_env):
    env, card = card_env
    cid = card["id"]
    own = _post(client, "member", env, f"/api/cards/{cid}/subtasks", {"title": "mine"})
    assert own.status_code == 201 and own.get_json()["data"]["can_edit"] is True
    theirs = _post(client, "owner", env, f"/api/cards/{cid}/subtasks", {"title": "theirs"}).get_json()["data"]
    assert theirs["can_edit"] is True
    h = env.h["member"]
    own_id = own.get_json()["data"]["id"]
    assert client.patch(f"/api/subtasks/{theirs['id']}", headers=h, json={"is_done": True}).status_code == 200
    assert client.patch(f"/api/subtasks/{theirs['id']}", headers=h, json={"title": "no"}).status_code == 403
    assert client.patch(f"/api/subtasks/{theirs['id']}", headers=h, json={"is_done": True, "title": "no"}).status_code == 403
    assert client.delete(f"/api/subtasks/{theirs['id']}", headers=h).status_code == 403
    assert client.patch(f"/api/subtasks/{own_id}", headers=h, json={"title": "ok"}).status_code == 200
    assert client.delete(f"/api/subtasks/{own_id}", headers=h).status_code == 200
    assert client.patch(f"/api/subtasks/{theirs['id']}", headers=env.h["member_other"], json={"is_done": False}).status_code == 403
    assert client.delete(f"/api/subtasks/{theirs['id']}", headers=env.h["owner"]).status_code == 200


def test_subtask_can_edit_in_the_card_payload_and_old_rows(client, card_env):
    env, card = card_env
    cid = card["id"]
    sub = _post(client, "owner", env, f"/api/cards/{cid}/subtasks", {"title": "s"}).get_json()["data"]
    db.session.execute(db.update(Subtask).values(created_by_id=None))
    db.session.commit()
    seen = lambda who: client.get(f"/api/cards/{cid}", headers=env.h[who]).get_json()["data"]["subtasks"][0]
    assert seen("member")["can_edit"] is False and seen("member")["created_by_id"] is None
    assert seen("owner")["can_edit"] is True


def test_attachment_rules_for_the_assigned_member(client, card_env):
    env, card = card_env
    cid = card["id"]
    mine = _post(client, "member", env, f"/api/cards/{cid}/attachments", {"url": "https://e.com/a"})
    other = _post(client, "owner", env, f"/api/cards/{cid}/attachments", {"url": "https://e.com/b"}).get_json()["data"]
    assert mine.status_code == 201 and mine.get_json()["data"]["can_edit"] is True
    assert client.delete(f"/api/attachments/{other['id']}", headers=env.h["member"]).status_code == 403
    assert client.delete(f"/api/attachments/{mine.get_json()['data']['id']}", headers=env.h["member"]).status_code == 200
    assert _post(client, "member_other", env, f"/api/cards/{cid}/attachments", {"url": "https://e.com/c"}).status_code == 403


@pytest.mark.parametrize(
    "who,expected",
    [("manager", 201), ("owner", 201), ("sup_member", 201), ("member", 201), ("admin", 403), ("sup_other", 403), ("member_other", 403)],
)
def test_who_may_comment(client, card_env, who, expected):
    env, card = card_env
    r = _post(client, who, env, f"/api/cards/{card['id']}/comments", {"content": "x"})
    assert r.status_code == expected


def test_a_member_who_is_not_assigned_cannot_comment_or_reply(client, card_env):
    env, card = card_env
    top = _post(client, "manager", env, f"/api/cards/{card['id']}/comments", {"content": "x"}).get_json()["data"]
    assert _post(client, "member_other", env, f"/api/comments/{top['id']}/replies", {"content": "r"}).status_code == 403
    assert _post(client, "member", env, f"/api/comments/{top['id']}/replies", {"content": "r"}).status_code == 201


@pytest.mark.parametrize("color,status", [("teal", 201), ("slate", 201), (None, 201), ("#f00", 400), ("magenta", 400)])
def test_category_color_is_a_palette_key(client, color, status):
    env = Env(client)
    r = client.post(f"/api/boards/{env.bid}/categories", headers=env.h["owner"], json={"name": "K", "color": color})
    assert r.status_code == status
    if status == 400:
        assert "color" in r.get_json()["error"]["details"]


def test_column_move_renumbers(client):
    env = Env(client)
    r = client.patch(f"/api/columns/{env.cols[0]}/move", headers=env.h["owner"], json={"position": 2})
    assert r.status_code == 200
    board = client.get(f"/api/boards/{env.bid}", headers=env.h["owner"]).get_json()["data"]
    assert [c["id"] for c in board["columns"]][2] == env.cols[0]
    assert [c["order"] for c in board["columns"]] == [float(i) for i in range(len(env.cols))]
