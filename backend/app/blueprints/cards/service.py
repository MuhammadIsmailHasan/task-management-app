import mimetypes
import os
import uuid as uuidlib
from datetime import date, timedelta

from flask import current_app

from app.blueprints.activity import repository as activity
from app.blueprints.auth import repository as users
from app.blueprints.boards import repository as boards_repo
from app.blueprints.boards import service as boards
from app.blueprints.cards import repository as repo
from app.common import card_policy as policy
from app.blueprints.cards.dto import check_dates, serialize_attachment, serialize_card, validate_card_fields
from app.blueprints.notifications import repository as notif_repo
from app.common import clock, ordering
from app.common.due import due_state
from app.common.errors import CardArchived, CardInDone, CardNotArchived, Forbidden, NotFound, ValidationError
from app.common.identities import avatar_urls
from app.common.ids import to_uuid
from app.extensions import db

ALLOWED_EXT = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".rar": {"application/vnd.rar", "application/x-rar-compressed", "application/x-rar", "application/octet-stream"},
}


def _aid(actor):
    return to_uuid(actor.id)


def load_card(actor, card_id):
    """Return (card, board) after 404/401/403 checks. Soft-deleted cards/boards are 404."""
    cid = to_uuid(card_id)
    card = repo.get_card(cid) if cid else None
    if card is None:
        raise NotFound("Card not found")
    board = boards_repo.get_by_id(repo.board_id_of_card(card))
    boards.require_access(actor, board)
    return card, board


def _require(allowed, message="You cannot do this on this card"):
    if not allowed:
        raise Forbidden(message)


def _require_fields_edit(actor, card, board, keys):
    """Staff edit any field; the assigned Member edits the description alone (PERM-03)."""
    if actor is None:
        raise Forbidden("Authentication required")
    if policy.is_staff(actor, board):
        return
    if not policy.is_assignee(actor, card):
        raise Forbidden("Members can only edit cards assigned to them")
    if set(keys) - {"description"}:
        raise Forbidden("Members can only edit the description")


def get_card(actor, card_id):
    card, _ = load_card(actor, card_id)
    return card


def present(card, actor):
    from app.blueprints.comments import service as comments_service

    comments = comments_service.list_comments(card, actor, "latest")
    activity_rows = activity.serialize_many(activity.for_card(card.id, 20))
    detail = repo.get_detail(card.id)
    idents, urls = _assignee_context([detail])
    column = repo.get_column(detail.column_id) if detail.column_id else None
    due = due_state(detail.end_date, column.name if column else None, clock.today(current_app.config["APP_TIMEZONE"]))
    return serialize_card(detail, actor, detail.subtasks, detail.attachments, comments, activity_rows, idents, urls, due)


def _assignee_context(cards):
    """Names and signed avatar URLs of every assignee of these cards: one query, one signature per distinct user."""
    idents = users.identities({c.assignee_id for c in cards if c.assignee_id})
    return idents, avatar_urls(idents, clock.now())


DONE = "Done"


def completion_stamp(previous_name, target_name, current, now):
    """The new `completed_at` of a Card entering `target_name` from `previous_name` (None when it is new).

    Entering Done from another Column sets it, leaving Done clears it, and a reorder inside Done keeps it (Requirement 43).
    """
    if target_name == DONE:
        return current if previous_name == DONE and current is not None else now
    return None


def create_card(actor, column_id, data):
    cid = to_uuid(column_id)
    column = repo.get_column(cid) if cid else None
    if column is None:
        raise NotFound("Column not found")
    board = boards_repo.get_by_id(column.board_id)
    boards.require_staff(actor, board)
    fields = validate_card_fields(data, partial=False)
    check_dates(fields.get("start_date"), fields.get("end_date"))
    _apply_category(fields, data, board)
    current = repo.max_order(column.id)
    card = repo.add_card(
        board_id=board.id,
        column_id=column.id,
        order=1.0 if current is None else current + 1,
        completed_at=completion_stamp(None, column.name, None, clock.now()),
        **fields,
    )
    activity.add(_aid(actor), "card.created", "card", card.id, {"title": card.title, "card_title": card.title})
    if data.get("assignee_id") is not None:
        _assign(actor, card, data["assignee_id"], board)
    db.session.commit()
    return card


def _apply_category(fields, data, board):
    if "category_id" not in data:
        return
    if data["category_id"] is None:
        fields["category_id"] = None
        return
    cat_id = to_uuid(data["category_id"])
    cat = repo.get_category(cat_id) if cat_id else None
    if cat is None or cat.board_id != board.id:
        raise ValidationError("category_id must belong to this board")
    fields["category_id"] = cat.id


