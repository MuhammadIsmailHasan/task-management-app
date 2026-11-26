from app.blueprints.activity import repository as activity
from app.blueprints.boards import repository as boards_repo
from app.blueprints.boards import service as boards
from app.blueprints.cards import repository as cards_repo
from app.blueprints.comments import repository as repo
from app.blueprints.notifications import repository as notifications
from app.common import card_policy as policy
from app.common import clock
from app.common.errors import Forbidden, NotFound, ValidationError
from app.common.identities import avatar_urls
from app.common.ids import to_uuid
from app.extensions import db

WRITERS = ("member", "supervisor", "manager")
STAFF = ("supervisor", "manager", "admin")


def _load_card(actor, card_id, with_board=False):
    cid = to_uuid(card_id)
    card = cards_repo.get_card(cid) if cid else None
    if card is None:
        raise NotFound("Card not found")
    board = boards_repo.get_by_id(cards_repo.board_id_of_card(card))
    boards.require_access(actor, board)
    return (card, board) if with_board else card


def _require_commenter(actor, card, board):
    """A Manager, a Supervisor with Board_Staff_Access, or the assigned Member (PERM-05). Never an Admin."""
    if not policy.can_comment(actor, card, board):
        raise Forbidden("You cannot comment on this card")


def _content(data):
    content = data.get("content")
    if not isinstance(content, str) or not content.strip():
        raise ValidationError("content is required")
    return content.strip()


def create_comment(actor, card_id, data):
    card, board = _load_card(actor, card_id, with_board=True)
    _require_commenter(actor, card, board)
    c = repo.add(card.id, to_uuid(actor.id), _content(data))
    activity.add(to_uuid(actor.id), "comment.added", "card", card.id, {"comment_id": str(c.id), "card_title": card.title})
    notifications.notify_assignee(card, "comment_on_assigned", to_uuid(actor.id))
    db.session.commit()
    return c


def reply(actor, comment_id, data):
    cid = to_uuid(comment_id)
    parent = repo.get(cid) if cid else None
    if parent is None:
        raise NotFound("Comment not found")
    card, board = _load_card(actor, parent.card_id, with_board=True)
    _require_commenter(actor, card, board)
    if parent.parent_id is not None:
        raise ValidationError("Replies cannot be nested more than one level")
    c = repo.add(card.id, to_uuid(actor.id), _content(data), parent_id=parent.id)
    parent.reply_count = (parent.reply_count or 0) + 1
    activity.add(to_uuid(actor.id), "comment.replied", "card", card.id, {"comment_id": str(c.id)})
    notifications.notify_assignee(card, "comment_on_assigned", to_uuid(actor.id))
    db.session.commit()
    return c


def delete_comment(actor, comment_id):
    """Author only; a top-level Comment takes its Replies with it. The log row keeps no text (Requirement 26)."""
    cid = to_uuid(comment_id)
    c = repo.get(cid) if cid else None
    if c is None:
        raise NotFound("Comment not found")
    card = _load_card(actor, c.card_id)
    if str(c.author_id) != actor.id:
        raise Forbidden("Only the author can delete a comment")
    is_reply = c.parent_id is not None
    deleted_replies = 0
    if is_reply:
        parent = repo.get(c.parent_id)
        if parent is not None:
            parent.reply_count = max((parent.reply_count or 0) - 1, 0)
    else:
        deleted_replies = repo.delete_replies(c.id)
    repo.delete(c)
    activity.add(
        to_uuid(actor.id), "comment.deleted", "card", card.id,
        {"card_title": card.title, "comment_id": str(cid), "is_reply": is_reply, "deleted_replies": deleted_replies},
    )
    db.session.commit()
    return {"deleted": 1 + deleted_replies}


def toggle_priority(actor, comment_id):
    cid = to_uuid(comment_id)
    c = repo.get(cid) if cid else None
    if c is None:
        raise NotFound("Comment not found")
    _load_card(actor, c.card_id)
    c.is_priority = not c.is_priority
    activity.add(to_uuid(actor.id), "comment.priority_toggled", "card", c.card_id, {"is_priority": c.is_priority})
    db.session.commit()
    return c


def serialize(c, viewer_role, author_roles, replies=None, idents=None, urls=None):
    ident = (idents or {}).get(c.author_id)
    data = {
        "id": str(c.id),
        "card_id": str(c.card_id),
        "author_id": str(c.author_id),
        "author_name": ident.full_name if ident else None,
        "author_avatar_url": (urls or {}).get(c.author_id),
        "parent_id": str(c.parent_id) if c.parent_id else None,
        "content": c.content,
        "is_priority": c.is_priority,
        "reply_count": c.reply_count,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "can_create_card": viewer_role in STAFF and author_roles.get(c.author_id) == "manager",
    }
    if replies is not None:
        data["replies"] = replies
    return data


def list_comments(card, actor, sort="latest", limit=None, offset=0):
    if sort not in ("latest", "popular"):
        raise ValidationError("sort must be latest or popular")
    comments, roles = repo.list_for_card(card.id, sort, limit, offset)
    idents = repo.author_identities(comments)
    urls = avatar_urls(idents, clock.now())
    return [
        serialize(c, actor.role, roles, [serialize(r, actor.role, roles, idents=idents, urls=urls) for r in c.replies], idents, urls)
        for c in comments
    ]


def serialize_one(c, viewer_role):
    """A single new or changed comment with its author's name and avatar."""
    idents = repo.author_identities([c])
    return serialize(c, viewer_role, {}, idents=idents, urls=avatar_urls(idents, clock.now()))


def list_for_request(actor, card_id, sort, limit=None, offset=0):
    """`{items, total}`: one page of top-level comments (all when `limit` is absent) and the count of all of them (CMV-07)."""
    card = _load_card(actor, card_id)
    items = list_comments(card, actor, sort or "latest", limit, offset)
    return {"items": items, "total": repo.count_top_level(card.id)}
