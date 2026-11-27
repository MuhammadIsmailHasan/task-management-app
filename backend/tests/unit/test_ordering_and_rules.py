"""Unit tests of small pure rules: card ordering, slugs, due state, login throttling, rich text."""
from datetime import date, datetime, timedelta, timezone

from app.common.due import due_state
from app.common.ordering import needs_rebalance, position_for, rebalance
from app.common.rate_limiter import blocked_until
from app.common.rich_text import clean_html, to_text
from app.common.slug import pick_free, slugify


def test_position_for_places_between_before_and_after():
    assert position_for(None, None, []) == 1.0
    assert position_for(None, None, [1.0, 2.0]) == 3.0
    assert position_for(None, 1.0, [1.0, 2.0]) == 0.0
    assert position_for(2.0, None, [1.0, 2.0]) == 3.0
    assert position_for(1.0, 2.0, [1.0, 2.0]) == 1.5


def test_rebalance_when_neighbours_are_too_close():
    assert needs_rebalance(1.0, 1.0 + 1e-9) and not needs_rebalance(1.0, 2.0) and not needs_rebalance(None, 2.0)
    assert rebalance([0.1, 0.2, 0.3]) == [1.0, 2.0, 3.0]


def test_slugs():
    assert slugify("  Sales Plan 2026! ") == "sales-plan-2026"
    assert pick_free("sales", {"sales", "sales-2"}) == "sales-3"
    assert pick_free("sales", set()) == "sales"


def test_due_state():
    today = date(2026, 11, 27)
    assert due_state(today - timedelta(days=1), "Todo", today) == "overdue"
    assert due_state(today + timedelta(days=1), "Todo", today) == "due_tomorrow"
    assert due_state(today, "Todo", today) is None
    assert due_state(today - timedelta(days=1), "Done", today) is None
    assert due_state(None, "Todo", today) is None


def test_login_throttle_window():
    now = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    window = timedelta(minutes=15)
    times = [now - timedelta(minutes=m) for m in (1, 2, 3)]
    assert blocked_until(times, now, window, 4) is None
    assert blocked_until(times, now, window, 3) == 12 * 60  # the oldest of the 3 leaves the window in 12 minutes
    assert blocked_until([now - timedelta(minutes=20)] * 5, now, window, 3) is None


def test_rich_text_allowlist():
    assert clean_html('<p onclick="x()">Hi<script>bad()</script></p>') == "<p>Hi</p>"
    assert clean_html("<p> </p>") is None
    assert to_text("<h2>A</h2><p>b &amp; c</p>") == "A b & c"
