from flask import current_app

from app.blueprints.boards import service as boards
from app.blueprints.boards.dto import serialize_column
from app.blueprints.cards import repository as cards_repo
from app.blueprints.cards import service as cards
from app.blueprints.cards.dto import progress_fields, serialize_attachment, serialize_subtask
from app.blueprints.categories import repository as categories_repo
from app.blueprints.categories.service import serialize as serialize_category
from app.blueprints.shared import repository as repo
from app.common import clock
from app.common.due import due_state
from app.common.errors import NotFound
from app.common.http import iso
from app.common.ids import to_uuid
from app.common.signing import share_scope


def _board(token):
    board = repo.board_by_token(token)
    if board is None:
        raise NotFound("Not found")
    return board


def get_board(token, actor):
    board = _board(token)
    return {
        "id": str(board.id),
        "name": board.name,
        "description": board.description,
        "columns": [serialize_column(c) for c in board.columns],
        "has_board_access": actor is not None and boards.can_access(actor, board),
    }


def _card(card, names, board):
    now = clock.now()
    scope = share_scope(board.share_token)
    return {
        "id": str(card.id),
        "column_id": str(card.column_id) if card.column_id else None,
        "category_id": str(card.category_id) if card.category_id else None,
        "assignee_id": str(card.assignee_id) if card.assignee_id else None,
        "assignee_name": names.get(card.assignee_id),
        "title": card.title,
        "description": card.description,
        "priority": card.priority,
        "start_date": iso(card.start_date),
        "end_date": iso(card.end_date),
        "order": card.order,
        "archived_at": iso(card.archived_at),
        "due_state": due_state(card.end_date, {c.id: c.name for c in board.columns}.get(card.column_id), clock.today(current_app.config["APP_TIMEZONE"])),
        "subtasks": [serialize_subtask(s) for s in card.subtasks],
        **progress_fields(card.subtasks),
        "attachments": [serialize_attachment(a, now, scope) for a in card.attachments],
    }


def list_cards(token, args):
    board = _board(token)
    cards_rows = cards_repo.list_for_board(board.id, cards.parse_card_filters(args))
    names = repo.names_of({c.assignee_id for c in cards_rows if c.assignee_id})
    return [_card(c, names, board) for c in cards_rows]


def get_card(token, card_id):
    board = _board(token)
    cid = to_uuid(card_id)
    card = repo.card_in_board(board.id, cid) if cid else None
    if card is None:
        raise NotFound("Not found")
    return _card(card, repo.names_of({card.assignee_id} if card.assignee_id else set()), board)


def list_categories(token):
    board = _board(token)
    return [serialize_category(c) for c in categories_repo.list_for_board(board.id)]


def attachment_url(token, attachment_id):
    board = _board(token)
    aid = to_uuid(attachment_id)
    att = repo.attachment_in_board(board.id, aid) if aid else None
    if att is None:
        raise NotFound("Not found")
    if not att.file_path:
        return {"file_url": att.url, "expires_at": None}
    data = serialize_attachment(att, clock.now(), share_scope(board.share_token))
    return {"file_url": data["file_url"], "expires_at": data["expires_at"]}
