from marshmallow import fields, validate

from app.common.fields import BaseSchema, Text


CATEGORY_COLORS = (
    "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan",
    "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose", "slate",
)
_color = validate.OneOf(CATEGORY_COLORS, error="color must be one of the palette colours")


class CreateCategorySchema(BaseSchema):
    name = Text(required=True, max_length=255)
    color = fields.String(allow_none=True, validate=_color, metadata={"description": "A palette key: " + ", ".join(CATEGORY_COLORS)})


class UpdateCategorySchema(BaseSchema):
    name = Text(max_length=255)
    color = fields.String(allow_none=True, validate=_color)


class CategorySchema(BaseSchema):
    id = fields.UUID()
    board_id = fields.UUID()
    name = fields.String()
    color = fields.String(allow_none=True)
