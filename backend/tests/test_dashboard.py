"""Requirements 51 and 52 (V17): the Dashboard endpoint, My Tasks, and Properties 78 and 80."""
import uuid
from datetime import date, datetime, timedelta, timezone

from hypothesis import given, strategies as st
from sqlalchemy import event

from app.blueprints.cards.service import MY_GROUPS, group_key
from app.common import clock
from app.extensions import db
from app.models import Card
from tests.helpers import PROP, Env, hdr, mkuser, reset_db
from tests.test_api import col, mkcard, world  # noqa: F401  (the shared fixture)

NOW = datetime(2026, 11, 26, 12, 0, tzinfo=timezone.utc)  # a Thursday
TODAY = date(2026, 11, 26)


def with_clock():
    clock.set_now(lambda: NOW)


def dash(w, who="manager", **q):
    return w.client.get("/api/analytics/dashboard", headers=w.h[who], query_string=q)


def finish(card_id, when, end=None):
    row = db.session.get(Card, uuid.UUID(card_id))
    row.completed_at = when
    if end is not None:
        row.end_date = end
    db.session.commit()


# ---- access (DASH-19) ----
def test_roles_and_scope(world):
    assert dash(world, "member").status_code == 403
    assert dash(world, "admin").status_code == 403
    assert world.client.get("/api/analytics/dashboard").status_code == 401
    assert dash(world, "supervisor").status_code == 200  # owns the fixture's board
    assert dash(world, "supervisor", board=world.board["id"]).status_code == 200
    assert dash(world, "other_sup", board=world.board["id"]).status_code == 403
    assert dash(world, "manager", board=str(uuid.uuid4())).status_code == 404
    assert dash(world, "manager", board="not-a-uuid").status_code == 400
    assert dash(world, "manager", member="nope").status_code == 400


def test_a_supervisor_without_a_board_sees_an_empty_dashboard(world):
    data = dash(world, "other_sup").get_json()["data"]
    assert data["overview"] == {"total": 0, "done": 0, "in_progress": 0, "overdue": 0}
    assert data["overdue"]["cards"] == [] and data["members"] == []


def test_the_range_rules(world):
    assert dash(world, **{"from": "2026-01-01", "to": "2026-12-31"}).status_code == 400  # over 182 days
    assert dash(world, **{"from": "2026-11-20", "to": "2026-11-01"}).status_code == 400
    assert dash(world, **{"from": "2026-13-01"}).status_code == 400
    assert dash(world, due_on="soon").status_code == 400


# ---- widgets ----
def test_default_range_is_the_last_thirty_days_and_the_shape_is_complete(world):
    with_clock()
    try:
        data = dash(world).get_json()["data"]
        assert data["range"] == {"from": "2026-10-28", "to": "2026-11-26"} and data["today"] == "2026-11-26"
        assert set(data) == {"range", "today", "overview", "throughput", "overdue", "due_tomorrow", "top_priority", "finished", "members"}
        assert data["due_tomorrow"]["due_on"] == "2026-11-27"
    finally:
        clock.set_now(None)


def test_overview_overdue_due_tomorrow_and_top_priority(world):
    with_clock()
    try:
        member = str(world.users["member"].id)
        mkcard(world, title="late-high", priority="high", end_date="2026-11-20", assignee_id=member)
        mkcard(world, title="late-low", priority="low", end_date="2026-11-10")
        mkcard(world, title="soon", priority="medium", end_date="2026-11-27")
        mkcard(world, title="nodate", priority="high")
        mkcard(world, title="done", i=4, priority="high", end_date="2026-11-01")
        data = dash(world).get_json()["data"]
        assert data["overview"] == {"total": 5, "done": 1, "in_progress": 0, "overdue": 2}
        assert [c["title"] for c in data["overdue"]["cards"]] == ["late-low", "late-high"]  # nearest-first by end date
        assert data["overdue"]["count"] == 2 and data["overdue"]["cards"][1]["assignee_name"] == "Member"
        assert [c["title"] for c in data["due_tomorrow"]["cards"]] == ["soon"] and data["due_tomorrow"]["count"] == 1
        assert [c["title"] for c in data["top_priority"]["cards"]] == ["late-high", "nodate", "soon", "late-low"]  # Done is left out
        fields = set(data["overdue"]["cards"][0])
        assert fields == {"id", "title", "board_id", "board_slug", "board_name", "priority", "end_date", "due_state", "assignee_name"}
    finally:
        clock.set_now(None)


def test_the_member_filter_applies_to_every_widget(world):
    with_clock()
    try:
        member = str(world.users["member"].id)
        mkcard(world, title="mine", end_date="2026-11-20", assignee_id=member)
        mkcard(world, title="theirs", end_date="2026-11-20")
        data = dash(world, member=member).get_json()["data"]
        assert data["overview"]["total"] == 1 and [c["title"] for c in data["overdue"]["cards"]] == ["mine"]
        assert [c["title"] for c in data["top_priority"]["cards"]] == ["mine"]
    finally:
        clock.set_now(None)


