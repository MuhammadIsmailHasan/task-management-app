from argon2 import PasswordHasher

from app.extensions import db
from app.models import User
from app.seed_projects import PROJECTS


def test_seed_refuses_outside_dev_and_testing(make_app):
    app = make_app("production")
    with app.app_context():
        db.create_all()
        result = app.test_cli_runner().invoke(args=["seed-users"])
        assert result.exit_code != 0 and "development or testing" in result.output
        assert User.query.count() == 0


def test_seed_uses_env_password_or_generates_one(make_app, monkeypatch):
    app = make_app("testing")
    with app.app_context():
        db.create_all()
        monkeypatch.delenv("SEED_PASSWORD", raising=False)
        out = app.test_cli_runner().invoke(args=["seed-users"]).output
        assert "Generated password (shown once)" in out
        assert User.query.count() == 4
        assert all(u.password_hash.startswith("$argon2") for u in User.query.all())


def test_seed_data_fills_every_table_and_is_idempotent(make_app, monkeypatch):
    from app.extensions import db as _db
    from app.models import (ActivityLog, Attachment, Board, BoardMember, Card, Category, Column,
                            Comment, Notification, Subtask)

    app = make_app("testing")
    with app.app_context():
        _db.create_all()
        monkeypatch.delenv("SEED_PASSWORD", raising=False)
        runner = app.test_cli_runner()
        assert "Seeded demo data" in runner.invoke(args=["seed-data"]).output
        for model in (User, Board, BoardMember, Column, Category, Card, Subtask, Attachment, Comment, ActivityLog, Notification):
            assert model.query.count() > 0, model.__name__
        counts = {m: m.query.count() for m in (User, Board, Card, Comment)}
        assert "already present" in runner.invoke(args=["seed-data"]).output
        assert counts == {m: m.query.count() for m in (User, Board, Card, Comment)}
        assert Comment.query.filter(Comment.parent_id.isnot(None)).count() == 2
        assert Board.query.count() == len(PROJECTS) + 1
        done = {c.id for c in Column.query.filter_by(name="Done")}
        assert all((card.completed_at is not None) == (card.column_id in done) for card in Card.query.all())
        members = {(m.board_id, m.user_id) for m in BoardMember.query.all()}
        owners = {(b.id, b.owner_id) for b in Board.query.all()}
        assert all((c.board_id, c.assignee_id) in members | owners for c in Card.query.all() if c.assignee_id)
        written = {(c.card_id, c.author_id) for c in Comment.query.all()}
        board_of = {c.id: c.board_id for c in Card.query.all()}
        outsiders = {u.id for u in User.query.filter(User.role.in_(("manager", "admin")))}
        assert all((board_of[card], author) in members | owners or author in outsiders for card, author in written)
        assert BoardMember.query.join(User, User.id == BoardMember.user_id).filter(User.role.in_(("manager", "admin"))).count() == 0


def test_seed_data_gives_admin_its_own_password_when_set(make_app, monkeypatch):
    app = make_app("testing")
    with app.app_context():
        db.create_all()
        monkeypatch.setenv("SEED_PASSWORD", "demo-password-1")
        monkeypatch.setenv("SEED_ADMIN_PASSWORD", "private-admin-2")
        assert app.test_cli_runner().invoke(args=["seed-data"]).exit_code == 0
        for user in User.query.all():
            expected = "private-admin-2" if user.role == "admin" else "demo-password-1"
            assert PasswordHasher().verify(user.password_hash, expected), user.username


def test_seed_data_refuses_in_production(make_app):
    result = make_app("production").test_cli_runner().invoke(args=["seed-data"])
    assert result.exit_code != 0
