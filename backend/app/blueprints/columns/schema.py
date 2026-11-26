from marshmallow import fields, validate

from app.common.fields import BaseSchema, Text


class RenameColumnSchema(BaseSchema):
    name = Text(required=True, max_length=255)


class MoveColumnSchema(BaseSchema):
    position = fields.Integer(required=True, strict=True, validate=validate.Range(min=0), metadata={"description": "0-based index among the Board's Columns"})
