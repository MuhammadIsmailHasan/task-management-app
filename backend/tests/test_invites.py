"""Invite link, join requests, board-scoped notifications, comment deletion, derived progress (V12; Properties 52 to 57)."""
import threading
import uuid

from app.extensions import db
from app.models import ActivityLog, BoardJoinRequest, BoardMember, Notification, User
from helpers import UUID0, Env, hdr, mkuser


def _invite(client, env, who="owner", method="post", suffix=""):
    return getattr(client, method)(f"/api/boards/{env.bid}/invite{suffix}", headers=env.h[who])


def _enable(client, env):
    return _invite(client, env).get_json()["data"]["token"]


def _ask(client, token, user):
    return client.post(f"/api/invite/{token}/requests", headers=hdr(user))


def test_invite_management_roles_and_lifecycle(client):
    env = Env(client)
    assert _invite(client, env, "member", "get").status_code == 403
    assert _invite(client, env, "sup_member").status_code == 403
    assert client.post(f"/api/boards/{env.bid}/invite").status_code == 401
    assert _invite(client, env, "owner", "get").get_json()["data"] == {"enabled": False, "token": None, "path": None}
    on = _invite(client, env, "owner").get_json()["data"]
    assert on["enabled"] and len(on["token"]) >= 43 and on["path"] == f"/app/invite/{on['token']}"
    assert _invite(client, env, "manager").get_json()["data"]["token"] == on["token"]  # idempotent, no second row
    new = _invite(client, env, "admin", suffix="/regenerate").get_json()["data"]
    assert new["token"] != on["token"]
    assert client.get(f"/api/invite/{on['token']}", headers=env.h["member_other"]).status_code == 404
    assert _invite(client, env, "owner", "delete").get_json()["data"]["enabled"] is False
    assert _invite(client, env, "owner", "delete").status_code == 200
    rows = ActivityLog.query.filter(ActivityLog.action.like("board.invite_%")).all()
    assert sorted(r.action for r in rows) == ["board.invite_disabled", "board.invite_enabled", "board.invite_regenerated"]
    assert new["token"] not in str([r.metadata_ for r in rows])


def test_invite_lookup_states_and_one_404(client):
    env = Env(client)
    token = _enable(client, env)
    get = lambda who, t=token: client.get(f"/api/invite/{t}", headers=env.h[who])
    assert client.get(f"/api/invite/{token}").status_code == 401
    assert get("member_other").headers["Cache-Control"] == "private, no-store"
    assert get("member_other").get_json()["data"]["state"] == "can_request"
    assert get("member").get_json()["data"]["state"] == "member"
    assert get("owner").get_json()["data"]["state"] == "member"
    assert get("manager").get_json()["data"]["state"] == "staff"
    assert get("admin").get_json()["data"]["state"] == "staff"
    bodies = {get("member_other", t).get_data() for t in ("nope", token + "x", token[::-1])}
    assert len(bodies) == 1 and get("member_other", "nope").status_code == 404
    client.delete(f"/api/boards/{env.bid}", headers=env.h["manager"])
    assert get("member_other").status_code == 404  # soft-deleted board reads as unknown


