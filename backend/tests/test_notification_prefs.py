"""Requirements 57 and 58 (V17): preferences, the five event types, the due-date job, and Properties 75 and 76."""
import uuid
from datetime import date, datetime, timedelta, timezone

from hypothesis import given, strategies as st

from app.common import clock
from app.extensions import db
from app.jobs import due
from app.models import PREFERENCE_TYPES, Card, Notification, NotificationPreference, User
from tests.helpers import PROP, hdr, mkuser, reset_db
from tests.test_api import col, mkcard, world  # noqa: F401  (the shared fixture)

NOW = datetime(2026, 11, 26, 12, 0, tzinfo=timezone.utc)  # a Thursday
URL = "/api/me/notification-preferences"


def inbox(w, who="member", **q):
    return w.client.get("/api/notifications", headers=w.h[who], query_string=q).get_json()["data"]["items"]


def types(w, who="member"):
    return [n["type"] for n in inbox(w, who)]


def put(w, who, prefs):
    return w.client.put(URL, headers=w.h[who], json={"preferences": prefs})


# ---- endpoints (NPF-07) ----
def test_defaults_are_all_on_in_order(world):
    got = world.client.get(URL, headers=world.h["member"]).get_json()["data"]["preferences"]
    assert got == [{"type": t, "enabled": True} for t in PREFERENCE_TYPES]
    assert world.client.get(URL).status_code == 401


def test_put_upserts_and_returns_every_type(world):
    r = put(world, "member", [{"type": "due_today", "enabled": False}])
    assert r.status_code == 200
    shown = {p["type"]: p["enabled"] for p in r.get_json()["data"]["preferences"]}
    assert shown["due_today"] is False and all(v for k, v in shown.items() if k != "due_today")
    put(world, "member", [{"type": "due_today", "enabled": True}, {"type": "subtask_on_assigned", "enabled": False}])
    assert NotificationPreference.query.count() == 2  # upserted, never duplicated
    other = world.client.get(URL, headers=world.h["manager"]).get_json()["data"]["preferences"]
    assert all(p["enabled"] for p in other)  # one user's switch never touches another's


def test_put_rejects_bad_bodies(world):
    bad = [
        [],
        [{"type": "nope", "enabled": True}],
        [{"type": "due_today", "enabled": "yes"}],
        [{"type": "due_today", "enabled": True}, {"type": "due_today", "enabled": False}],
        [{"type": t, "enabled": True} for t in PREFERENCE_TYPES] + [{"type": "due_today", "enabled": True}],
        [{"enabled": True}],
    ]
    for body in bad:
        assert put(world, "member", body).status_code == 400, body
    assert world.client.put(URL, headers=world.h["member"], json={}).status_code == 400
    assert world.client.put(URL, json={"preferences": [{"type": "due_today", "enabled": True}]}).status_code == 401


# ---- event notifications (NPF-03, NPF-04) ----
def assigned_card(world):
    return mkcard(world, title="Plan", assignee_id=str(world.users["member"].id))


def test_a_comment_on_an_assigned_card_notifies_the_assignee_once(world):
    card = assigned_card(world)
    world.client.post(f"/api/cards/{card['id']}/comments", headers=world.h["manager"], json={"content": "hello"})
    assert types(world).count("comment_on_assigned") == 1
    note = next(n for n in inbox(world) if n["type"] == "comment_on_assigned")
    assert note["card_title"] == "Plan" and note["actor_name"] == "Manager" and note["board_slug"] == "b"
    assert "hello" not in str(note)  # no comment text in a notification (NPF-05)
    first = world.client.post(f"/api/cards/{card['id']}/comments", headers=world.h["manager"], json={"content": "again"}).get_json()["data"]
    world.client.post(f"/api/comments/{first['id']}/replies", headers=world.h["supervisor"], json={"content": "reply"})
    assert types(world).count("comment_on_assigned") == 3  # one per comment and reply, never refused as a duplicate


def test_the_actor_never_notifies_themselves_and_an_unassigned_card_notifies_no_one(world):
    card = assigned_card(world)
    before = len(inbox(world))
    world.client.post(f"/api/cards/{card['id']}/comments", headers=world.h["member"], json={"content": "mine"})
    assert len(inbox(world)) == before
    loose = mkcard(world, title="loose")
    world.client.post(f"/api/cards/{loose['id']}/comments", headers=world.h["manager"], json={"content": "x"})
    assert Notification.query.filter_by(card_id=uuid.UUID(loose["id"]), type="comment_on_assigned").count() == 0


def test_a_disabled_type_creates_nothing_and_the_others_still_do(world):
    card = assigned_card(world)
    put(world, "member", [{"type": "comment_on_assigned", "enabled": False}])
    world.client.post(f"/api/cards/{card['id']}/comments", headers=world.h["manager"], json={"content": "x"})
    assert "comment_on_assigned" not in types(world)
    world.client.post(f"/api/cards/{card['id']}/subtasks", headers=world.h["manager"], json={"title": "s"})
    assert "subtask_on_assigned" in types(world)


