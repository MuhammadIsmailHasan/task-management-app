from app.blueprints.boards import repository as boards_repo
from app.extensions import db
from app.models import Attachment, Card, Column, User


def board_by_token(token):
    return boards_repo.get_by_share_token(token)


def card_in_board(board_id, card_id):
    from app.blueprints.cards import repository as cards_repo

    card = cards_repo.get_detail(card_id)
    if card is None:
        return None
    return card if card.board_id == board_id and card.archived_at is None else None


def attachment_in_board(board_id, attachment_id):
    att = db.session.get(Attachment, attachment_id)
    if att is None:
        return None
    card = db.session.get(Card, att.card_id)
    if card is None or card.deleted_at is not None:
        return None
    return att if card.board_id == board_id and card.archived_at is None else None


def names_of(user_ids):
    if not user_ids:
        return {}
    rows = db.session.execute(db.select(User.id, User.full_name).where(User.id.in_(user_ids))).all()
    return {row.id: row.full_name for row in rows}