def test_property_55_join_request_lifecycle(client):
    env = Env(client)
    token = _enable(client, env)
    asker = env.users["member_other"]
    r = _ask(client, token, asker)
    assert r.status_code == 201 and set(r.get_json()["data"]) == {"id", "board_id", "status", "created_at"}
    rid = r.get_json()["data"]["id"]
    assert client.get(f"/api/invite/{token}", headers=hdr(asker)).get_json()["data"]["state"] == "pending"
    assert _ask(client, token, asker).status_code == 409  # already pending
    assert "board" in _ask(client, token, asker).get_json()["error"]["details"]
    assert _ask(client, token, env.users["member"]).status_code == 409  # already a member
    assert _ask(client, token, env.users["owner"]).status_code == 409  # the owner
    for who in ("manager", "admin"):
        r = client.post(f"/api/invite/{token}/requests", headers=env.h[who])
        assert r.status_code == 400 and "role" in r.get_json()["error"]["details"]
    assert client.post(f"/api/invite/{token}/requests").status_code == 401
    # notifications: the owner, the Manager, and the Admin, once each, with no Email
    for who in ("owner", "manager", "admin"):
        items = client.get("/api/notifications", headers=env.h[who]).get_json()["data"]["items"]
        mine = [n for n in items if n["type"] == "board_join_requested"]
        assert len(mine) == 1 and mine[0]["board_id"] == env.bid and mine[0]["actor_name"] == asker.full_name
        assert mine[0]["card_id"] is None and "email" not in str(mine[0])
    # the pending list carries the Email to the owner, Manager, and Admin only
    for who in ("owner", "manager", "admin"):
        rows = client.get(f"/api/boards/{env.bid}/join-requests", headers=env.h[who]).get_json()["data"]
        assert [x["id"] for x in rows] == [rid] and rows[0]["user"]["email"] == asker.email
    for who in ("member", "sup_member", "member_other"):
        assert client.get(f"/api/boards/{env.bid}/join-requests", headers=env.h[who]).status_code == 403
    assert client.get(f"/api/boards/{env.bid}/join-requests").status_code == 401
    # the owner cannot decide; a bad status is 400; an unknown id is 404
    assert client.patch(f"/api/join-requests/{rid}", headers=env.h["owner"], json={"status": "approved"}).status_code == 403
    assert client.patch(f"/api/join-requests/{rid}", json={"status": "approved"}).status_code == 401
    assert client.patch(f"/api/join-requests/{rid}", headers=env.h["manager"], json={"status": "maybe"}).status_code == 400
    assert client.patch(f"/api/join-requests/{UUID0}", headers=env.h["manager"], json={"status": "approved"}).status_code == 404
    # reject, then ask again with no cooldown
    rej = client.patch(f"/api/join-requests/{rid}", headers=env.h["manager"], json={"status": "rejected"})
    assert rej.status_code == 200 and "email" not in rej.get_data(as_text=True)
    assert client.patch(f"/api/join-requests/{rid}", headers=env.h["admin"], json={"status": "approved"}).status_code == 409
    inbox = client.get("/api/notifications", headers=hdr(asker)).get_json()["data"]["items"]
    assert [n["type"] for n in inbox] == ["board_join_rejected"]
    again = _ask(client, token, asker)
    assert again.status_code == 201 and again.get_json()["data"]["id"] != rid
    assert BoardJoinRequest.query.filter_by(id=uuid.UUID(rid)).one().status == "rejected"  # the old row is unchanged
    # approval by the Admin creates the member once, one log row, one board_added
    ok = client.patch(f"/api/join-requests/{again.get_json()['data']['id']}", headers=env.h["admin"], json={"status": "approved"})
    assert ok.status_code == 200
    assert BoardMember.query.filter_by(board_id=uuid.UUID(env.bid), user_id=asker.id).count() == 1
    added = ActivityLog.query.filter_by(action="board.member_added", target_id=uuid.UUID(env.bid)).all()
    assert any(a.metadata_.get("via") == "join_request" for a in added)
    assert [n["type"] for n in client.get("/api/notifications", headers=hdr(asker)).get_json()["data"]["items"]].count("board_added") == 1
    assert client.get(f"/api/boards/{env.bid}", headers=hdr(asker)).status_code == 200
    # no Email anywhere in the logs and the notification text
    blob = str([a.metadata_ for a in ActivityLog.query.all()]) + str(client.get("/api/notifications", headers=env.h["owner"]).get_json())
    assert asker.email not in blob and token not in blob


def test_pending_request_survives_regenerate_and_disable(client):
    env = Env(client)
    token = _enable(client, env)
    assert _ask(client, token, env.users["member_other"]).status_code == 201
    _invite(client, env, suffix="/regenerate")
    _invite(client, env, method="delete")
    assert BoardJoinRequest.query.filter_by(status="pending").count() == 1