def test_move_archive_and_delete_carry_their_action_and_a_reorder_does_not_notify(world):
    card = assigned_card(world)
    other = mkcard(world, title="other", assignee_id=str(world.users["member"].id))
    h = world.h["manager"]
    world.client.patch(f"/api/cards/{card['id']}/move", headers=h, json={"column_id": col(world, 1)})
    world.client.patch(f"/api/cards/{card['id']}/move", headers=h, json={"column_id": col(world, 1), "prev": None, "next": None})  # same Column
    world.client.post(f"/api/cards/{card['id']}/archive", headers=h)
    world.client.delete(f"/api/cards/{other['id']}", headers=h)
    actions = sorted(n["action"] for n in inbox(world) if n["type"] == "assigned_card_changed")
    assert actions == ["archived", "deleted", "moved"]
    assert all(n["action"] is None for n in inbox(world) if n["type"] != "assigned_card_changed")


def test_subtask_changes_notify_but_a_reorder_alone_does_not(world):
    card = assigned_card(world)
    h = world.h["manager"]
    sub = world.client.post(f"/api/cards/{card['id']}/subtasks", headers=h, json={"title": "one"}).get_json()["data"]
    two = world.client.post(f"/api/cards/{card['id']}/subtasks", headers=h, json={"title": "two"}).get_json()["data"]
    count = lambda: types(world).count("subtask_on_assigned")
    assert count() == 2
    world.client.patch(f"/api/subtasks/{sub['id']}", headers=h, json={"is_done": True})
    assert count() == 3
    world.client.patch(f"/api/subtasks/{sub['id']}", headers=h, json={"is_done": True})  # nothing changed
    world.client.patch(f"/api/subtasks/{two['id']}", headers=h, json={"prev": sub["id"], "next": None})  # a reorder
    assert count() == 3
    world.client.delete(f"/api/subtasks/{sub['id']}", headers=h)
    assert count() == 4


def test_an_inactive_assignee_is_not_notified(world):
    card = assigned_card(world)
    world.users["member"].is_active = False
    db.session.commit()
    n = Notification.query.count()
    world.client.post(f"/api/cards/{card['id']}/comments", headers=world.h["manager"], json={"content": "x"})
    assert Notification.query.count() == n


@PROP
@given(
    st.lists(st.sampled_from(["comment", "subtask", "move", "archive"]), min_size=1, max_size=6),
    st.booleans(), st.booleans(), st.booleans(), st.sampled_from(["actor", "other", "none"]),
)
def test_property_75_preferences_and_the_actor(client, events, enabled, active, assigned, who):
    """A notification is created exactly when the Card has an assignee who is active, is not the actor, and has the type enabled."""
    reset_db()
    manager, sup, member = mkuser("manager"), mkuser("supervisor"), mkuser("member")
    h = hdr(manager)
    board = client.post("/api/boards", headers=h, json={"name": "P"}).get_json()["data"]
    client.patch(f"/api/boards/{board['id']}", headers=h, json={"owner_id": str(sup.id)})
    client.post(f"/api/boards/{board['id']}/members", headers=h, json={"user_id": str(member.id)})
    card = client.post(f"/api/columns/{board['columns'][0]['id']}/cards", headers=h, json={"title": "c", **({"assignee_id": str(member.id)} if assigned else {})}).get_json()["data"]
    member.is_active = active
    db.session.commit()
    actor_user, actor_h = (member, hdr(member)) if who == "actor" else (manager, h)
    wanted = {"comment": "comment_on_assigned", "subtask": "subtask_on_assigned", "move": "assigned_card_changed", "archive": "assigned_card_changed"}
    for t in set(wanted.values()):
        db.session.add(NotificationPreference(user_id=member.id, type=t, enabled=enabled))
    db.session.commit()
    Notification.query.delete()
    db.session.commit()
    for e in events:
        if e == "comment":
            client.post(f"/api/cards/{card['id']}/comments", headers=actor_h, json={"content": "x"})
        elif e == "subtask":
            client.post(f"/api/cards/{card['id']}/subtasks", headers=actor_h, json={"title": "s"})
        elif e == "move":
            client.patch(f"/api/cards/{card['id']}/move", headers=actor_h, json={"column_id": board["columns"][1]["id"]})
        else:
            client.post(f"/api/cards/{card['id']}/archive", headers=actor_h)
    rows = Notification.query.filter(Notification.type.in_(list(wanted.values()))).all()
    eligible = assigned and active and enabled and who != "actor"
    if not eligible:
        assert rows == []
    else:
        assert rows and all(r.user_id == member.id and r.actor_id == manager.id for r in rows)


# ---- the due-date job (Requirement 58, Property 76) ----
def run_job(now=NOW):
    return due.run(now)


def assign_due(world, title, end, who="member", i=0):
    return mkcard(world, title=title, i=i, end_date=end, assignee_id=str(world.users[who].id))


