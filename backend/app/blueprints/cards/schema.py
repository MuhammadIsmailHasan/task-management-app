from marshmallow import ValidationError as SchemaError
from marshmallow import fields, validate, validates_schema

from app.blueprints.activity.schema import ActivitySchema
from app.blueprints.comments.schema import CommentSchema
from app.common.fields import BaseSchema, Text

_priority = validate.OneOf(["high", "medium", "low"], error="priority must be high, medium or low")


class _CardFields(BaseSchema):
    description = fields.String(allow_none=True)
    priority = fields.String(validate=_priority)
    start_date = fields.Date(allow_none=True)
    end_date = fields.Date(allow_none=True, metadata={"description": "Must be on or after start_date"})
    category_id = fields.UUID(allow_none=True, metadata={"description": "Category of the same board"})
    assignee_id = fields.UUID(allow_none=True)

    @validates_schema(pass_original=True)
    def _no_progress(self, data, original, **kwargs):
        if isinstance(original, dict) and "progress" in original:
            raise SchemaError({"progress": ["progress is derived from the subtasks and cannot be set"]})
        if isinstance(original, dict) and "due_state" in original:
            raise SchemaError({"due_state": ["due_state is computed by the server and cannot be set"]})


class CreateCardSchema(_CardFields):
    title = Text(required=True, max_length=255)


class UpdateCardSchema(_CardFields):
    title = Text(max_length=255)


class MoveCardSchema(BaseSchema):
    column_id = fields.UUID(required=True)
    prev = fields.UUID(allow_none=True, metadata={"description": "Card above the drop position"})
    next = fields.UUID(allow_none=True, metadata={"description": "Card below the drop position"})


class CreateSubtaskSchema(BaseSchema):
    title = Text(required=True, max_length=255)


class UpdateSubtaskSchema(BaseSchema):
    title = Text(max_length=255)
    is_done = fields.Boolean(truthy={True}, falsy={False})
    order = fields.Float()
    prev = fields.UUID(allow_none=True)
    next = fields.UUID(allow_none=True)


class BoardCardsQuerySchema(BaseSchema):
    search = fields.String(metadata={"description": "Case-insensitive match on title or description"})
    filter_priority = fields.String(data_key="filter[priority]", validate=_priority)
    filter_assignee = fields.UUID(data_key="filter[assignee]")
    filter_category = fields.UUID(data_key="filter[category]")
    archived = fields.String(validate=validate.OneOf(["true", "false"]), metadata={"description": "`true` lists the archived Cards (they have no Column); default false"})


class MyCardCategorySchema(BaseSchema):
    id = fields.UUID()
    name = fields.String()
    color = fields.String(allow_none=True)


class MyCardSchema(BaseSchema):
    id = fields.UUID()
    title = fields.String()
    board_id = fields.UUID()
    board_slug = fields.String()
    board_name = fields.String()
    priority = fields.String()
    end_date = fields.String(allow_none=True)
    due_state = fields.String(allow_none=True)
    category = fields.Nested(MyCardCategorySchema, allow_none=True)


class MyCardGroupSchema(BaseSchema):
    key = fields.String(metadata={"description": "overdue, today, tomorrow, this_week, later or no_due"})
    cards = fields.List(fields.Nested(MyCardSchema))


class MyCardsSchema(BaseSchema):
    today = fields.String()
    groups = fields.List(fields.Nested(MyCardGroupSchema), metadata={"description": "In the order overdue, today, tomorrow, this_week, later, no_due; empty groups are left out"})


class SubtaskSchema(BaseSchema):
    id = fields.UUID()
    card_id = fields.UUID()
    title = fields.String()
    is_done = fields.Boolean()
    order = fields.Float()
    created_by_id = fields.UUID(allow_none=True, metadata={"description": "Who added it; null for rows made before V18"})
    can_edit = fields.Boolean(metadata={"description": "Whether the viewer may rename, reorder, or delete it"})


class AttachmentSchema(BaseSchema):
    id = fields.UUID()
    card_id = fields.UUID()
    name = fields.String()
    mime_type = fields.String(allow_none=True)
    url = fields.String(allow_none=True, metadata={"description": "Stored link, for link attachments"})
    file_url = fields.String(allow_none=True, metadata={"description": "Signed URL valid 15 minutes, uploads only"})
    expires_at = fields.String(allow_none=True)
    created_by_id = fields.UUID(allow_none=True)
    can_edit = fields.Boolean(metadata={"description": "Whether the viewer may delete it"})


class AttachmentUrlSchema(BaseSchema):
    file_url = fields.String(allow_none=True)
    expires_at = fields.String(allow_none=True)


class CardSchema(BaseSchema):
    id = fields.UUID()
    column_id = fields.UUID()
    category_id = fields.UUID(allow_none=True)
    assignee_id = fields.UUID(allow_none=True)
    assignee_name = fields.String(allow_none=True)
    assignee_avatar_url = fields.String(allow_none=True, metadata={"description": "Signed avatar URL (15 minutes) or null"})
    assignee_is_active = fields.Boolean(allow_none=True, metadata={"description": "False once an Admin deactivated the assignee; null without an assignee"})
    assignee_is_available = fields.Boolean(allow_none=True, metadata={"description": "False while the assignee is marked unavailable; null without an assignee"})
    title = fields.String()
    description = fields.String(allow_none=True)
    priority = fields.String()
    start_date = fields.String(allow_none=True)
    end_date = fields.String(allow_none=True)
    order = fields.Float()
    archived_at = fields.String(allow_none=True)
    due_state = fields.String(allow_none=True, metadata={"description": "Read-only: overdue, due_tomorrow, or null (always null in Done or without an end date), in APP_TIMEZONE"})
    subtasks = fields.List(fields.Nested(SubtaskSchema))
    progress = fields.Integer(allow_none=True, metadata={"description": "Derived from the subtasks: 0 to 10, or null without subtasks"})
    subtask_done_count = fields.Integer()
    subtask_total_count = fields.Integer()
    attachments = fields.List(fields.Nested(AttachmentSchema))
    comments = fields.List(fields.Nested(CommentSchema), metadata={"description": "Omitted for Guests"})
    activity = fields.List(fields.Nested(ActivitySchema), metadata={"description": "Omitted for Guests"})