def test_simultaneous_requests_make_one_row(client, monkeypatch):
    """Two requests that both pass the pending check: the partial unique index stops the second and it maps to 409."""
    from app.blueprints.invites import repository as invites_repo

    env = Env(client)
    token = _enable(client, env)
    user = env.users["member_other"]
    assert _ask(client, token, user).status_code == 201
    monkeypatch.setattr(invites_repo, "get_pending", lambda *a: None)  # the racing request saw no pending row
    r = _ask(client, token, user)
    assert r.status_code == 409 and "board" in r.get_json()["error"]["details"]
    assert BoardJoinRequest.query.filter_by(status="pending").count() == 1
    assert Notification.query.filter_by(type="board_join_requested", user_id=env.users["owner"].id).count() == 1


def test_property_52_role_change_removes_memberships_and_pending_requests(client):
    env = Env(client)
    token = _enable(client, env)
    promoted = env.users["member"]
    assert BoardMember.query.filter_by(user_id=promoted.id).count() == 1
    other = mkuser("member")
    _ask(client, token, other)
    assert client.patch(f"/api/users/{promoted.id}", headers=env.h["admin"], json={"role": "manager"}).status_code == 200
    assert BoardMember.query.filter_by(user_id=promoted.id).count() == 0
    assert ActivityLog.query.filter_by(action="board.member_removed").count() == 1
    assert client.patch(f"/api/users/{other.id}", headers=env.h["admin"], json={"role": "admin"}).status_code == 200
    assert BoardJoinRequest.query.filter_by(user_id=other.id).count() == 0


def test_members_list_owner_first_once_and_candidates(client):
    env = Env(client)
    base = f"/api/boards/{env.bid}/members"
    rows = client.get(base, headers=env.h["member"]).get_json()["data"]
    assert rows[0]["id"] == env.uid("owner") and rows[0]["is_owner"] is True
    assert sum(1 for r in rows if r["is_owner"]) == 1 and all("email" not in r for r in rows)
    # owner who is also a BoardMember is listed once
    assert client.post(base, headers=env.h["manager"], json={"user_id": env.uid("owner")}).status_code == 201
    rows = client.get(base, headers=env.h["member"]).get_json()["data"]
    assert [r["id"] for r in rows].count(env.uid("owner")) == 1 and rows[0]["is_owner"]
    staff = client.get(base + "?include=email", headers=env.h["manager"]).get_json()["data"]
    assert all(m["email"] for m in staff)
    # candidates: Members and Supervisors only, never the owner or a member
    for who in ("owner", "member", "sup_member"):
        assert client.get(f"/api/boards/{env.bid}/candidates?search=sup", headers=env.h[who]).status_code == 403
    found = client.get(f"/api/boards/{env.bid}/candidates?search=@t.test", headers=env.h["manager"])
    exact = client.get(f"/api/boards/{env.bid}/candidates?search={env.users['sup_other'].email}", headers=env.h["manager"]).get_json()["data"]
    assert [x["id"] for x in exact] == [env.uid("sup_other")] and found.status_code == 200
    for who in ("owner", "manager", "admin", "member"):
        ids = {x["id"] for x in client.get(f"/api/boards/{env.bid}/candidates?search={env.users[who].email}", headers=env.h["manager"]).get_json()["data"]}
        assert env.uid(who) not in ids
    # the owner row cannot be removed while the owner is no BoardMember
    other = Env(client)
    assert client.delete(f"/api/boards/{other.bid}/members/{other.uid('owner')}", headers=other.h["manager"]).status_code == 404


def test_add_member_notifies_and_owner_reassignment_clears_and_notifies(client):
    env = Env(client)
    other = mkuser("member")
    r = client.post(f"/api/boards/{env.bid}/members", headers=env.h["manager"], json={"user_id": str(other.id)})
    assert r.status_code == 201
    inbox = client.get("/api/notifications", headers=hdr(other)).get_json()["data"]["items"]
    assert [n["type"] for n in inbox] == ["board_added"] and inbox[0]["board_name"] == "B" and inbox[0]["actor_name"]
    for who in ("owner", "member", "sup_member"):
        assert client.post(f"/api/boards/{env.bid}/members", headers=env.h[who], json={"user_id": str(other.id)}).status_code == 403
    # reassignment: cards of the previous owner are cleared (he is no BoardMember), the new owner is notified
    card = env.card(assignee_id=env.uid("owner"))
    new_owner = mkuser("supervisor")
    assert client.patch(f"/api/boards/{env.bid}", headers=env.h["manager"], json={"owner_id": str(new_owner.id)}).status_code == 200
    assert client.get(f"/api/cards/{card['id']}", headers=env.h["manager"]).get_json()["data"]["assignee_id"] is None
    assert [n["type"] for n in client.get("/api/notifications", headers=hdr(new_owner)).get_json()["data"]["items"]] == ["board_added"]