def _assign(actor, card, assignee_id, board):
    if assignee_id is None:
        if card.assignee_id is not None:
            card.assignee_id = None
            activity.add(_aid(actor), "card.unassigned", "card", card.id, {"card_title": card.title})
        return
    uid = to_uuid(assignee_id)
    user = users.get_by_id(uid) if uid else None
    if user is None:
        raise ValidationError("assignee_id must reference an existing user")
    if user.role in ("manager", "admin"):
        raise ValidationError("Managers and admins cannot be assigned", details={"assignee_id": ["Managers and admins cannot be assigned"]})
    if card.assignee_id != user.id and not (user.is_active and user.is_available):
        raise ValidationError("The user is not available to be assigned", details={"assignee_id": ["The user is inactive or unavailable"]})
    if not (board.owner_id == user.id or boards_repo.is_member(board.id, user.id)):
        raise ValidationError(
            "assignee_id must be the board owner or a board member",
            details={"assignee_id": ["The user must be the board owner or a board member"]},
        )
    card.assignee_id = user.id
    notif_repo.insert_ignore(user.id, card.id, "assigned", clock.today(current_app.config["APP_TIMEZONE"]))
    activity.add(
        _aid(actor),
        "card.assigned",
        "card",
        card.id,
        {"assignee_id": str(user.id), "assignee_name": user.full_name, "card_title": card.title},
    )


def _category_name(category_id):
    cat = repo.get_category(category_id) if category_id else None
    return cat.name if cat is not None else None


def _change(key, old, new):
    """One entry of the `changes` metadata: old and new value, by name for a category, field name only for a description."""
    if key == "description":
        return {}
    if key == "category_id":
        return {"from": _category_name(old), "to": _category_name(new)}
    iso = lambda v: v.isoformat() if hasattr(v, "isoformat") else v
    return {"from": iso(old), "to": iso(new)}


def update_card(actor, card_id, data):
    card, board = load_card(actor, card_id)
    assignment = "assignee_id" in data
    _require_fields_edit(actor, card, board, data.keys())
    fields = validate_card_fields(data, partial=True)
    _apply_category(fields, data, board)
    start = fields.get("start_date", card.start_date) if "start_date" in fields else card.start_date
    end = fields.get("end_date", card.end_date) if "end_date" in fields else card.end_date
    check_dates(start, end)
    changed = {}
    changes = {}
    for key, value in fields.items():
        old = getattr(card, key)
        if old != value:
            changed[key] = value if not hasattr(value, "isoformat") else value.isoformat()
            changes["category" if key == "category_id" else key] = _change(key, old, value)
            setattr(card, key, value)
    if changed:
        activity.add(
            _aid(actor),
            "card.updated",
            "card",
            card.id,
            {"fields": sorted(changed), "changes": changes, "card_title": card.title},
        )
    if assignment and (str(card.assignee_id) if card.assignee_id else None) != (
        str(to_uuid(data["assignee_id"])) if data["assignee_id"] else None
    ):
        _assign(actor, card, data["assignee_id"], board)
    db.session.commit()
    return card


def delete_card(actor, card_id):
    card, board = load_card(actor, card_id)
    boards.require_staff(actor, board)
    card.deleted_at = clock.now()
    activity.add(_aid(actor), "card.deleted", "card", card.id, {"card_title": card.title})
    notif_repo.notify_assignee(card, "assigned_card_changed", _aid(actor), "deleted")
    db.session.commit()


def set_archived(actor, card_id, archived):
    """Archive takes the Card out of its Column (an archived Card has none); restore puts it in the first Column."""
    card, board = load_card(actor, card_id)
    boards.require_staff(actor, board)
    if archived:
        if card.archived_at is not None:
            return card
        column = repo.get_column(card.column_id)
        if column is not None and column.name == DONE:
            raise CardInDone("Move the card out of Done to archive it")
        meta = {"card_title": card.title, "from_column": column.name if column is not None else None}
        card.column_id = None
        card.archived_at = clock.now()
        activity.add(_aid(actor), "card.archived", "card", card.id, meta)
        notif_repo.notify_assignee(card, "assigned_card_changed", _aid(actor), "archived")
    else:
        if card.archived_at is None:
            raise CardNotArchived("The card is not archived")
        target = repo.first_column(board.id)
        if target is None:
            raise NotFound("The board has no column to restore the card to")
        current = repo.max_order(target.id)
        card.column_id = target.id
        card.order = 1.0 if current is None else current + 1
        card.archived_at = None
        card.completed_at = completion_stamp(None, target.name, None, clock.now())
        activity.add(_aid(actor), "card.restored", "card", card.id, {"card_title": card.title, "to_column": target.name})
    db.session.commit()
    return card


