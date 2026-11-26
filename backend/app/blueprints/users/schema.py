from marshmallow import RAISE, fields, validate

from app.blueprints.auth.schema import AdminUserSchema, RegisterSchema
from app.blueprints.users.dto import ROLES
from app.common.fields import BaseSchema, Email, Text, Username

_role = validate.OneOf(ROLES, error="role must be one of: " + ", ".join(ROLES))


class UserListQuerySchema(BaseSchema):
    page = fields.Integer(load_default=1, validate=validate.Range(min=1, error="page must be 1 or more"))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100, error="per_page must be between 1 and 100"))


class UserPageSchema(BaseSchema):
    items = fields.List(fields.Nested(AdminUserSchema))
    page = fields.Integer()
    per_page = fields.Integer()
    total = fields.Integer()


class CreateUserSchema(RegisterSchema):
    class Meta:
        unknown = RAISE  # avatar_url and other undefined fields are a 400 (Req 19.27)

    role = fields.String(validate=_role, load_default="member")


class UpdateUserSchema(BaseSchema):
    class Meta:
        unknown = RAISE

    full_name = Text(max_length=255)
    username = Username()
    email = Email()
    role = fields.String(validate=_role)
    is_active = fields.Boolean(truthy={True}, falsy={False}, metadata={"description": "Admin only. false is refused while the user has open work (409 USER_HAS_OPEN_WORK)"})
    is_available = fields.Boolean(truthy={True}, falsy={False})
