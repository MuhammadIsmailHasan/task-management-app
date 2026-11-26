from marshmallow import fields, validate

from app.common.fields import BaseSchema, Text


class CreateCommentSchema(BaseSchema):
    content = Text(required=True)


class CommentListQuerySchema(BaseSchema):
    sort = fields.String(
        validate=validate.OneOf(["latest", "popular"], error="sort must be latest or popular"),
        metadata={"description": "latest (default) or popular"},
    )
    limit = fields.Integer(validate=validate.Range(min=1, max=50, error="limit must be between 1 and 50"), metadata={"description": "Top-level comments per page; every comment when absent"})
    offset = fields.Integer(load_default=0, validate=validate.Range(min=0, error="offset must be 0 or more"))


class ReplySchema(BaseSchema):
    id = fields.UUID()
    card_id = fields.UUID()
    author_id = fields.UUID()
    author_name = fields.String(allow_none=True, metadata={"description": "Display name of the author"})
    author_avatar_url = fields.String(allow_none=True, metadata={"description": "Signed avatar URL (15 minutes) or null"})
    parent_id = fields.UUID(allow_none=True)
    content = fields.String()
    is_priority = fields.Boolean()
    reply_count = fields.Integer()
    created_at = fields.String()
    can_create_card = fields.Boolean()


class CommentSchema(ReplySchema):
    replies = fields.List(fields.Nested(ReplySchema))


class CommentPageSchema(BaseSchema):
    items = fields.List(fields.Nested(CommentSchema))
    total = fields.Integer(metadata={"description": "Top-level comments on the card, whatever the page"})


class DeletedSchema(BaseSchema):
    deleted = fields.Integer(metadata={"description": "Rows removed: the comment plus its replies"})
