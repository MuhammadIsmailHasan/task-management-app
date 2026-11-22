"""Daily deadline job: one `deadline` notification per assigned card due today."""
import signal
import threading

import click
from flask import current_app

from app.blueprints.notifications import repository as repo
from app.common import clock
from app.extensions import db


def run(now=None):
    if now is not None:
        clock.set_now(lambda: now)
    try:
        today = clock.today(current_app.config["APP_TIMEZONE"])
        cards = repo.cards_due(today)
        for card in cards:
            repo.insert_ignore(card.assignee_id, card.id, "deadline", today)
        db.session.commit()
        return len(cards)
    finally:
        if now is not None:
            clock.set_now(None)


INTERVAL_SECONDS = 3600


def run_forever(stop):
    """Run at once and then hourly until `stop` is set. A repeated run inserts nothing, and a failed run is retried on the next round."""
    while not stop.is_set():
        try:
            click.echo(f"Processed {run()} due cards")
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Deadline run failed; it runs again on the next round")
        finally:
            db.session.remove()
        stop.wait(INTERVAL_SECONDS)


def register_cli(app):
    @app.cli.command("notify-deadlines")
    def notify_deadlines():
        """Create deadline notifications for cards due today (run daily)."""
        click.echo(f"Processed {run()} due cards")

    @app.cli.command("run-scheduler")
    def run_scheduler():
        """Run notify-deadlines now and every hour, until SIGTERM or SIGINT."""
        stop = threading.Event()
        for sig in (signal.SIGTERM, signal.SIGINT):  # explicit: PID 1 in a container ignores SIGTERM by default
            signal.signal(sig, lambda *_: stop.set())
        run_forever(stop)
