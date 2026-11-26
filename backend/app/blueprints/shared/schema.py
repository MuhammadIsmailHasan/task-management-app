from marshmallow import fields

from app.blueprints.boards.schema import ColumnSchema
from app.blueprints.cards.schema import AttachmentSchema, BoardCardsQuerySchema, SubtaskSchema
from app.common.fields import BaseSchema


class SharedBoardSchema(BaseSchema):
    id = fields.UUID()
    name = fields.String()
    description = fields.String(allow_none=True)
    columns = fields.List(fields.Nested(ColumnSchema))
    has_board_access = fields.Boolean(metadata={"description": "True when the optional Bearer Token has Board_Access"})


class SharedCardSchema(BaseSchema):
    id = fields.UUID()
    column_id = fields.UUID()
    category_id = fields.UUID(allow_none=True)
    assignee_id = fields.UUID(allow_none=True)
    assignee_name = fields.String(allow_none=True)
    title = fields.String()
    description = fields.String(allow_none=True)
    priority = fields.String()
    start_date = fields.String(allow_none=True)
    end_date = fields.String(allow_none=True)
    order = fields.Float()
    archived_at = fields.String(allow_none=True)
    due_state = fields.String(allow_none=True)
    subtasks = fields.List(fields.Nested(SubtaskSchema))
    progress = fields.Integer(allow_none=True)
    subtask_done_count = fields.Integer()
    subtask_total_count = fields.Integer()
    attachments = fields.List(fields.Nested(AttachmentSchema))


SharedCardsQuerySchema = BoardCardsQuerySchema
