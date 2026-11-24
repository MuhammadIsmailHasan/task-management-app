"""Requirement 43 (V16): completed_at and the weekly throughput endpoints."""
import uuid
from datetime import date, datetime, timedelta, timezone

from hypothesis import given, strategies as st

from app.blueprints.analytics.service import week_boundaries
from app.blueprints.cards.service import completion_stamp
from app.common import clock
from app.extensions import db
from app.models import Card
from tests.helpers import PROP
from tests.test_api import col, mkcard, world  # noqa: F401  (the shared fixture)

NOW = datetime(2026, 11, 25, 12, 0, tzinfo=timezone.utc)  # a Wednesday; its Monday is 2026-11-23


def row(card_id):
    return db.session.get(Card, uuid.UUID(card_id))


def completed(card_id, when):
    card = row(card_id)
    card.completed_at = when
    db.session.commit()


def series(w, who="manager", path=None, **q):
    url = path or f"/api/boards/{w.board['id']}/analytics/throughput"
    return w.client.get(url, headers=w.h[who], query_string=q)


def test_stamp_follows_the_column():
    now = NOW
    assert completion_stamp(None, "Todo", None, now) is None
    assert completion_stamp(None, "Done", None, now) == now
    assert completion_stamp("Review", "Done", None, now) == now
    assert completion_stamp("Done", "Done", NOW - timedelta(days=2), now) == NOW - timedelta(days=2)
    assert completion_stamp("Done", "Review", NOW, now) is None


@PROP
@given(st.lists(st.sampled_from(["Todo", "In Progress", "Review", "Revision", "Done"]), min_size=1, max_size=12))
def test_stamp_invariant_over_any_move_sequence(columns):
    stamp, prev = None, None
    for i, name in enumerate(columns):
        stamp = completion_stamp(prev, name, stamp, NOW + timedelta(minutes=i))
        prev = name
        assert (stamp is not None) == (name == "Done")


def test_create_and_move_set_and_clear_completed_at(world):  # noqa: F811
    c = world.client
    created = mkcard(world, "in done", i=4)
    card = row(created["id"])
    assert card.completed_at is not None
    moved = mkcard(world, "later")
    assert row(moved["id"]).completed_at is None
    c.patch(f"/api/cards/{moved['id']}/move", headers=world.h["supervisor"], json={"column_id": col(world, 4)})
    db.session.expire_all()
    first = row(moved["id"]).completed_at
    assert first is not None
    c.patch(f"/api/cards/{moved['id']}/move", headers=world.h["supervisor"], json={"column_id": col(world, 4), "prev": created["id"]})
    db.session.expire_all()
    assert row(moved["id"]).completed_at == first  # a reorder inside Done keeps it
    c.patch(f"/api/cards/{moved['id']}/move", headers=world.h["supervisor"], json={"column_id": col(world, 2)})
    db.session.expire_all()
    assert row(moved["id"]).completed_at is None


def test_week_boundaries_are_mondays_in_the_zone():
    starts, bounds = week_boundaries(3, NOW, "Asia/Jakarta")
    assert starts == [date(2026, 11, 9), date(2026, 11, 16), date(2026, 11, 23)]
    assert len(bounds) == 4 and bounds[0] == datetime(2026, 11, 8, 17, 0, tzinfo=timezone.utc)  # Monday 00:00 at UTC+7
    # 23:59 Sunday local belongs to the previous week, 00:00 Monday to the next
    sun, mon = datetime(2026, 11, 22, 16, 59, tzinfo=timezone.utc), datetime(2026, 11, 22, 17, 0, tzinfo=timezone.utc)
    assert bounds[1] <= sun < bounds[2] and bounds[2] <= mon < bounds[3]