def move_card(actor, card_id, data):
    card, board = load_card(actor, card_id)
    _require(policy.can_move(actor, card, board), "Members can only move cards assigned to them")
    if card.archived_at is not None:
        raise CardArchived("An archived card cannot be moved")
    col_id = to_uuid(data.get("column_id"))
    target = repo.get_column(col_id) if col_id else None
    if target is None:
        raise NotFound("Column not found")
    if target.board_id != board.id:
        raise ValidationError("Target column belongs to another board")

    def neighbour(key):
        value = data.get(key)
        if value is None:
            return None
        nid = to_uuid(value)
        n = repo.get_card(nid) if nid else None
        if n is None or n.column_id != target.id or n.id == card.id:
            raise ValidationError(f"{key} must be a card in the target column")
        return n

    prev, nxt = neighbour("prev"), neighbour("next")
    if prev is not None and nxt is not None and prev.order > nxt.order:
        raise ValidationError("prev must be before next")
    siblings = repo.column_cards(target.id, exclude_id=card.id)
    if ordering.needs_rebalance(prev.order if prev else None, nxt.order if nxt else None):
        for sibling, value in zip(siblings, ordering.rebalance([s.order for s in siblings])):
            sibling.order = value
        db.session.flush()
    new_order = ordering.position_for(prev.order if prev else None, nxt.order if nxt else None, [s.order for s in siblings])
    source = card.column_id
    source_column = repo.get_column(source)
    card.completed_at = completion_stamp(source_column.name if source_column is not None else None, target.name, card.completed_at, clock.now())
    card.column_id = target.id
    card.order = new_order
    activity.add(
        _aid(actor),
        "card.moved",
        "card",
        card.id,
        {
            "from_column_id": str(source),
            "to_column_id": str(target.id),
            "from_column_name": source_column.name if source_column is not None else None,
            "to_column_name": target.name,
            "card_title": card.title,
        },
    )
    if source != target.id:  # a reorder inside the same Column notifies nobody (NPF-04)
        notif_repo.notify_assignee(card, "assigned_card_changed", _aid(actor), "moved")
    db.session.commit()
    return card


# ---- subtasks ----------------------------------------------------------------

def add_subtask(actor, card_id, data):
    card, board = load_card(actor, card_id)
    _require(policy.can_add_item(actor, card, board), "Only the assignee and board staff can add subtasks")
    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValidationError("title is required")
    current = repo.max_subtask_order(card.id)
    sub = repo.add_subtask(card.id, title.strip(), 1.0 if current is None else current + 1, _aid(actor))
    activity.add(
        _aid(actor), "card.subtask_added", "card", card.id, {"subtask_id": str(sub.id), "title": sub.title, "card_title": card.title}
    )
    notif_repo.notify_assignee(card, "subtask_on_assigned", _aid(actor))
    db.session.commit()
    return sub


def _load_subtask(actor, subtask_id):
    sid = to_uuid(subtask_id)
    sub = repo.get_subtask(sid) if sid else None
    if sub is None:
        raise NotFound("Subtask not found")
    card, board = load_card(actor, sub.card_id)
    return sub, card, board


def update_subtask(actor, subtask_id, data):
    sub, card, board = _load_subtask(actor, subtask_id)
    if set(data) - {"is_done"}:
        _require(policy.can_edit_item(actor, card, board, sub.created_by_id), "You can only change subtasks you created")
    else:
        _require(policy.can_check_subtask(actor, card, board), "Only the assignee and board staff can check subtasks")
    changed = False  # a reorder alone does not notify (NPF-04)
    if "title" in data:
        if not isinstance(data["title"], str) or not data["title"].strip():
            raise ValidationError("title is required")
        changed = changed or sub.title != data["title"].strip()
        sub.title = data["title"].strip()
    if "is_done" in data:
        if not isinstance(data["is_done"], bool):
            raise ValidationError("is_done must be a boolean")
        changed = changed or sub.is_done != data["is_done"]
        sub.is_done = data["is_done"]
    if "order" in data:
        if isinstance(data["order"], bool) or not isinstance(data["order"], (int, float)):
            raise ValidationError("order must be a number")
        sub.order = float(data["order"])
    elif "prev" in data or "next" in data:
        reorder_subtasks(sub, data)
    activity.add(
        _aid(actor),
        "card.subtask_updated",
        "card",
        card.id,
        {"subtask_id": str(sub.id), "title": sub.title, "is_done": sub.is_done, "card_title": card.title},
    )
    if changed:
        notif_repo.notify_assignee(card, "subtask_on_assigned", _aid(actor))
    db.session.commit()
    return sub


