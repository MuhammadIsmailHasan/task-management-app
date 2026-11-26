from marshmallow import fields, validate

from app.common.fields import BaseSchema
from app.common.paging import PageQuerySchema


class NotificationSchema(BaseSchema):
    id = fields.UUID()
    type = fields.String(metadata={"description": "assigned, deadline, comment_on_assigned, due_today, due_tomorrow, assigned_card_changed, subtask_on_assigned, board_join_requested, board_added or board_join_rejected"})
    board_id = fields.UUID(allow_none=True)
    board_slug = fields.String(allow_none=True)
    board_name = fields.String(allow_none=True)
    card_id = fields.UUID(allow_none=True)
    card_title = fields.String(allow_none=True)
    actor_name = fields.String(allow_none=True)
    action = fields.String(allow_none=True, metadata={"description": "moved, archived or deleted: only on assigned_card_changed"})
    is_read = fields.Boolean()
    notify_date = fields.String()
    created_at = fields.String(allow_none=True)


class InboxQuerySchema(PageQuerySchema):
    unread = fields.String(validate=validate.OneOf(["true", "false"]), metadata={"description": "`true` lists only unread rows; `unread_count` still counts all of them"})


class InboxSchema(BaseSchema):
    items = fields.List(fields.Nested(NotificationSchema))
    unread_count = fields.Integer()


class PreferenceSchema(BaseSchema):
    type = fields.String(required=True, validate=validate.OneOf(["comment_on_assigned", "due_today", "due_tomorrow", "assigned_card_changed", "subtask_on_assigned"]))
    enabled = fields.Boolean(required=True, truthy={True}, falsy={False})


class PreferencesSchema(BaseSchema):
    preferences = fields.List(fields.Nested(PreferenceSchema), required=True, validate=validate.Length(min=1, max=5))
