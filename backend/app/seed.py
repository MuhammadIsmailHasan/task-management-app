import os
import secrets
from datetime import timedelta

import click

from app.common.rich_text import from_plain_text
from datetime import datetime, timezone
from argon2 import PasswordHasher

from app.common import clock
from app.extensions import db
from app.seed_projects import PROJECTS
from app.models import (
    ActivityLog,
    Attachment,
    Board,
    BoardMember,
    Card,
    Category,
    Column,
    Comment,
    Notification,
    Subtask,
    User,
)

ROLES = ("member", "supervisor", "manager", "admin")
SEED_ENVS = ("development", "testing")
USER_NAMES = {
    "member": "Dina Putri",
    "supervisor": "Budi Santoso",
    "manager": "Andi Wijaya",
    "admin": "Nadia Rahman",
}
CREATED_BEFORE_START_DAYS = 2
UNPLANNED_CREATED_DAYS_AGO = 7
BOARD_AGE_DAYS = 35
_hasher = PasswordHasher()


def _get_or_create(username, role, full_name, password, domain="example.com"):
    user = User.query.filter(db.func.lower(User.username) == username).first()
    if user is None:
        user = User(
            full_name=full_name,
            username=username,
            email=f"{username}@{domain}",
            password_hash=_hasher.hash(password),
            role=role,
            email_verified_at=datetime.now(timezone.utc),
        )
        db.session.add(user)
    return user


def create_users_of_each_role(password, domain="example.com", admin_password=None):
    passwords = {role: password for role in ROLES}
    passwords["admin"] = admin_password or password
    users = {role: _get_or_create(role, role, USER_NAMES[role], passwords[role], domain) for role in ROLES}
    db.session.commit()
    return users


DEFAULT_COLUMNS = ("Todo", "In Progress", "Review", "Revision", "Done")
EXTRA_USERS = (
    ("member2", "member", "Raka Pratama"), ("member3", "member", "Sari Wulandari"), ("supervisor2", "supervisor", "Maya Lestari"),
)
DEMO_BOARD = "Website Redesign"


def _user(username, role, full_name, password, domain="example.com"):
    user = _get_or_create(username, role, full_name, password, domain)
    db.session.flush()
    return user


def _board(name, owner, members, categories, now, description=None):
    board = Board(name=name, owner_id=owner.id, description=from_plain_text(description), created_at=now)
    db.session.add(board)
    db.session.flush()
    cols = []
    for i, col_name in enumerate(DEFAULT_COLUMNS):
        col = Column(board_id=board.id, name=col_name, order=float(i))
        db.session.add(col)
        cols.append(col)
    for m in members:
        db.session.add(BoardMember(board_id=board.id, user_id=m.id))
    cats = {}
    for cname, color in categories:
        cat = Category(board_id=board.id, name=cname, color=color)
        db.session.add(cat)
        cats[cname] = cat
    db.session.flush()
    _log(owner, "board.created", "board", board.id, {"name": name}, now)
    for m in members:
        _log(owner, "board.member_added", "board", board.id, {"user_id": str(m.id)}, now)
    return board, cols, cats


def _log(actor, action, target_type, target_id, meta, when):
    db.session.add(
        ActivityLog(actor_id=actor.id, action=action, target_type=target_type, target_id=target_id, metadata_=meta, created_at=when)
    )


