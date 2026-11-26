from marshmallow import RAISE, fields, validate

from app.blueprints.auth.schema import RegisterSchema
from app.blueprints.users.dto import ROLES
from app.common.fields import BaseSchema, Email, Text, Username

_role = validate.OneOf(ROLES, error="role must be one of: " + ", ".join(ROLES))


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
