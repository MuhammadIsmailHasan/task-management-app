from marshmallow import fields, validate

from app.common.fields import BaseSchema


class AnalyticsSchema(BaseSchema):
    board_id = fields.UUID()
    name = fields.String()
    total = fields.Integer()
    done = fields.Integer()
    in_progress = fields.Integer()
    overdue = fields.Integer(metadata={"description": "Past end_date and not in Done"})
    done_delta = fields.Integer(metadata={"description": "Cards in Done updated in the last 7 days"})


class ThroughputQuerySchema(BaseSchema):
    weeks = fields.Integer(
        load_default=8,
        validate=validate.Range(min=1, max=26, error="weeks must be between 1 and 26"),
        metadata={"description": "How many weeks to return, ending with the current week (default 8, at most 26)"},
    )


class WeekSchema(BaseSchema):
    week_start = fields.Date(metadata={"description": "The Monday of the week, in the application time zone"})
    done = fields.Integer(metadata={"description": "Cards completed in that week"})


class ThroughputSchema(BaseSchema):
    board_id = fields.UUID()
    name = fields.String()
    weeks = fields.List(fields.Nested(WeekSchema), metadata={"description": "Oldest first, every week listed"})
    total = fields.Integer(metadata={"description": "Sum of done over the weeks"})
