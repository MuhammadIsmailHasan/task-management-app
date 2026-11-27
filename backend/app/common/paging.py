from marshmallow import fields, validate

from app.common.fields import BaseSchema

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


class PageQuerySchema(BaseSchema):
    limit = fields.Integer(
        load_default=DEFAULT_LIMIT,
        validate=validate.Range(min=1, max=MAX_LIMIT, error=f"limit must be between 1 and {MAX_LIMIT}"),
        metadata={"description": f"Rows per page (default {DEFAULT_LIMIT}, at most {MAX_LIMIT})"},
    )
    before = fields.UUID(metadata={"description": "Id of the last row already shown; returns the next older rows"})
