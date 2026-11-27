from datetime import date, datetime, timedelta, timezone

from hypothesis import given, strategies as st

from app.common import clock
from app.common.due import due_state
from tests.helpers import PROP
from tests.test_api import col, mkcard, world

TODAY = date(2026, 11, 26)
NOW = datetime(2026, 11, 26, 12, 0, tzinfo=timezone.utc)


def test_the_rule():
    assert due_state(TODAY - timedelta(days=1), "Todo", TODAY) == "overdue"
    assert due_state(TODAY, "Todo", TODAY) is None
    assert due_state(TODAY + timedelta(days=1), "Todo", TODAY) == "due_tomorrow"
    assert due_state(TODAY + timedelta(days=2), "Todo", TODAY) is None
    assert due_state(None, "Todo", TODAY) is None
    assert due_state(TODAY - timedelta(days=9), "Done", TODAY) is None


@PROP
@given(st.integers(-400, 400), st.sampled_from(["Todo", "In Progress", "Review", "Revision", "Done"]), st.booleans())
def test_property_79_due_state(offset, column, has_date):
    end = TODAY + timedelta(days=offset) if has_date else None
    got = due_state(end, column, TODAY)
    if end is None or column == "Done":
        assert got is None
    elif end < TODAY:
        assert got == "overdue"
    elif end == TODAY + timedelta(days=1):
        assert got == "due_tomorrow"
    else:
        assert got is None


def test_the_payload_carries_due_state_in_the_list_the_detail_and_the_shared_view(world):
    with_clock(NOW)
    try:
        late = mkcard(world, title="late", end_date="2026-11-24")
        soon = mkcard(world, title="soon", end_date="2026-11-27")
        done = mkcard(world, title="done", i=4, end_date="2026-11-20")
        listed = {c["title"]: c["due_state"] for c in world.client.get(f"/api/boards/{world.board['id']}/cards", headers=world.h["manager"]).get_json()["data"]}
        assert listed == {"late": "overdue", "soon": "due_tomorrow", "done": None}
        assert world.client.get(f"/api/cards/{late['id']}", headers=world.h["manager"]).get_json()["data"]["due_state"] == "overdue"
        assert soon["due_state"] == "due_tomorrow" and done["due_state"] is None
        share = world.client.post(f"/api/boards/{world.board['id']}/share", headers=world.h["manager"]).get_json()["data"]["token"]
        shared = {c["title"]: c["due_state"] for c in world.client.get(f"/api/shared/{share}/cards").get_json()["data"]}
        assert shared == listed
    finally:
        clock.set_now(None)


def test_a_posted_due_state_is_a_400(world):
    card = mkcard(world)
    r = world.client.patch(f"/api/cards/{card['id']}", headers=world.h["manager"], json={"due_state": "overdue"})
    assert r.status_code == 400
    r = world.client.post(f"/api/columns/{col(world)}/cards", headers=world.h["manager"], json={"title": "x", "due_state": "overdue"})
    assert r.status_code == 400


def with_clock(value):
    clock.set_now(lambda: value)