def reorder_subtasks(sub, data):
    siblings = [s for s in repo.subtasks_of(sub.card_id) if s.id != sub.id]
    by_id = {str(s.id): s for s in siblings}

    def order_of(key):
        v = data.get(key)
        if v is None:
            return None
        if str(v) not in by_id:
            raise ValidationError(f"{key} must be a sibling subtask")
        return by_id[str(v)].order

    prev, nxt = order_of("prev"), order_of("next")
    if ordering.needs_rebalance(prev, nxt):
        for s, value in zip(siblings, ordering.rebalance([s.order for s in siblings])):
            s.order = value
        prev, nxt = order_of("prev"), order_of("next")
    sub.order = ordering.position_for(prev, nxt, [s.order for s in siblings])


def delete_subtask(actor, subtask_id):
    sub, card, board = _load_subtask(actor, subtask_id)
    _require(policy.can_edit_item(actor, card, board, sub.created_by_id), "You can only delete subtasks you created")
    repo.delete_subtask(sub)
    activity.add(
        _aid(actor), "card.subtask_removed", "card", card.id, {"subtask_id": str(sub.id), "title": sub.title, "card_title": card.title}
    )
    notif_repo.notify_assignee(card, "subtask_on_assigned", _aid(actor))
    db.session.commit()


# ---- attachments -------------------------------------------------------------

def add_attachment(actor, card_id, json_data, upload):
    card, board = load_card(actor, card_id)
    _require(policy.can_add_item(actor, card, board), "Only the assignee and board staff can add attachments")
    if upload is not None and upload.filename:
        ext = os.path.splitext(upload.filename)[1].lower()
        mime = upload.mimetype or mimetypes.guess_type(upload.filename)[0] or ""
        if ext not in ALLOWED_EXT or mime not in ALLOWED_EXT[ext]:
            raise ValidationError("Only PDF, Word and RAR files are accepted")
        directory = current_app.config["UPLOAD_DIR"]
        os.makedirs(directory, exist_ok=True)
        stored = f"{uuidlib.uuid4().hex}{ext}"
        upload.save(os.path.join(directory, stored))
        att = repo.add_attachment(card_id=card.id, name=upload.filename[:255], file_path=stored, mime_type=mime, created_by_id=_aid(actor))
    else:
        url = json_data.get("url")
        if not isinstance(url, str) or not url.strip() or not url.lower().startswith(("http://", "https://")):
            raise ValidationError("Provide an http(s) url or a file")
        name = (json_data.get("name") or url).strip()[:255]
        att = repo.add_attachment(card_id=card.id, name=name, url=url.strip(), created_by_id=_aid(actor))
    activity.add(
        _aid(actor), "card.attachment_added", "card", card.id, {"attachment_id": str(att.id), "name": att.name, "card_title": card.title}
    )
    db.session.commit()
    return att


def _load_attachment(actor, attachment_id):
    aid = to_uuid(attachment_id)
    att = repo.get_attachment(aid) if aid else None
    if att is None:
        raise NotFound("Attachment not found")
    card, board = load_card(actor, att.card_id)
    return att, card, board


def delete_attachment(actor, attachment_id):
    att, card, board = _load_attachment(actor, attachment_id)
    _require(policy.can_edit_item(actor, card, board, att.created_by_id), "You can only delete attachments you added")
    path = att.file_path
    repo.delete_attachment(att)
    activity.add(
        _aid(actor), "card.attachment_removed", "card", card.id, {"attachment_id": str(att.id), "name": att.name, "card_title": card.title}
    )
    db.session.commit()
    if path:
        try:
            os.remove(os.path.join(current_app.config["UPLOAD_DIR"], path))
        except OSError:
            pass


def attachment_url(actor, attachment_id):
    att, _, _ = _load_attachment(actor, attachment_id)
    if not att.file_path:
        return {"file_url": att.url, "expires_at": None}
    data = serialize_attachment(att)
    return {"file_url": data["file_url"], "expires_at": data["expires_at"]}