def test_the_date_range_limits_overdue_by_end_date_but_not_the_overview(world):
    with_clock()
    try:
        mkcard(world, title="old", end_date="2026-09-01")
        mkcard(world, title="recent", end_date="2026-11-20")
        data = dash(world).get_json()["data"]  # default range starts 2026-10-28
        assert [c["title"] for c in data["overdue"]["cards"]] == ["recent"]
        assert data["overview"]["overdue"] == 2  # "Not limited by the date range"
    finally:
        clock.set_now(None)


def test_the_due_on_filter_is_independent_of_the_range(world):
    with_clock()
    try:
        mkcard(world, title="friday", end_date="2026-11-27")
        mkcard(world, title="monday", end_date="2026-11-30")
        data = dash(world, due_on="2026-11-30", **{"from": "2026-11-01", "to": "2026-11-05"}).get_json()["data"]
        assert [c["title"] for c in data["due_tomorrow"]["cards"]] == ["monday"] and data["due_tomorrow"]["due_on"] == "2026-11-30"
    finally:
        clock.set_now(None)


def test_finished_on_time_and_overdue_and_throughput(world):
    with_clock()
    try:
        a, b, c, d = (mkcard(world, title=t, i=4) for t in "abcd")
        finish(a["id"], datetime(2026, 11, 24, 9, tzinfo=timezone.utc), date(2026, 11, 24))  # the same day: on time
        finish(b["id"], datetime(2026, 11, 24, 9, tzinfo=timezone.utc), date(2026, 11, 23))  # a day late
        finish(c["id"], datetime(2026, 11, 25, 9, tzinfo=timezone.utc), None)  # no end date: left out of both
        finish(d["id"], datetime(2026, 11, 1, 9, tzinfo=timezone.utc), date(2026, 11, 30))  # before the range
        data = dash(world, **{"from": "2026-11-20", "to": "2026-11-26"}).get_json()["data"]
        assert data["finished"] == {"on_time": 1, "overdue": 1}
        assert data["throughput"]["total"] == 3 and data["throughput"]["weeks"][0]["week_start"] == "2026-11-16"
    finally:
        clock.set_now(None)


def test_archived_cards_count_as_finished_but_deleted_ones_do_not(world):
    with_clock()
    try:
        arch, gone = mkcard(world, title="arch", i=4), mkcard(world, title="gone", i=4)
        finish(arch["id"], datetime(2026, 11, 24, 9, tzinfo=timezone.utc), date(2026, 11, 24))
        finish(gone["id"], datetime(2026, 11, 24, 9, tzinfo=timezone.utc), date(2026, 11, 24))
        row = db.session.get(Card, uuid.UUID(arch["id"]))
        row.archived_at, row.column_id = NOW, None  # an archived Card keeps its completion (THR-06)
        world.client.delete(f"/api/cards/{gone['id']}", headers=world.h["manager"])
        assert dash(world).get_json()["data"]["finished"]["on_time"] == 1
    finally:
        clock.set_now(None)


def test_members_have_no_email(world):
    people = dash(world).get_json()["data"]["members"]
    assert people and all(set(p) == {"id", "full_name", "avatar_url"} for p in people)
    assert "@" not in str(people)


def test_the_query_count_does_not_grow_with_the_data(world):
    counts = []
    for n in (1, 25):
        for i in range(n):
            mkcard(world, title=f"q{n}-{i}", end_date="2026-11-20", assignee_id=str(world.users["member"].id))
        statements = []
        engine = db.engine

        def count(conn, cursor, statement, *a):
            statements.append(statement)

        event.listen(engine, "before_cursor_execute", count)
        try:
            assert dash(world).status_code == 200
        finally:
            event.remove(engine, "before_cursor_execute", count)
        counts.append(len(statements))
    assert counts[0] == counts[1] <= 14  # fixed budget, however many cards (the role and access checks included)


