from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from flask import current_app

from app.blueprints.analytics import repository as repo
from app.blueprints.boards import service as boards
from app.common import clock
from app.common.errors import Forbidden
from app.common.ids import to_uuid


def _shape(row):
    board_id, name, total, done, in_progress, overdue, delta = row
    return {
        "board_id": str(board_id),
        "name": name,
        "total": int(total),
        "done": int(done),
        "in_progress": int(in_progress),
        "overdue": int(overdue),
        "done_delta": int(delta),
    }


def _args():
    now = clock.now()
    return clock.today(current_app.config["APP_TIMEZONE"]), now - timedelta(days=7)


def week_boundaries(weeks, now, tz_name):
    """Start instants (UTC) of `weeks` weeks ending with the current one, plus the end of the current week.

    A week runs Monday 00:00 to the next Monday 00:00 in the application time zone (DST-safe: built from local dates).
    """
    tz = ZoneInfo(tz_name)
    today = now.astimezone(tz).date()
    monday = today - timedelta(days=today.weekday())
    starts = [monday - timedelta(days=7 * (weeks - 1 - i)) for i in range(weeks)] + [monday + timedelta(days=7)]
    return starts[:-1], [datetime.combine(d, time.min, tzinfo=tz).astimezone(timezone.utc) for d in starts]


def _throughput_shape(week_starts, rows_by_board, board_id, name):
    done = rows_by_board.get(board_id, {})
    weeks = [{"week_start": d, "done": int(done.get(i, 0))} for i, d in enumerate(week_starts)]
    return {"board_id": str(board_id), "name": name, "weeks": weeks, "total": sum(w["done"] for w in weeks)}


def _throughput(weeks, board_id=None):
    starts, boundaries = week_boundaries(weeks, clock.now(), current_app.config["APP_TIMEZONE"])
    rows = repo.throughput(boundaries, board_id)
    names, by_board = {}, {}
    for bid, name, idx, count in rows:
        names[bid] = name
        if idx is not None:
            by_board.setdefault(bid, {})[int(idx)] = int(count)
    return [_throughput_shape(starts, by_board, bid, names[bid]) for bid in names]


def board_throughput(actor, board_id, weeks):
    board = boards.load_board(actor, board_id)
    if not (actor.role == "manager" or (actor.role == "supervisor" and boards.is_owner(actor, board))):
        raise Forbidden("Analytics not available for this role")
    return _throughput(weeks, board.id)[0]


def all_throughput(actor, weeks):
    if actor.role != "manager":
        raise Forbidden("Manager only")
    return _throughput(weeks)


def board_analytics(actor, board_id):
    board = boards.load_board(actor, board_id)
    if not (actor.role == "manager" or (actor.role == "supervisor" and boards.is_owner(actor, board))):
        raise Forbidden("Analytics not available for this role")
    today, week_ago = _args()
    return _shape(repo.summaries(today, week_ago, board.id)[0])


def all_boards(actor):
    if actor.role != "manager":
        raise Forbidden("Manager only")
    today, week_ago = _args()
    return [_shape(r) for r in repo.summaries(today, week_ago)]
