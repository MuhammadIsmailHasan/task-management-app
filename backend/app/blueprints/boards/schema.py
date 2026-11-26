import marshmallow as ma
from marshmallow import fields, validate

from app.blueprints.auth.schema import MemberSchema
from app.common.fields import BaseSchema, Text


class BoardListQuerySchema(BaseSchema):
    q = fields.String(validate=validate.Length(max=100), metadata={"description": "Case-insensitive name search (at most 100 characters)"})
    sort = fields.String(load_default="updated_at", validate=validate.OneOf(["updated_at", "created_at"], error="sort must be updated_at or created_at"))
    order = fields.String(load_default="desc", validate=validate.OneOf(["asc", "desc"], error="order must be asc or desc"))


class CreateBoardSchema(BaseSchema):
    class Meta:
        unknown = ma.RAISE  # a posted `visibility` is a 400: every Board is private (V12)

    name = Text(required=True, max_length=255)
    description = fields.String(allow_none=True, validate=validate.Length(max=500, error="description must be at most 500 characters"))


class UpdateBoardSchema(BaseSchema):
    class Meta:
        unknown = ma.RAISE

    name = Text(max_length=255)
    description = fields.String(allow_none=True, validate=validate.Length(max=500, error="description must be at most 500 characters"))
    owner_id = fields.UUID(allow_none=True, metadata={"description": "Supervisor user id, or null to clear"})


class BoardMemberSchema(MemberSchema):
    is_owner = fields.Boolean()
    is_active = fields.Boolean(metadata={"description": "False once an Admin deactivated the person; the Members view tags them"})
    is_available = fields.Boolean(metadata={"description": "False while the person is marked unavailable"})
    role = fields.String(metadata={"description": "member or supervisor"})


class BoardMemberWithEmailSchema(BoardMemberSchema):
    email = fields.String(metadata={"description": "Only with ?include=email, for board staff"})


class AddMemberSchema(BaseSchema):
    user_id = fields.UUID(required=True)


class CreateColumnSchema(BaseSchema):
    name = Text(required=True, max_length=255)


class ColumnSchema(BaseSchema):
    id = fields.UUID()
    board_id = fields.UUID()
    name = fields.String()
    order = fields.Float()


class BoardSchema(BaseSchema):
    id = fields.UUID()
    name = fields.String()
    slug = fields.String(metadata={"description": "Read-only, derived from the name (V17): lower-case a-z, 0-9 and hyphens; used in the app URL"})
    description = fields.String(allow_none=True)
    owner_id = fields.UUID(allow_none=True)
    card_count = fields.Integer(metadata={"description": "Cards not deleted and not archived (board list only)"})
    done_count = fields.Integer(metadata={"description": "Of those, Cards in the Done column (board list only)"})
    overdue_count = fields.Integer(metadata={"description": "Of those, Cards past their end date and not Done (board list only)"})
    member_count = fields.Integer(metadata={"description": "Board members (board list only)"})
    archived_at = fields.String(allow_none=True)
    columns = fields.List(fields.Nested(ColumnSchema))


class MembersQuerySchema(BaseSchema):
    include = fields.String(validate=validate.OneOf(["email"]), metadata={"description": "`email` adds each member's email (board staff only)"})
    assignable = fields.String(validate=validate.OneOf(["true", "false"]), metadata={"description": "`true` lists only members who are active and available (the assignee picker)"})


class CandidateQuerySchema(BaseSchema):
    search = fields.String(metadata={"description": "At least 2 characters. Name substring, username prefix, or exact email (case-insensitive)"})


class CandidateSchema(BaseSchema):
    id = fields.UUID()
    full_name = fields.String()
    username = fields.String()
    email = fields.String()
    avatar_url = fields.String(allow_none=True)


class ShareSchema(BaseSchema):
    enabled = fields.Boolean()
    token = fields.String(allow_none=True, metadata={"description": "Secret; returned only by the share endpoints"})
    path = fields.String(allow_none=True, metadata={"description": "/app/shared/<token> or null"})