def test_it_creates_due_today_and_due_tomorrow_and_a_second_run_creates_nothing(world):
    assign_due(world, "today", "2026-11-26")
    assign_due(world, "tomorrow", "2026-11-27")
    assign_due(world, "later", "2026-11-29")
    assert run_job() == (1, 1, 0)
    rows = Notification.query.filter(Notification.type.in_(("due_today", "due_tomorrow"))).all()
    assert sorted(r.type for r in rows) == ["due_today", "due_tomorrow"] and {r.notify_date for r in rows} == {date(2026, 11, 26)}
    assert all(r.actor_id is None and r.board_id for r in rows)
    assert run_job() == (0, 0, 2)  # the same date again: nothing new
    assert Notification.query.filter(Notification.type.in_(("due_today", "due_tomorrow"))).count() == 2
    assert sorted(n["type"] for n in inbox(world) if n["type"].startswith("due_")) == ["due_today", "due_tomorrow"]


def test_the_next_day_creates_that_days_rows(world):
    assign_due(world, "friday", "2026-11-27")
    run_job()
    run_job(NOW + timedelta(days=1))  # it is now due today
    got = sorted(r.type for r in Notification.query.filter(Notification.type.in_(("due_today", "due_tomorrow"))).all())
    assert got == ["due_today", "due_tomorrow"]


def test_it_skips_done_archived_deleted_and_unassigned_cards_and_inactive_users(world):
    assign_due(world, "done", "2026-11-26", i=4)
    old = assign_due(world, "old", "2026-11-26")
    gone = assign_due(world, "gone", "2026-11-26")
    mkcard(world, title="nobody", end_date="2026-11-26")
    world.client.post(f"/api/cards/{old['id']}/archive", headers=world.h["manager"])
    world.client.delete(f"/api/cards/{gone['id']}", headers=world.h["manager"])
    assert run_job() == (0, 0, 0)
    idle = world.users["member"]
    assign_due(world, "idle owner", "2026-11-26")
    idle.is_active = False
    db.session.commit()
    assert run_job() == (0, 0, 0)


def test_a_switched_off_type_is_skipped_per_user(world):
    assign_due(world, "a", "2026-11-26")
    assign_due(world, "b", "2026-11-27")
    put(world, "member", [{"type": "due_tomorrow", "enabled": False}])
    assert run_job() == (1, 0, 0)


def test_a_card_moved_to_today_is_picked_up_by_the_next_run(world):
    card = assign_due(world, "shifting", "2026-11-30")
    assert run_job() == (0, 0, 0)
    world.client.patch(f"/api/cards/{card['id']}", headers=world.h["manager"], json={"end_date": "2026-11-26"})
    assert run_job() == (1, 0, 0)


def test_the_output_line_has_counts_only(world):
    assign_due(world, "secret title", "2026-11-26")
    line = due._line(run_job())
    assert line == "due_today=1 due_tomorrow=0 skipped=0" and "secret" not in line


def test_the_cli_command_runs(app, world):
    assign_due(world, "cli", "2026-11-26")
    clock.set_now(lambda: NOW)
    try:
        out = app.test_cli_runner().invoke(args=["notify-due"]).output
    finally:
        clock.set_now(None)
    assert out.strip() == "due_today=1 due_tomorrow=0 skipped=0"


@PROP
@given(st.lists(st.tuples(st.integers(-1, 3), st.booleans(), st.sampled_from(["todo", "done", "archived", "deleted", "free"])), max_size=8), st.integers(1, 3))
def test_property_76_the_due_job_is_idempotent(client, cards, runs):
    """Running the job again on the same local date creates the same rows as running it once, none for a closed Card."""
    reset_db()
    manager, member = mkuser("manager"), mkuser("member")
    h = hdr(manager)
    board = client.post("/api/boards", headers=h, json={"name": "P"}).get_json()["data"]
    client.post(f"/api/boards/{board['id']}/members", headers=h, json={"user_id": str(member.id)})
    cols = {c["name"]: c["id"] for c in board["columns"]}
    for offset, assigned, state in cards:
        end = (date(2026, 11, 26) + timedelta(days=offset)).isoformat()
        body = {"title": "c", "end_date": end, **({"assignee_id": str(member.id)} if assigned else {})}
        made = client.post(f"/api/columns/{cols['Done' if state == 'done' else 'Todo']}/cards", headers=h, json=body).get_json()["data"]
        if state == "archived":
            client.post(f"/api/cards/{made['id']}/archive", headers=h)
        elif state == "deleted":
            client.delete(f"/api/cards/{made['id']}", headers=h)
    first = due.run(NOW)
    key = lambda r: (str(r.card_id), r.type, str(r.notify_date))
    snapshot = sorted(key(r) for r in Notification.query.filter(Notification.type.in_(("due_today", "due_tomorrow"))))
    for _ in range(runs):
        again = due.run(NOW)
        assert again[0] == again[1] == 0
    assert sorted(key(r) for r in Notification.query.filter(Notification.type.in_(("due_today", "due_tomorrow")))) == snapshot
    assert first[0] + first[1] == len(snapshot)
    # exactly the open, assigned Cards due today or tomorrow, and nothing for a closed or unassigned one
    open_due = [c for c in Card.query.all() if c.deleted_at is None and c.archived_at is None and c.assignee_id and c.completed_at is None and c.end_date in (date(2026, 11, 26), date(2026, 11, 27))]
    assert len(snapshot) == len(open_due)
