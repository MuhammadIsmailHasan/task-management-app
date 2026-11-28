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
    if not (actor.role in ("manager", "admin") or (actor.role == "supervisor" and boards.is_owner(actor, board))):
        raise Forbidden("Analytics not available for this role")
    return _throughput(weeks, board.id)[0]


def all_throughput(actor, weeks):
    if actor.role not in ("manager", "admin"):
        raise Forbidden("Manager only")
    return _throughput(weeks)


def board_analytics(actor, board_id):
    board = boards.load_board(actor, board_id)
    if not (actor.role in ("manager", "admin") or (actor.role == "supervisor" and boards.is_owner(actor, board))):
        raise Forbidden("Analytics not available for this role")
    today, week_ago = _args()
    return _shape(repo.summaries(today, week_ago, board.id)[0])


def all_boards(actor):
    if actor.role not in ("manager", "admin"):
        raise Forbidden("Manager only")
    today, week_ago = _args()
    return [_shape(r) for r in repo.summaries(today, week_ago)]


DEFAULT_DAYS = 30
MAX_DAYS = 182
LIST_LIMIT = 10
TOP_LIMIT = 5


def _tz():
    return ZoneInfo(current_app.config["APP_TIMEZONE"])


def _local_start(day):
    return datetime.combine(day, time.min, tzinfo=_tz()).astimezone(timezone.utc)


def _card(row):
    from app.common.due import due_state

    today = clock.today(current_app.config["APP_TIMEZONE"])
    return {
        "id": str(row.id),
        "title": row.title,
        "board_id": str(row.board_id),
        "board_slug": row.slug,
        "board_name": row.board_name,
        "priority": row.priority,
        "end_date": row.end_date.isoformat() if row.end_date else None,
        "due_state": due_state(row.end_date, None, today),
        "assignee_name": row.assignee_name,
    }


def _scope(actor, board_id):
    if actor.role not in ("supervisor", "manager", "admin"):
        raise Forbidden("Analytics not available for this role")
    if board_id is not None:
        board = boards.load_board(actor, board_id)
        if not (actor.role in ("manager", "admin") or boards.is_owner(actor, board)):
            raise Forbidden("Analytics not available for this role")
        return [board.id]
    owner = to_uuid(actor.id) if actor.role == "supervisor" else None
    return [bid for bid, _ in repo.boards_in_scope(owner_id=owner)]


def _range(date_from, date_to, today):
    from app.common.errors import ValidationError

    date_to = date_to or today
    date_from = date_from or (date_to - timedelta(days=DEFAULT_DAYS - 1))
    if date_from > date_to or (date_to - date_from).days + 1 > MAX_DAYS:
        raise ValidationError("The date range must be at most 26 weeks and start on or before its end", details={"from": ["invalid range"]})
    return date_from, date_to


def dashboard(actor, board_id, member, date_from, date_to, due_on):
    from app.common.identities import Identity, avatar_urls

    tz_name = current_app.config["APP_TIMEZONE"]
    today = clock.today(tz_name)
    date_from, date_to = _range(date_from, date_to, today)
    due_on = due_on or today + timedelta(days=1)
    ids = _scope(actor, to_uuid(board_id) if board_id else None)
    if not ids:
        ids = []
    member_id = to_uuid(member) if member else None

    empty = not ids
    ov = repo.overview(ids, member_id, today) if not empty else [0, 0, 0, 0]
    od_count, od_rows = repo.overdue_cards(ids, member_id, today, date_from, date_to, LIST_LIMIT) if not empty else (0, [])
    dt_count, dt_rows = repo.due_on_cards(ids, member_id, due_on, LIST_LIMIT) if not empty else (0, [])
    top = repo.top_priority(ids, member_id, TOP_LIMIT) if not empty else []

    first_monday = date_from - timedelta(days=date_from.weekday())
    last_monday = date_to - timedelta(days=date_to.weekday())
    n_weeks = (last_monday - first_monday).days // 7 + 1
    starts = [first_monday + timedelta(days=7 * i) for i in range(n_weeks)]
    boundaries = [_local_start(d) for d in starts] + [_local_start(last_monday + timedelta(days=7))]
    done_by_week = repo.weekly_done(boundaries, ids, member_id) if not empty else {}
    weeks = [{"week_start": d.isoformat(), "done": int(done_by_week.get(i, 0))} for i, d in enumerate(starts)]

    on_time = overdue = 0
    if not empty:
        lo_dt, hi_dt = _local_start(date_from), _local_start(date_to + timedelta(days=1))
        for completed_at, end_date in repo.finished_pairs(ids, member_id, lo_dt, hi_dt):
            done_day = (completed_at if completed_at.tzinfo else completed_at.replace(tzinfo=timezone.utc)).astimezone(_tz()).date()
            if done_day <= end_date:
                on_time += 1
            else:
                overdue += 1

    people = repo.people(ids) if not empty else []
    idents = {p.id: Identity(p.full_name, p.avatar_path) for p in people}
    urls = avatar_urls(idents, clock.now())
    return {
        "range": {"from": date_from.isoformat(), "to": date_to.isoformat()},
        "today": today.isoformat(),
        "overview": {"total": ov[0], "done": ov[1], "in_progress": ov[2], "overdue": ov[3]},
        "throughput": {"weeks": weeks, "total": sum(w["done"] for w in weeks)},
        "overdue": {"count": od_count, "cards": [_card(r) for r in od_rows]},
        "due_tomorrow": {"count": dt_count, "due_on": due_on.isoformat(), "cards": [_card(r) for r in dt_rows]},
        "top_priority": {"cards": [_card(r) for r in top]},
        "finished": {"on_time": on_time, "overdue": overdue},
        "members": [{"id": str(p.id), "full_name": p.full_name, "avatar_url": urls.get(p.id)} for p in people],
    }


