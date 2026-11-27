import signal
import threading
import uuid
from datetime import timedelta

import click
from flask import current_app

from app.common import clock
from app.extensions import db
from app.models import Board, Card, Column, Notification, NotificationPreference, User

INTERVAL_SECONDS = 900
LOCK_KEY = 8_452_017


def _insert():
    if db.engine.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    return insert


def _candidates(day, type_):
    enabled = db.or_(NotificationPreference.enabled.is_(None), NotificationPreference.enabled.is_(True))
    return db.session.execute(
        db.select(Card.id, Card.assignee_id, Card.board_id)
        .select_from(Card)
        .join(Column, Card.column_id == Column.id)
        .join(Board, Board.id == Card.board_id)
        .join(User, User.id == Card.assignee_id)
        .outerjoin(NotificationPreference, db.and_(NotificationPreference.user_id == Card.assignee_id, NotificationPreference.type == type_))
        .where(Card.end_date == day, Card.deleted_at.is_(None), Card.archived_at.is_(None), Column.name != "Done", Board.deleted_at.is_(None), User.is_active.is_(True), enabled)
    ).all()


def _create(rows, type_, today):
    if not rows:
        return 0
    now = clock.now()
    values = [
        {"id": uuid.uuid4(), "user_id": r.assignee_id, "card_id": r.id, "board_id": r.board_id, "type": type_, "notify_date": today, "is_read": False, "created_at": now, "updated_at": now}
        for r in rows
    ]
    result = db.session.execute(_insert()(Notification).values(values).on_conflict_do_nothing())
    return max(result.rowcount, 0)


def run(now=None):
    if now is not None:
        clock.set_now(lambda: now)
    try:
        if db.engine.dialect.name == "postgresql":
            if not db.session.scalar(db.text("SELECT pg_try_advisory_lock(:k)").bindparams(k=LOCK_KEY)):
                return None
        today = clock.today(current_app.config["APP_TIMEZONE"])
        today_rows, tomorrow_rows = _candidates(today, "due_today"), _candidates(today + timedelta(days=1), "due_tomorrow")
        made_today = _create(today_rows, "due_today", today)
        made_tomorrow = _create(tomorrow_rows, "due_tomorrow", today)
        db.session.commit()
        return made_today, made_tomorrow, len(today_rows) + len(tomorrow_rows) - made_today - made_tomorrow
    finally:
        if db.engine.dialect.name == "postgresql":
            db.session.execute(db.text("SELECT pg_advisory_unlock(:k)").bindparams(k=LOCK_KEY))
            db.session.commit()
        if now is not None:
            clock.set_now(None)


def _line(result):
    if result is None:
        return "notify-due skipped: another run is in progress"
    return f"due_today={result[0]} due_tomorrow={result[1]} skipped={result[2]}"


def run_forever(stop):
    while not stop.is_set():
        try:
            click.echo(_line(run()))
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Due-date run failed; it runs again on the next round")
        finally:
            db.session.remove()
        stop.wait(INTERVAL_SECONDS)


def register_cli(app):
    @app.cli.command("notify-due")
    def notify_due():
        """Create due-today and due-tomorrow notifications (run every 15 minutes)."""
        click.echo(_line(run()))

    @app.cli.command("run-scheduler")
    def run_scheduler():
        """Run notify-due now and every 15 minutes, until SIGTERM or SIGINT."""
        stop = threading.Event()
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, lambda *_: stop.set())
        run_forever(stop)