@PROP
@given(st.lists(st.tuples(st.sampled_from(["Todo", "In Progress", "Done"]), st.integers(-12, 12), st.sampled_from(["high", "medium", "low"]), st.integers(-10, 3)), max_size=8))
def test_property_78_dashboard_figures_equal_the_rows(client, cards):
    """Every figure equals the figure computed directly from the Card rows by the rules of DASH-12 to DASH-17."""
    reset_db()
    with_clock()
    try:
        env = Env(client)
        h = env.h["manager"]
        end_dates = []
        for column, end_offset, priority, done_offset in cards:
            end = TODAY + timedelta(days=end_offset)
            made = client.post(f"/api/columns/{env.cols[{'Todo': 0, 'In Progress': 1, 'Done': 4}[column]]}/cards", headers=h, json={"title": "x", "priority": priority, "end_date": end.isoformat()}).get_json()["data"]
            if column == "Done":
                finish(made["id"], datetime.combine(TODAY + timedelta(days=done_offset), datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=9))
            end_dates.append((column, end))
        data = client.get("/api/analytics/dashboard", headers=h).get_json()["data"]
        lo = TODAY - timedelta(days=29)
        assert data["overview"] == {
            "total": len(cards),
            "done": sum(c == "Done" for c, _ in end_dates),
            "in_progress": sum(c == "In Progress" for c, _ in end_dates),
            "overdue": sum(e < TODAY and c != "Done" for c, e in end_dates),
        }
        assert data["overdue"]["count"] == sum(e < TODAY and e >= lo and c != "Done" for c, e in end_dates)
        assert data["due_tomorrow"]["count"] == sum(e == TODAY + timedelta(days=1) and c != "Done" for c, e in end_dates)
        done_rows = [r for r in Card.query.filter(Card.completed_at.isnot(None)).all() if lo <= r.completed_at.date() <= TODAY]
        assert data["finished"]["on_time"] == sum(r.completed_at.date() <= r.end_date for r in done_rows)
        assert data["finished"]["overdue"] == sum(r.completed_at.date() > r.end_date for r in done_rows)
        # the chart covers the whole weeks that touch the range (Monday of `from` to the Monday after `to`)
        first_monday = lo - timedelta(days=lo.weekday())
        week_end = TODAY - timedelta(days=TODAY.weekday()) + timedelta(days=7)
        in_weeks = [r for r in Card.query.filter(Card.completed_at.isnot(None)).all() if first_monday <= r.completed_at.date() < week_end]
        assert data["throughput"]["total"] == len(in_weeks)
    finally:
        clock.set_now(None)


# ---- My Tasks (Requirement 52, Property 80) ----
def mine(w, who="member"):
    return w.client.get("/api/me/cards", headers=w.h[who])


def test_group_boundaries():
    assert group_key(None, TODAY) == "no_due"
    assert group_key(TODAY - timedelta(days=1), TODAY) == "overdue"
    assert group_key(TODAY, TODAY) == "today"
    assert group_key(TODAY + timedelta(days=1), TODAY) == "tomorrow"
    assert group_key(date(2026, 11, 29), TODAY) == "this_week"  # the Sunday of that Monday-first week
    assert group_key(date(2026, 11, 30), TODAY) == "later"
    # on a Sunday, tomorrow is already next week and "this week" is empty
    assert group_key(date(2026, 11, 30), date(2026, 11, 29)) == "tomorrow"
    assert group_key(date(2026, 12, 1), date(2026, 11, 29)) == "later"


@PROP
@given(st.integers(-40, 40), st.integers(0, 6), st.booleans())
def test_property_80_every_card_falls_in_exactly_one_group(offset, weekday, dated):
    today = date(2026, 11, 23) + timedelta(days=weekday)
    key = group_key(today + timedelta(days=offset) if dated else None, today)
    assert key in MY_GROUPS
    end = today + timedelta(days=offset)
    sunday = today + timedelta(days=6 - today.weekday())
    if not dated:
        assert key == "no_due"
    elif end < today:
        assert key == "overdue"
    elif end == today:
        assert key == "today"
    elif end == today + timedelta(days=1):
        assert key == "tomorrow"
    elif end <= sunday:
        assert key == "this_week"
    else:
        assert key == "later"


def test_my_tasks_groups_sorts_and_leaves_out_done_archived_and_other_people(world):
    with_clock()
    try:
        member = str(world.users["member"].id)
        mkcard(world, title="late", end_date="2026-11-20", assignee_id=member, priority="low")
        mkcard(world, title="late-high", end_date="2026-11-20", assignee_id=member, priority="high")
        mkcard(world, title="today", end_date="2026-11-26", assignee_id=member)
        mkcard(world, title="nodate", assignee_id=member)
        mkcard(world, title="done", i=4, end_date="2026-11-20", assignee_id=member)
        old = mkcard(world, title="old", assignee_id=member)
        world.client.post(f"/api/cards/{old['id']}/archive", headers=world.h["manager"])
        mkcard(world, title="not mine", end_date="2026-11-20")
        data = mine(world).get_json()["data"]
        assert data["today"] == "2026-11-26"
        assert [g["key"] for g in data["groups"]] == ["overdue", "today", "no_due"]
        assert [c["title"] for c in data["groups"][0]["cards"]] == ["late-high", "late"]  # same date: high first
        card = data["groups"][0]["cards"][0]
        assert card["board_slug"] == "b" and card["board_name"] == "B" and card["due_state"] == "overdue"
        assert set(card) == {"id", "title", "board_id", "board_slug", "board_name", "priority", "end_date", "due_state", "category"}
    finally:
        clock.set_now(None)


def test_my_tasks_for_an_admin_and_without_a_token(world):
    assert mine(world, "admin").get_json()["data"]["groups"] == []
    assert world.client.get("/api/me/cards").status_code == 401
