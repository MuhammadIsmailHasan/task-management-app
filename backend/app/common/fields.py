import marshmallow as ma
from marshmallow import fields


class BaseSchema(ma.Schema):
    class Meta:
        unknown = ma.EXCLUDE


class Text(fields.String):
    def __init__(self, *, max_length=None, min_length=None, allow_blank=False, strip=True, **kwargs):
        super().__init__(**kwargs)
        self.max_length = max_length
        self.min_length = min_length
        self.allow_blank = allow_blank
        self.strip = strip
        if max_length:
            self.metadata = {**self.metadata, "maxLength": max_length}

    def make_error(self, key, **kwargs):
        if key in ("required", "null"):
            raise ma.ValidationError(f"{self.name} is required")
        return super().make_error(key, **kwargs)

    def _deserialize(self, value, attr, data, **kwargs):
        if not isinstance(value, str):
            raise ma.ValidationError(f"{attr} must be text")
        if self.strip:
            value = value.strip()
        if not value and not self.allow_blank:
            raise ma.ValidationError(f"{attr} is required")
        if self.min_length and len(value) < self.min_length:
            raise ma.ValidationError(f"{attr} must be at least {self.min_length} characters")
        if self.max_length and len(value) > self.max_length:
            raise ma.ValidationError(f"{attr} must be at most {self.max_length} characters")
        return value


class Username(Text):
    def __init__(self, **kwargs):
        super().__init__(max_length=30, **kwargs)
        self.metadata = {**self.metadata, "pattern": "^[a-z0-9_.]{3,30}$", "description": "Case-insensitive, unique"}

    def _deserialize(self, value, attr, data, **kwargs):
        from app.common.validation import is_username, normalize_username

        value = normalize_username(super()._deserialize(value, attr, data, **kwargs))
        if not is_username(value):
            raise ma.ValidationError("username must be 3 to 30 characters: letters, digits, underscore or dot")
        return value


class Email(Text):
    def __init__(self, **kwargs):
        super().__init__(max_length=255, **kwargs)
        self.metadata = {**self.metadata, "format": "email", "description": "Case-insensitive, unique"}

    def _deserialize(self, value, attr, data, **kwargs):
        from app.common.validation import is_email_shape, normalize_email

        value = normalize_email(super()._deserialize(value, attr, data, **kwargs))
        if not is_email_shape(value):
            raise ma.ValidationError("email must be a valid email address")
        return value