def _count_queries(fn):
    from sqlalchemy import event

    seen = []
    hook = lambda *a: seen.append(1)
    event.listen(db.engine, "before_cursor_execute", hook)
    try:
        fn()
    finally:
        event.remove(db.engine, "before_cursor_execute", hook)
    return len(seen)


def test_property_56_notification_dedup_with_null_card_and_constant_queries(client):
    import datetime

    import pytest
    from sqlalchemy.exc import IntegrityError

    from app.blueprints.notifications import repository as repo

    env = Env(client)
    member = env.users["member"]
    before = Notification.query.filter_by(user_id=member.id, type="board_added").count()
    for _ in range(3):
        repo.add_board(member.id, uuid.UUID(env.bid), "board_added")
    db.session.commit()
    assert Notification.query.filter_by(user_id=member.id, type="board_added").count() == max(before, 1)
    db.session.add(Notification(user_id=member.id, type="assigned", notify_date=datetime.date(2026, 1, 1)))
    with pytest.raises(IntegrityError):  # CHECK: a card type needs a card_id
        db.session.commit()
    db.session.rollback()

    def inbox():
        return client.get("/api/notifications?limit=100", headers=env.h["member"])

    for i in range(5):
        env.card(title=f"a{i}", assignee_id=env.uid("member"))
    small = _count_queries(inbox)
    for i in range(45):
        env.card(title=f"b{i}", assignee_id=env.uid("member"))
    assert _count_queries(inbox) == small
    assert len(inbox().get_json()["data"]["items"]) >= 50


def test_property_53_comment_delete_and_reply_count(client):
    env = Env(client)
    card = env.card(assignee_id=env.uid("member"))
    cid = card["id"]
    post = lambda who, path, body: client.post(path, headers=env.h[who], json=body).get_json()["data"]
    top = post("member", f"/api/cards/{cid}/comments", {"content": "top secret words"})
    r1 = post("manager", f"/api/comments/{top['id']}/replies", {"content": "r1"})
    r2 = post("member", f"/api/comments/{top['id']}/replies", {"content": "r2"})
    for who in ("manager", "admin", "member_other", "owner"):
        assert client.delete(f"/api/comments/{top['id']}", headers=env.h[who]).status_code == 403, who
    assert client.delete(f"/api/comments/{top['id']}").status_code == 401
    assert client.delete(f"/api/comments/{UUID0}", headers=env.h["member"]).status_code == 404
    # deleting a reply decrements the parent's count
    assert client.delete(f"/api/comments/{r1['id']}", headers=env.h["manager"]).get_json()["data"] == {"deleted": 1}
    listed = client.get(f"/api/cards/{cid}/comments", headers=env.h["member"]).get_json()["data"]["items"]
    assert listed[0]["reply_count"] == 1 and [r["id"] for r in listed[0]["replies"]] == [r2["id"]]
    # deleting the top-level comment takes the remaining reply with it
    assert client.delete(f"/api/comments/{top['id']}", headers=env.h["member"]).get_json()["data"] == {"deleted": 2}
    assert client.get(f"/api/cards/{cid}/comments", headers=env.h["member"]).get_json()["data"]["items"] == []
    rows = ActivityLog.query.filter_by(action="comment.deleted").all()
    assert len(rows) == 2 and "top secret" not in str([r.metadata_ for r in rows])
    assert {r.metadata_["is_reply"] for r in rows} == {True, False}
    assert sorted(r.metadata_["deleted_replies"] for r in rows) == [0, 1]


