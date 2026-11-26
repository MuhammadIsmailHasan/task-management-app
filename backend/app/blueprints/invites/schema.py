from marshmallow import fields, validate

from app.common.fields import BaseSchema


class InviteSchema(BaseSchema):
    enabled = fields.Boolean()
    token = fields.String(allow_none=True, metadata={"description": "Secret; returned only by the invite endpoints"})
    path = fields.String(allow_none=True, metadata={"description": "/app/invite/<token> or null"})


class InviteBoardSchema(BaseSchema):
    id = fields.UUID()
    slug = fields.String()
    name = fields.String()
    description = fields.String(allow_none=True)


class InviteRequestRefSchema(BaseSchema):
    id = fields.UUID()
    status = fields.String()


class InviteStateSchema(BaseSchema):
    board = fields.Nested(InviteBoardSchema)
    state = fields.String(metadata={"description": "staff, member, pending or can_request"})
    request = fields.Nested(InviteRequestRefSchema, allow_none=True)


class JoinRequestSchema(BaseSchema):
    id = fields.UUID()
    board_id = fields.UUID()
    status = fields.String()
    created_at = fields.DateTime()


class JoinRequestUserSchema(BaseSchema):
    id = fields.UUID()
    full_name = fields.String()
    username = fields.String()
    email = fields.String()
    avatar_url = fields.String(allow_none=True)


class JoinRequestRowSchema(BaseSchema):
    id = fields.UUID()
    status = fields.String()
    created_at = fields.DateTime()
    user = fields.Nested(JoinRequestUserSchema)


class JoinRequestListQuerySchema(BaseSchema):
    status = fields.String(validate=validate.OneOf(["pending", "approved", "rejected", "all"]), load_default="pending")


class DecideSchema(BaseSchema):
    status = fields.String(required=True, validate=validate.OneOf(["approved", "rejected"]))
