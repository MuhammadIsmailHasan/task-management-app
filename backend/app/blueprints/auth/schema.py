from marshmallow import RAISE, fields, validates_schema
from marshmallow import ValidationError as SchemaError

from app.common.fields import BaseSchema, Email, Text, Username


class RegisterSchema(BaseSchema):
    full_name = Text(required=True, max_length=255)
    username = Username(required=True)
    email = Email(required=True)
    password = Text(required=True, min_length=8, strip=False, metadata={"description": "At least 8 characters"})


class LoginSchema(BaseSchema):
    identifier = Text(required=True, max_length=255, metadata={"description": "Username or email, case-insensitive"})
    password = Text(required=True, strip=False)


class UpdateMeSchema(BaseSchema):
    class Meta:
        unknown = RAISE

    full_name = Text(max_length=255)
    username = Username()
    email = Email()
    is_available = fields.Boolean(truthy={True}, falsy={False})

    @validates_schema
    def _one_field(self, data, **kwargs):
        if not data:
            raise SchemaError({"full_name": ["send at least one field to change"]})


class ChangePasswordSchema(BaseSchema):
    current_password = Text(required=True, strip=False)
    new_password = Text(required=True, min_length=8, strip=False, metadata={"description": "At least 8 characters"})


class AvailabilityQuerySchema(BaseSchema):
    username = fields.String()
    email = fields.String()


class AvailabilityEntrySchema(BaseSchema):
    available = fields.Boolean()


class AvailabilitySchema(BaseSchema):
    username = fields.Nested(AvailabilityEntrySchema)
    email = fields.Nested(AvailabilityEntrySchema)


class UserSchema(BaseSchema):
    id = fields.UUID()
    full_name = fields.String()
    username = fields.String()
    email = fields.String()
    avatar_url = fields.String(allow_none=True)
    is_active = fields.Boolean()
    is_available = fields.Boolean()
    pending_email = fields.String(allow_none=True, metadata={"description": "A new address waiting for its confirmation link; visible to its owner and an Admin only"})


class MemberSchema(BaseSchema):
    id = fields.UUID()
    full_name = fields.String()
    username = fields.String()
    avatar_url = fields.String(allow_none=True)


class MemberWithEmailSchema(MemberSchema):
    email = fields.String(metadata={"description": "Only with ?include=email, for board staff"})


class AdminUserSchema(UserSchema):
    role = fields.String(metadata={"description": "member, supervisor, manager or admin"})


class AuthSchema(BaseSchema):
    user = fields.Nested(UserSchema)
    token = fields.String(allow_none=True, metadata={"description": "JWT, valid 24 hours. Null after register: the email must be confirmed first (V17)"})


class VerifySchema(BaseSchema):
    token = Text(required=True, max_length=200, strip=True, metadata={"description": "The value from the emailed link"})


class VerifyResultSchema(BaseSchema):
    purpose = fields.String(metadata={"description": "verify_email or change_email"})


class ResendVerificationSchema(BaseSchema):
    email = Email(required=True)


class MessageSchema(BaseSchema):
    message = fields.String()