def test_property_57_derived_progress_and_matrix(client):
    env = Env(client)
    card = env.card(assignee_id=env.uid("member"))
    cid = card["id"]
    assert card["progress"] is None and card["subtask_total_count"] == 0
    subs = [client.post(f"/api/cards/{cid}/subtasks", headers=env.h["owner"], json={"title": f"s{i}"}).get_json()["data"] for i in range(3)]
    # the assigned Member may toggle; another Member and a Member of another card may not
    assert client.patch(f"/api/subtasks/{subs[0]['id']}", headers=env.h["member"], json={"is_done": True}).status_code == 200
    assert client.patch(f"/api/subtasks/{subs[1]['id']}", headers=env.h["member_other"], json={"is_done": True}).status_code == 403
    assert client.patch(f"/api/subtasks/{subs[1]['id']}", json={"is_done": True}).status_code == 401
    other = env.card()
    assert client.post(f"/api/cards/{other['id']}/subtasks", headers=env.h["member"], json={"title": "x"}).status_code == 403
    for who in ("manager", "admin", "owner", "sup_member"):
        assert client.patch(f"/api/subtasks/{subs[2]['id']}", headers=env.h[who], json={"is_done": False}).status_code == 200
    assert client.patch(f"/api/subtasks/{subs[2]['id']}", headers=env.h["sup_other"], json={"is_done": True}).status_code == 403
    got = client.get(f"/api/cards/{cid}", headers=env.h["manager"]).get_json()["data"]
    assert (got["progress"], got["subtask_done_count"], got["subtask_total_count"]) == (3, 1, 3)  # 1/3 -> 3 of 10
    for done, total, expected in ((0, 4, 0), (1, 2, 5), (1, 4, 3), (3, 4, 8), (4, 4, 10), (1, 1, 10)):
        assert (20 * done + total) // (2 * total) == expected
    listed = client.get(f"/api/boards/{env.bid}/cards", headers=env.h["manager"]).get_json()["data"]
    assert {c["id"]: c["progress"] for c in listed}[cid] == 3
    for body in ({"progress": 5}, {"title": "t", "progress": 1}):
        r = client.patch(f"/api/cards/{cid}", headers=env.h["manager"], json=body)
        assert r.status_code == 400 and "progress" in r.get_json()["error"]["details"]
    token = client.post(f"/api/boards/{env.bid}/share", headers=env.h["manager"]).get_json()["data"]["token"]
    shared = client.get(f"/api/shared/{token}/cards/{cid}").get_json()["data"]
    assert (shared["progress"], shared["subtask_done_count"], shared["subtask_total_count"]) == (3, 1, 3)


def test_patch_with_no_change_writes_no_activity_row_and_subtask_logs(client):
    env = Env(client)
    card = env.card(title="Same")
    before = ActivityLog.query.count()
    assert client.patch(f"/api/cards/{card['id']}", headers=env.h["manager"], json={"title": "Same"}).status_code == 200
    assert ActivityLog.query.count() == before
    sub = client.post(f"/api/cards/{card['id']}/subtasks", headers=env.h["manager"], json={"title": "S"}).get_json()["data"]
    client.delete(f"/api/subtasks/{sub['id']}", headers=env.h["manager"])
    actions = [a.action for a in ActivityLog.query.filter_by(target_id=uuid.UUID(card["id"])).all()]
    assert "card.subtask_added" in actions and "card.subtask_removed" in actions
    assert User.query.count() > 0


def test_property_60_members_rows_carry_role_and_query_count_is_constant(client):
    from sqlalchemy import event

    env = Env(client)
    base = f"/api/boards/{env.bid}/members"

    def fetch():
        n = []
        listener = lambda *a, **k: n.append(1)
        event.listen(db.engine, "before_cursor_execute", listener)
        try:
            rows = client.get(base, headers=env.h["member"]).get_json()["data"]
        finally:
            event.remove(db.engine, "before_cursor_execute", listener)
        return rows, len(n)

    rows, small = fetch()
    for who in ("sup_other", "member_other"):
        assert client.post(base, headers=env.h["manager"], json={"user_id": env.uid(who)}).status_code == 201
    rows, large = fetch()
    assert all(r["role"] in ("member", "supervisor") for r in rows)
    assert {r["id"]: r["role"] for r in rows}[env.uid("sup_other")] == "supervisor"
    assert large == small
