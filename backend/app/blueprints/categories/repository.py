from app.extensions import db
from app.models import Card, Category


def list_for_board(board_id):
    return Category.query.filter_by(board_id=board_id).order_by(db.func.lower(Category.name)).all()


def get(category_id):
    return db.session.get(Category, category_id)


def find_by_name(board_id, name, exclude_id=None):
    q = Category.query.filter(Category.board_id == board_id, db.func.lower(Category.name) == name.lower())
    if exclude_id is not None:
        q = q.filter(Category.id != exclude_id)
    return q.first()


def add(board_id, name, color):
    c = Category(board_id=board_id, name=name, color=color)
    db.session.add(c)
    db.session.flush()
    return c


def delete(category):
    Card.query.filter_by(category_id=category.id).update({"category_id": None})
    db.session.delete(category)