MIN_SAMPLE = 3
DAYS_PER_WEEK = 7
SECONDS_PER_DAY = 86400
TODO = "Todo"
REVISION = "Revision"


def _aware(value):
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _rate(part, whole):
    return round(part / whole, 3) if whole >= MIN_SAMPLE else None


def _figures(finished, open_rows, moves_by_card, today, weeks):
    rated = on_time = reworked = 0
    cycles = []
    for card_id, _assignee, completed_at, end_date in finished:
        done_at = _aware(completed_at)
        if end_date is not None:
            rated += 1
            on_time += done_at.astimezone(_tz()).date() <= end_date
        moves = [(meta or {}, _aware(at)) for meta, at in moves_by_card.get(card_id, []) if _aware(at) <= done_at]
        started = next((at for meta, at in moves if meta.get("from_column_name") == TODO), None)
        if started is not None:
            cycles.append((done_at - started).total_seconds() / SECONDS_PER_DAY)
        reworked += any(meta.get("to_column_name") == REVISION for meta, _ in moves)
    late = [end for _a, end in open_rows if end is not None and end < today]
    return {
        "finished": len(finished),
        "on_time_rate": _rate(on_time, rated),
        "throughput": round(len(finished) / weeks, 1),
        "overdue_now": len(late),
        "oldest_overdue_days": (today - min(late)).days if late else None,
        "cycle_days": round(sum(cycles) / len(cycles), 1) if cycles else None,
        "rework_rate": _rate(reworked, len(finished)),
        "open": len(open_rows),
    }


def _kpi_inputs(ids, date_from, date_to, assignee_id=None):
    lo, hi = _local_start(date_from), _local_start(date_to + timedelta(days=1))
    finished = repo.kpi_finished(ids, lo, hi, assignee_id) if ids else []
    open_rows = repo.kpi_open(ids, assignee_id) if ids else []
    moves = {}
    for card_id, meta, at in repo.kpi_moves([row[0] for row in finished]):
        moves.setdefault(card_id, []).append((meta, at))
    return finished, open_rows, moves


def _weeks(date_from, date_to):
    return ((date_to - date_from).days + 1) / DAYS_PER_WEEK


def kpi(actor, board_id, date_from, date_to):
    from app.common.identities import Identity, avatar_urls

    today = clock.today(current_app.config["APP_TIMEZONE"])
    date_from, date_to = _range(date_from, date_to, today)
    ids = _scope(actor, to_uuid(board_id) if board_id else None)
    finished, open_rows, moves = _kpi_inputs(ids, date_from, date_to)
    weeks = _weeks(date_from, date_to)
    people = repo.people(ids) if ids else []
    urls = avatar_urls({p.id: Identity(p.full_name, p.avatar_path) for p in people}, clock.now())
    rows = []
    for p in people:
        mine = [f for f in finished if f[1] == p.id]
        rows.append({"id": str(p.id), "full_name": p.full_name, "avatar_url": urls.get(p.id), **_figures(mine, [o for o in open_rows if o[0] == p.id], moves, today, weeks)})
    return {
        "range": {"from": date_from.isoformat(), "to": date_to.isoformat()},
        "team": _figures(finished, open_rows, moves, today, weeks),
        "people": rows,
    }


def my_kpi(actor, date_from, date_to):
    today = clock.today(current_app.config["APP_TIMEZONE"])
    date_from, date_to = _range(date_from, date_to, today)
    ids = [bid for bid, _ in repo.boards_in_scope()]
    finished, open_rows, moves = _kpi_inputs(ids, date_from, date_to, to_uuid(actor.id))
    return {"range": {"from": date_from.isoformat(), "to": date_to.isoformat()}, **_figures(finished, open_rows, moves, today, _weeks(date_from, date_to))}
