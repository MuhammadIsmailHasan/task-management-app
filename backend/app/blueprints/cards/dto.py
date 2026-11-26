from app.common.rich_text import clean_html
from app.common import clock
from app.common.errors import ValidationError
from app.common.http import iso, parse_date
from app.common.signing import sign_file_url

PRIORITIES = ("high", "medium", "low")


# a description is sanitised HTML from the editor (round 6); this bounds what one Card stores
MAX_DESCRIPTION_HTML = 20000


def _title(value):
    if not isinstance(value, str) or not value.strip():
        raise ValidationError("title is required")
    value = value.strip()
    if len(value) > 255:
        raise ValidationError("title must be at most 255 characters")
    return value


def validate_card_fields(data, partial):
    """Return a dict of validated column values for the keys present in data."""
    out = {}
    if "title" in data or not partial:
        out["title"] = _title(data.get("title"))
    if "description" in data:
        if data["description"] is not None and not isinstance(data["description"], str):
            raise ValidationError("description must be text")
        out["description"] = clean_html(data["description"])
        if out["description"] is not None and len(out["description"]) > MAX_DESCRIPTION_HTML:
            raise ValidationError("description is too long", details={"description": ["description is too long"]})
    if "priority" in data:
        if data["priority"] not in PRIORITIES:
            raise ValidationError("priority must be high, medium or low")
        out["priority"] = data["priority"]
    for key in ("start_date", "end_date"):
        if key in data:
            out[key] = parse_date(data[key], key)
    return out


def check_dates(start, end):
    if start is not None and end is not None and end < start:
        raise ValidationError("end_date must be on or after start_date")


def derive_progress(subtasks):
    """(progress, done, total): progress is `(20 * done + total) // (2 * total)`, an integer 0 to 10, or None without Subtasks (Requirement 27)."""
    total = len(subtasks)
    done = sum(1 for s in subtasks if s.is_done)
    return ((20 * done + total) // (2 * total) if total else None), done, total


def progress_fields(subtasks):
    progress, done, total = derive_progress(subtasks)
    return {"progress": progress, "subtask_done_count": done, "subtask_total_count": total}


def item_can_edit(viewer, created_by_id, assignee_id):
    """`can_edit` of a subtask or an attachment for this viewer (PERM-01). Staff: always; an assigned Member: own items."""
    if viewer is None:
        return False
    if viewer.role != "member":
        return True
    return (
        assignee_id is not None
        and str(assignee_id) == viewer.id
        and created_by_id is not None
        and str(created_by_id) == viewer.id
    )


def serialize_subtask(s, viewer=None, assignee_id=None):
    return {
        "id": str(s.id),
        "card_id": str(s.card_id),
        "title": s.title,
        "is_done": s.is_done,
        "order": s.order,
        "created_by_id": str(s.created_by_id) if s.created_by_id else None,
        "can_edit": item_can_edit(viewer, s.created_by_id, assignee_id),
    }


def serialize_attachment(a, now=None, scope=None, viewer=None, assignee_id=None):
    data = {
        "id": str(a.id),
        "card_id": str(a.card_id),
        "name": a.name,
        "mime_type": a.mime_type,
        "url": a.url,
        "file_url": None,
        "expires_at": None,
        "created_by_id": str(a.created_by_id) if a.created_by_id else None,
        "can_edit": item_can_edit(viewer, a.created_by_id, assignee_id),
    }
    if a.file_path:
        from datetime import datetime, timezone

        path, exp = sign_file_url(a.id, now or clock.now(), scope=scope)
        data["file_url"] = path
        data["expires_at"] = datetime.fromtimestamp(exp, timezone.utc).isoformat()
    return data


def serialize_card(card, viewer, subtasks=(), attachments=(), comments=None, activity=None, idents=None, urls=None, due=None):
    ident = (idents or {}).get(card.assignee_id) if card.assignee_id else None
    data = {
        "id": str(card.id),
        "column_id": str(card.column_id) if card.column_id else None,
        "category_id": str(card.category_id) if card.category_id else None,
        "assignee_id": str(card.assignee_id) if card.assignee_id else None,
        "assignee_name": ident.full_name if ident else None,
        "assignee_avatar_url": (urls or {}).get(card.assignee_id) if card.assignee_id else None,
        # an assignee who was deactivated or marked unavailable stays on the Card; the avatar says so (ADM-09)
        "assignee_is_active": ident.is_active if ident else None,
        "assignee_is_available": ident.is_available if ident else None,
        "title": card.title,
        "description": card.description,
        "priority": card.priority,
        "start_date": iso(card.start_date),
        "end_date": iso(card.end_date),
        "order": card.order,
        "archived_at": iso(card.archived_at),
        "due_state": due,
        "subtasks": [serialize_subtask(s, viewer, card.assignee_id) for s in subtasks],
        **progress_fields(subtasks),
        "attachments": [serialize_attachment(a, viewer=viewer, assignee_id=card.assignee_id) for a in attachments],
    }
    # Guests never get comments or activity.
    if viewer is not None:
        if comments is not None:
            data["comments"] = comments
        if activity is not None:
            data["activity"] = activity
    return data