def _seed_project(project, users, today, now):
    owner = users[project.owner]
    board, cols, cats = _board(
        project.name, owner, [users[m] for m in project.members], project.categories, now - timedelta(days=BOARD_AGE_DAYS),
        description=project.description,
    )
    columns = {col.name: col for col in cols}
    for position, task in enumerate(project.tasks, start=1):
        age = UNPLANNED_CREATED_DAYS_AGO if task.start is None else max(CREATED_BEFORE_START_DAYS - task.start, CREATED_BEFORE_START_DAYS)
        created = now - timedelta(days=age)
        assignee = users[task.assignee] if task.assignee else None
        card = Card(
            column_id=columns[task.column].id, title=task.title, description=from_plain_text(task.description),
            priority=task.priority, category_id=cats[task.category].id,
            assignee_id=assignee.id if assignee else None,
            start_date=today + timedelta(days=task.start) if task.start is not None else None,
            end_date=today + timedelta(days=task.end) if task.end is not None else None,
            order=float(position), created_at=created,
            completed_at=now - timedelta(days=task.done_ago) if task.done_ago is not None else None,
        )
        db.session.add(card)
        db.session.flush()
        _log(owner, "card.created", "card", card.id, {"title": task.title}, created)
        if assignee:
            _log(owner, "card.assigned", "card", card.id, {"assignee_id": str(assignee.id)}, created)
            if assignee is not owner:
                db.session.add(Notification(user_id=assignee.id, type="assigned", card_id=card.id, notify_date=today, is_read=task.done_ago is not None))
        for order, (title, done) in enumerate(task.subtasks, start=1):
            db.session.add(Subtask(card_id=card.id, title=title, is_done=done, order=float(order)))
        for offset, (author, text) in enumerate(task.comments):
            db.session.add(Comment(card_id=card.id, author_id=users[author].id, content=text, created_at=now + timedelta(seconds=offset)))


def seed_demo_data(password, tz="UTC", admin_password=None):
    if Board.query.filter_by(name=DEMO_BOARD).first():
        return False
    users = create_users_of_each_role(password, admin_password=admin_password)
    for login, role, full_name in EXTRA_USERS:
        users[login] = _user(login, role, full_name, password)
    today = clock.today(tz)
    now = clock.now()
    manager, sup, sup2, member, member2 = (users[k] for k in ("manager", "supervisor", "supervisor2", "member", "member2"))

    board, cols, cats = _board(
        DEMO_BOARD, sup, [member, member2],
        [("Design", "#8b5cf6"), ("Development", "#3b82f6"), ("Bug", "#ef4444")], now - timedelta(days=BOARD_AGE_DAYS),
        description="Redesign the marketing site: new landing page, brand colors, and a faster build.",
    )
    todo, doing, review, revision, done = cols
    cards = [
        ("Design new landing page", todo, "high", "Design", member, -2, 5, "Hero, pricing and footer sections."),
        ("Set up CI pipeline", doing, "medium", "Development", member2, -5, 0, "Run tests on every pull request."),
        ("Fix login redirect loop", doing, "high", "Bug", member, -3, -1, "Users bounce between /login and /."),
        ("Review copy with marketing", review, "low", None, None, None, 7, None),
        ("Update brand colors", revision, "medium", "Design", member2, -7, 3, "Align tokens with the new palette."),
        ("Publish release notes", done, "low", "Development", member, -10, -4, "Shipped with v1.2."),
        ("Write pricing page content", todo, "medium", "Design", member2, 1, 8, "Three plans with a comparison table."),
        ("Image sizes slow the home page", todo, "high", "Bug", member, 0, 2, "Serve smaller images on mobile."),
        ("Add contact form", doing, "medium", "Development", member2, -1, 4, "Validate the email before sending."),
        ("Keyboard navigation check", review, "medium", "Development", member, -2, 1, None),
    ]
    made = {}
    for i, (title, col, prio, cat, assignee, s_off, e_off, desc) in enumerate(cards):
        card = Card(
            column_id=col.id, title=title, description=from_plain_text(desc), priority=prio,
            category_id=cats[cat].id if cat else None,
            assignee_id=assignee.id if assignee else None,
            start_date=today + timedelta(days=s_off) if s_off is not None else None,
            end_date=today + timedelta(days=e_off) if e_off is not None else None,
            order=float(i + 1),
            completed_at=now - timedelta(days=3) if col.name == "Done" else None,
        )
        db.session.add(card)
        db.session.flush()
        made[title] = card
        _log(sup, "card.created", "card", card.id, {"title": title}, now)
        if assignee:
            _log(sup, "card.assigned", "card", card.id, {"assignee_id": str(assignee.id)}, now)
            db.session.add(Notification(user_id=assignee.id, type="assigned", card_id=card.id, notify_date=today, is_read=(col is done)))
        if e_off == 0 and assignee:
            db.session.add(Notification(user_id=assignee.id, type="deadline", card_id=card.id, notify_date=today))
    _log(sup, "card.moved", "card", made["Publish release notes"].id,
         {"from_column_id": str(review.id), "to_column_id": str(done.id)}, now)

    landing = made["Design new landing page"]
    for i, (t, d) in enumerate((("Wireframes", True), ("Visual design", False), ("Responsive check", False))):
        db.session.add(Subtask(card_id=landing.id, title=t, is_done=d, order=float(i + 1)))
    ci = made["Set up CI pipeline"]
    for i, (t, d) in enumerate((("Add workflow file", True), ("Cache dependencies", False))):
        db.session.add(Subtask(card_id=ci.id, title=t, is_done=d, order=float(i + 1)))
    db.session.add(Attachment(card_id=landing.id, name="Design brief", url="https://example.com/design-brief"))
    db.session.add(Attachment(card_id=ci.id, name="Actions docs", url="https://docs.github.com/actions"))

    top = Comment(card_id=landing.id, author_id=manager.id, content="Please prioritise the mobile layout.", is_priority=True, created_at=now)
    db.session.add(top)
    plain = Comment(card_id=landing.id, author_id=member.id, content="Wireframes are ready for review.", created_at=now + timedelta(seconds=1))
    db.session.add(plain)
    db.session.flush()
    for j, (author, text) in enumerate(((sup, "Looks good, go ahead."), (member2, "I can help with the responsive check."))):
        db.session.add(Comment(card_id=landing.id, author_id=author.id, content=text, parent_id=plain.id, created_at=now + timedelta(seconds=2 + j)))
    plain.reply_count = 2
    db.session.add(Comment(card_id=made["Fix login redirect loop"].id, author_id=sup.id, content="Reproduced on Safari only.", created_at=now))

    for project in PROJECTS:
        _seed_project(project, users, today, now)
    db.session.commit()
    return True


