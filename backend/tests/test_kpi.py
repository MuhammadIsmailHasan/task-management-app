import uuid
from datetime import datetime, timezone

from app.common import clock
from tests.test_api import col, mkcard, world

RANGE = {"from": "2026-11-20", "to": "2026-11-26"}


def at(day):
    clock.set_now(lambda: datetime(2026, 11, day, 12, tzinfo=timezone.utc))


def move(w, card, i):
    r = w.client.patch(f"/api/cards/{card["id"]}/move", headers=w.h["supervisor"], json={"column_id": col(w, i), "prev": None, "next": None})
    assert r.status_code == 200, r.get_json()


def team(w, who="manager", **q):
    return w.client.get("/api/analytics/kpi", headers=w.h[who], query_string=q)


def build(w):
    member = str(w.users["member"].id)
    at(20)
    a = mkcard(w, "a", assignee_id=member, end_date="2026-11-25")
    b = mkcard(w, "b", assignee_id=member, end_date="2026-11-23")
    move(w, a, 1)
    move(w, b, 1)
    at(21)
    move(w, b, 3)
    at(22)
    move(w, a, 4)
    at(24)
    move(w, b, 4)
    at(25)
    mkcard(w, "c", i=4, assignee_id=member, end_date="2026-11-26")
    mkcard(w, "d", assignee_id=member, end_date="2026-11-24")
    mkcard(w, "e", assignee_id=member)
    at(26)


EXPECTED = {
    "finished": 3,
    "on_time_rate": 0.667,
    "throughput": 3.0,
    "overdue_now": 1,
    "oldest_overdue_days": 2,
    "cycle_days": 3.0,
    "rework_rate": 0.333,
    "open": 2,
}


def test_team_and_my_kpis_follow_the_definitions(world):
    try:
        build(world)
        data = team(world, **RANGE).get_json()["data"]
        assert data["range"] == {"from": "2026-11-20", "to": "2026-11-26"}
        assert data["team"] == EXPECTED
        rows = {r["id"]: r for r in data["people"]}
        mine = {k: v for k, v in rows[str(world.users["member"].id)].items() if k in EXPECTED}
        assert mine == EXPECTED
        owner = rows[str(world.users["supervisor"].id)]
        assert owner["finished"] == 0 and owner["on_time_rate"] is None and owner["cycle_days"] is None and owner["oldest_overdue_days"] is None
        me = world.client.get("/api/me/kpi", headers=world.h["member"], query_string=RANGE).get_json()["data"]
        assert {k: v for k, v in me.items() if k != "range"} == EXPECTED
        empty = world.client.get("/api/me/kpi", headers=world.h["other_member"], query_string=RANGE).get_json()["data"]
        assert empty["finished"] == 0 and empty["open"] == 0 and empty["throughput"] == 0
    finally:
        clock.set_now(None)


def test_a_range_before_the_work_finds_nothing_finished_but_keeps_the_open_figures(world):
    try:
        build(world)
        data = team(world, **{"from": "2026-11-01", "to": "2026-11-07"}).get_json()["data"]["team"]
        assert data["finished"] == 0 and data["rework_rate"] is None and data["overdue_now"] == 1 and data["open"] == 2
    finally:
        clock.set_now(None)


def test_kpi_access_and_range_rules(world):
    assert team(world, "member").status_code == 403
    assert team(world, "supervisor").status_code == 200
    assert team(world, "admin").status_code == 200
    assert team(world, "other_sup", board=world.board["id"]).status_code == 403
    assert team(world, "other_sup").get_json()["data"]["people"] == []
    assert team(world, board=str(uuid.uuid4())).status_code == 404
    assert team(world, **{"from": "2026-11-20", "to": "2026-11-01"}).status_code == 400
    assert world.client.get("/api/analytics/kpi").status_code == 401
    assert world.client.get("/api/me/kpi").status_code == 401
    for who in ("member", "supervisor", "manager", "admin"):
        assert world.client.get("/api/me/kpi", headers=world.h[who]).status_code == 200