def test_throughput_lists_every_week_oldest_first(world):  # noqa: F811
    clock.set_now(lambda: NOW)
    try:
        a, b = mkcard(world, "a"), mkcard(world, "b")
        completed(a["id"], NOW - timedelta(days=1))
        completed(b["id"], NOW - timedelta(days=15))
        r = series(world, weeks=4)
        assert r.status_code == 200
        d = r.get_json()["data"]
        assert [w["done"] for w in d["weeks"]] == [0, 1, 0, 1]
        assert [w["week_start"] for w in d["weeks"]] == ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]
        assert d["total"] == 2
        assert len(series(world).get_json()["data"]["weeks"]) == 8  # the default
    finally:
        clock.set_now(None)


def test_deleted_cards_and_old_cards_are_not_counted(world):  # noqa: F811
    clock.set_now(lambda: NOW)
    try:
        gone, old = mkcard(world, "gone"), mkcard(world, "old")
        completed(gone["id"], NOW - timedelta(days=1))
        completed(old["id"], NOW - timedelta(days=200))
        world.client.delete(f"/api/cards/{gone['id']}", headers=world.h["supervisor"])
        assert series(world, weeks=4).get_json()["data"]["total"] == 0
    finally:
        clock.set_now(None)


def test_weeks_validation_and_roles(world):  # noqa: F811
    for bad in ("0", "27", "abc"):
        r = series(world, weeks=bad)
        assert r.status_code == 400 and r.get_json()["error"]["code"] == "VALIDATION_ERROR" and "weeks" in r.get_json()["error"]["details"]
    assert series(world, "supervisor").status_code == 200  # owner
    assert series(world, "other_sup").status_code == 403
    assert series(world, "member").status_code == 403
    assert series(world, "admin").status_code == 403
    assert world.client.get(f"/api/boards/{world.board['id']}/analytics/throughput").status_code == 401
    assert series(world, path="/api/boards/00000000-0000-0000-0000-000000000000/analytics/throughput").status_code == 404


def test_cross_board_series_is_manager_only_and_lists_every_board(world):  # noqa: F811
    world.post("/api/boards", "manager", json={"name": "Second"})
    r = series(world, path="/api/analytics/throughput", weeks=2)
    assert r.status_code == 200
    rows = r.get_json()["data"]
    assert [x["name"] for x in rows] == ["B", "Second"] and all(len(x["weeks"]) == 2 for x in rows)
    assert series(world, "supervisor", path="/api/analytics/throughput").status_code == 403
    assert world.client.get("/api/analytics/throughput").status_code == 401


def test_query_count_does_not_depend_on_the_number_of_boards(world):  # noqa: F811
    from sqlalchemy import event

    def count_for():
        n = []
        listener = lambda *a, **k: n.append(1)  # noqa: E731
        event.listen(db.engine, "before_cursor_execute", listener)
        try:
            series(world, path="/api/analytics/throughput")
        finally:
            event.remove(db.engine, "before_cursor_execute", listener)
        return len(n)

    one = count_for()
    for i in range(5):
        world.post("/api/boards", "manager", json={"name": f"X{i}"})
    assert count_for() == one


def test_done_delta_counts_recent_completions_only(world):  # noqa: F811
    clock.set_now(lambda: NOW)
    try:
        recent, old = mkcard(world, "recent", i=4), mkcard(world, "old", i=4)
        completed(old["id"], NOW - timedelta(days=30))
        d = world.client.get(f"/api/boards/{world.board['id']}/analytics", headers=world.h["manager"]).get_json()["data"]
        assert (d["done"], d["done_delta"]) == (2, 1)
        assert recent["id"] != old["id"]
    finally:
        clock.set_now(None)


@PROP
@given(st.lists(st.integers(min_value=-60, max_value=10), max_size=20), st.integers(min_value=1, max_value=26))
def test_each_completion_in_the_window_counts_once(day_offsets, weeks):
    starts, bounds = week_boundaries(weeks, NOW, "UTC")
    stamps = [NOW + timedelta(days=d) for d in day_offsets]
    counts = [0] * weeks
    for s in stamps:
        for i in range(weeks):
            if bounds[i] <= s < bounds[i + 1]:
                counts[i] += 1
    inside = [s for s in stamps if bounds[0] <= s < bounds[-1]]
    assert sum(counts) == len(inside)