def register_cli(app):
    @app.cli.command("seed-users")
    def seed_users():
        """Create one user per role (development/testing only)."""
        if app.config["APP_ENV"] not in SEED_ENVS:
            raise click.ClickException("seed-users only runs when APP_ENV is development or testing")
        password = os.environ.get("SEED_PASSWORD") or secrets.token_urlsafe(16)
        generated = not os.environ.get("SEED_PASSWORD")
        create_users_of_each_role(password)
        click.echo("Seeded users: " + ", ".join(f"{r}@example.com" for r in ROLES))
        if generated:
            click.echo(f"Generated password (shown once): {password}")

    @app.cli.command("seed-data")
    def seed_data():
        """Seed sample rows for every table (development/testing only, idempotent)."""
        if app.config["APP_ENV"] not in SEED_ENVS:
            raise click.ClickException("seed-data only runs when APP_ENV is development or testing")
        password = os.environ.get("SEED_PASSWORD") or secrets.token_urlsafe(16)
        generated = not os.environ.get("SEED_PASSWORD")
        admin_password = os.environ.get("SEED_ADMIN_PASSWORD") or None
        created = seed_demo_data(password, app.config["APP_TIMEZONE"], admin_password)
        if not created:
            click.echo("Demo data already present; nothing changed.")
            return
        click.echo(f"Seeded demo data: {len(PROJECTS) + 1} boards with categories, cards, subtasks, attachments, comments, activity, notifications.")
        click.echo("Users: " + ", ".join(f"{r}@example.com" for r in ROLES) + ", member2@example.com, member3@example.com, supervisor2@example.com")
        if generated:
            click.echo(f"Password for NEW users (shown once): {password}")