def attachment_file_path(attachment_id, exp, sig, st=None):
    from app.common.signing import share_scope, verify_file_signature

    aid = to_uuid(attachment_id)
    att = repo.get_attachment(aid) if aid else None
    if att is None or not verify_file_signature(att.id, exp, sig, clock.now(), scope=st or None):
        raise Forbidden("Invalid or expired file link")
    card = repo.get_card(att.card_id)
    board = boards_repo.get_by_id(repo.board_id_of_card(card)) if card else None
    if st:
        # A shared URL dies the moment the Share_Token is disabled or replaced (Req 18.16).
        if board is None or not board.share_token or st != share_scope(board.share_token):
            raise Forbidden("Invalid or expired file link")
    if board is None or not att.file_path:
        raise NotFound("File not found")
    return os.path.join(current_app.config["UPLOAD_DIR"], att.file_path), att


# ---- listing -----------------------------------------------------------------

def parse_archived(args):
    """`?archived=true` lists the archived Cards (V17); the default is false."""
    raw = args.get("archived")
    if raw is None:
        return False
    if raw not in ("true", "false"):
        raise ValidationError("archived must be true or false")
    return raw == "true"


def parse_card_filters(args):
    """Search and filter[...] query values as the repository filter dict; 400 on a bad value or an unknown key."""
    priority = assignee = category = None
    for key, value in args.items():
        if key in ("search", "archived"):
            continue
        if key == "filter[priority]":
            if value not in ("high", "medium", "low"):
                raise ValidationError("priority must be high, medium or low")
            priority = value
        elif key == "filter[assignee]":
            assignee = to_uuid(value)
            if assignee is None:
                raise ValidationError("filter[assignee] must be a UUID")
        elif key == "filter[category]":
            category = to_uuid(value)
            if category is None:
                raise ValidationError("filter[category] must be a UUID")
        elif key.startswith("filter["):
            raise ValidationError(f"Unsupported filter: {key}")
    search = (args.get("search") or "").strip()
    return {"search": search or None, "priority": priority, "assignee": assignee, "category": category}


def list_board_cards(actor, board_id, args):
    board = boards.load_board(actor, board_id)
    cards = repo.list_for_board(board.id, parse_card_filters(args), archived=parse_archived(args))
    idents, urls = _assignee_context(cards)
    names = {c.id: c.name for c in boards_repo.list_columns(board.id)}
    today = clock.today(current_app.config["APP_TIMEZONE"])
    return [serialize_card(c, actor, c.subtasks, c.attachments, idents=idents, urls=urls, due=due_state(c.end_date, names.get(c.column_id), today)) for c in cards]


MY_GROUPS = ("overdue", "today", "tomorrow", "this_week", "later", "no_due")
_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def group_key(end_date, today):
    """One of MY_GROUPS for a Card's end date (TASK-02): This week runs to the Sunday of the current Monday-first week."""
    if end_date is None:
        return "no_due"
    if end_date < today:
        return "overdue"
    if end_date == today:
        return "today"
    if end_date == today + timedelta(days=1):
        return "tomorrow"
    sunday = today + timedelta(days=6 - today.weekday())
    return "this_week" if end_date <= sunday else "later"


def my_cards(actor):
    """The caller's open Cards in time groups, empty groups left out (Requirement 52). An Admin cannot be an assignee: empty."""
    today = clock.today(current_app.config["APP_TIMEZONE"])
    if actor.role in ("manager", "admin"):
        raise Forbidden("My tasks is for members and supervisors")
    rows = repo.assigned_open(to_uuid(actor.id))
    buckets = {key: [] for key in MY_GROUPS}
    for r in rows:
        buckets[group_key(r.end_date, today)].append(r)
    groups = []
    for key in MY_GROUPS:
        ordered = sorted(buckets[key], key=lambda r: (r.end_date or date.max, _PRIORITY_ORDER.get(r.priority, 3), str(r.id)))
        if not ordered:
            continue
        groups.append(
            {
                "key": key,
                "cards": [
                    {
                        "id": str(r.id),
                        "title": r.title,
                        "board_id": str(r.board_id),
                        "board_slug": r.slug,
                        "board_name": r.board_name,
                        "priority": r.priority,
                        "end_date": r.end_date.isoformat() if r.end_date else None,
                        "due_state": due_state(r.end_date, None, today),
                        "category": {"id": str(r.category_id), "name": r.category_name, "color": r.color} if r.category_id else None,
                    }
                    for r in ordered
                ],
            }
        )
    return {"today": today.isoformat(), "groups": groups}
