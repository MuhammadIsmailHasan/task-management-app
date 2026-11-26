from app.common.errors import ValidationError
from app.common.rich_text import clean_html, to_text

# the HTML of a 500 character description with its formatting fits well within this
MAX_DESCRIPTION_HTML = 5000
from app.common.http import iso

DEFAULT_COLUMNS = ("Todo", "In Progress", "Review", "Revision", "Done")


def clean_name(value):
    if not isinstance(value, str) or not value.strip():
        raise ValidationError("name is required")
    value = value.strip()
    if len(value) > 255:
        raise ValidationError("name must be at most 255 characters")
    return value


def serialize_column(col):
    return {"id": str(col.id), "board_id": str(col.board_id), "name": col.name, "order": col.order}


def clean_description(value):
    """Sanitised HTML from the editor (round 6); empty becomes None; at most 500 visible characters."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError("description must be text")
    cleaned = clean_html(value)
    if len(to_text(cleaned)) > 500 or (cleaned and len(cleaned) > MAX_DESCRIPTION_HTML):
        raise ValidationError("description must be at most 500 characters", details={"description": ["description must be at most 500 characters"]})
    return cleaned


def serialize_board(board, columns=None, viewer=None, counts=None):
    # Guests never receive comments or activity_log; boards embed neither.
    data = {
        "id": str(board.id),
        "name": board.name,
        "slug": board.slug,
        "description": board.description,
        "owner_id": str(board.owner_id) if board.owner_id else None,
        "archived_at": iso(board.archived_at),
    }
    if counts is not None:
        data.update(counts)
    if columns is not None:
        data["columns"] = [serialize_column(c) for c in columns]
    return data
