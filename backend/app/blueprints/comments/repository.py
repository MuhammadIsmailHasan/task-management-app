from sqlalchemy.orm import selectinload

from app.common import clock
from app.extensions import db
from app.models import Card, Comment, User


def get(comment_id):
    c = db.session.get(Comment, comment_id)
    if c is None:
        return None
    card = db.session.get(Card, c.card_id)
    return c if card is not None and card.deleted_at is None else None


def add(card_id, author_id, content, parent_id=None):
    c = Comment(card_id=card_id, author_id=author_id, content=content, parent_id=parent_id,
                created_at=clock.now())
    db.session.add(c)
    db.session.flush()
    return c


def list_for_card(card_id, sort="latest", limit=None, offset=0):
    """Top-level comments with replies loaded, plus author roles: 3 queries whatever the row count.

    Returns (comments, roles) where roles maps author id to role for comments and replies.
    """
    order = [Comment.is_priority.desc()]
    if sort == "popular":
        # priority comments stay newest first: reply_count only ranks the non-priority rest
        rank = db.case((Comment.is_priority.is_(True), 0), else_=Comment.reply_count)
        order += [rank.desc(), Comment.created_at.desc(), Comment.id.desc()]
    else:
        order += [Comment.created_at.desc(), Comment.id.desc()]
    rows = db.session.execute(
        db.select(Comment, User.role)
        .join(User, User.id == Comment.author_id)
        .where(Comment.card_id == card_id, Comment.parent_id.is_(None))
        .options(selectinload(Comment.replies))
        .order_by(*order)
        .limit(limit)
        .offset(offset or 0)
        .execution_options(populate_existing=True)
    ).all()
    comments = [c for c, _ in rows]
    roles = {c.author_id: role for c, role in rows}
    reply_authors = {r.author_id for c in comments for r in c.replies} - set(roles)
    if reply_authors:
        roles.update(dict(db.session.execute(db.select(User.id, User.role).where(User.id.in_(reply_authors))).all()))
    return comments, roles


def count_top_level(card_id):
    return db.session.scalar(db.select(db.func.count(Comment.id)).where(Comment.card_id == card_id, Comment.parent_id.is_(None)))


def author_identities(comments):
    """Name and avatar path of the authors of these comments and their replies: one query whatever the row count."""
    from app.blueprints.auth import repository as users

    ids = {c.author_id for c in comments}
    for c in comments:
        if "replies" in c.__dict__:  # replies are loaded explicitly by list_for_card; never lazy-load here
            ids |= {r.author_id for r in c.replies}
    return users.identities(ids)


def reply_ids(parent_id):
    return list(db.session.scalars(db.select(Comment.id).where(Comment.parent_id == parent_id)))


def delete_replies(parent_id):
    """Replies go first so the foreign key on parent_id never blocks the parent (decision: explicit delete, no ON DELETE CASCADE)."""
    return db.session.execute(db.delete(Comment).where(Comment.parent_id == parent_id)).rowcount


def delete(comment):
    db.session.delete(comment)
    db.session.flush()
