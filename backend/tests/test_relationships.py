import pathlib
import re
import uuid
from contextlib import contextmanager

import pytest
from sqlalchemy import event
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import selectinload

from app.blueprints.cards import repository as cards_repo
from app.blueprints.comments import repository as comments_repo
from app.extensions import db
from app.models import Attachment, Board, BoardMember, Card, Column, Comment, Subtask

ROOT = pathlib.Path(__file__).resolve().parents[1]


@contextmanager
def count_queries():
    stmts = []

    def listener(conn, cursor, statement, params, context, executemany):
        stmts.append(statement)

    event.listen(db.engine, "before_cursor_execute", listener)
    try:
        yield stmts
    finally:
        event.remove(db.engine, "before_cursor_execute", listener)


def seed_board(n_cards, make_user):
    author = make_user("manager")
    board = Board(name=f"b{n_cards}")
    db.session.add(board)
    db.session.flush()
    col = Column(board_id=board.id, name="Todo", order=0)
    db.session.add(col)
    db.session.flush()
    for i in range(n_cards):
        card = Card(column_id=col.id, title=f"c{i}", order=float(i))
        db.session.add(card)
        db.session.flush()
        for j in range(3):
            db.session.add(Subtask(card_id=card.id, title=f"s{j}", order=float(j)))
        db.session.add(Attachment(card_id=card.id, name="l", url="https://e.com"))
        top = Comment(card_id=card.id, author_id=author.id, content=f"t{i}")
        db.session.add(top)
        db.session.flush()
        for j in range(2):
            db.session.add(Comment(card_id=card.id, author_id=author.id, content="r", parent_id=top.id))
    db.session.commit()
    return board, col


def test_property_39_cards_list_query_count_constant(app, make_user):
    b5, _ = seed_board(5, make_user)
    b50, _ = seed_board(50, make_user)
    counts = []
    for bid in (b5.id, b50.id):
        db.session.expire_all()
        with count_queries() as q:
            cards = cards_repo.list_for_board(bid, {})
            assert all(len(c.subtasks) == 3 and len(c.attachments) == 1 for c in cards)
        counts.append(len(q))
    assert counts[0] == counts[1] == 3


def test_property_39_endpoint_query_count_constant(app, client, make_user, auth):
    headers = auth(make_user("manager", "mgr1"))
    b5, _ = seed_board(5, make_user)
    b50, _ = seed_board(50, make_user)
    counts = []
    for bid in (b5.id, b50.id):
        db.session.expire_all()
        with count_queries() as q:
            r = client.get(f"/api/boards/{bid}/cards", headers=headers)
            assert r.status_code == 200
        counts.append(len(q))
    assert counts[0] == counts[1]


def test_property_39_comment_list_query_count_constant(app, make_user):
    seed_board(1, make_user)
    counts = []
    for n in (5, 50):
        board, col = seed_board(n, make_user)
        card_ids = [c.id for c in Card.query.filter_by(column_id=col.id).all()]
        for i in range(n):
            db.session.add(Comment(card_id=card_ids[0], author_id=Comment.query.first().author_id, content="x"))
        db.session.commit()
        db.session.expire_all()
        with count_queries() as q:
            comments, roles = comments_repo.list_for_card(card_ids[0])
            assert all(c.replies is not None for c in comments)
        counts.append(len(q))
    assert counts[0] == counts[1]


@pytest.mark.parametrize(
    "model,attr",
    [(Card, "subtasks"), (Card, "attachments"), (Board, "columns"), (Board, "members"), (Comment, "replies")],
)
def test_unloaded_relationship_raises_then_loads(app, make_user, model, attr):
    board, col = seed_board(1, make_user)
    db.session.add(BoardMember(board_id=board.id, user_id=make_user().id))
    db.session.commit()
    db.session.expire_all()
    obj = db.session.get(model, {Card: Card.query.first().id, Board: board.id, Comment: Comment.query.filter(Comment.parent_id.is_(None)).first().id}[model])
    with pytest.raises(InvalidRequestError):
        getattr(obj, attr)
    db.session.expire_all()
    loaded = db.session.scalars(
        db.select(model).where(model.id == obj.id).options(selectinload(getattr(model, attr)))
    ).one()
    assert getattr(loaded, attr) is not None


def test_replies_ordered_oldest_first_and_inverse_loads(app, make_user):
    board, col = seed_board(1, make_user)
    top = Comment.query.filter(Comment.parent_id.is_(None)).first()
    db.session.expire_all()
    got = db.session.scalars(db.select(Comment).where(Comment.id == top.id).options(selectinload(Comment.replies))).one()
    times = [r.created_at for r in got.replies]
    assert times == sorted(times) and len(times) == 2


def test_static_models_have_no_to_dict_and_relationships_are_strict():
    models_src = "".join(p.read_text() for p in (ROOT / "app" / "models").glob("*.py"))
    assert "to_dict" not in models_src
    rels = re.findall(r"db\.relationship\((.*?)\)\n", models_src, re.S)
    assert len(rels) == 10
    for r in rels:
        assert 'lazy="raise"' in r and "back_populates" in r and "cascade" not in r and "backref" not in r
