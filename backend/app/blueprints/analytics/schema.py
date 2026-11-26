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


class DashboardQuerySchema(BaseSchema):
    board = fields.UUID(metadata={"description": "One Board; absent means every Board the viewer may read"})
    member = fields.UUID(metadata={"description": "Only Cards assigned to this user"})
    date_from = fields.Date(data_key="from", metadata={"description": "YYYY-MM-DD, default 29 days before `to`"})
    date_to = fields.Date(data_key="to", metadata={"description": "YYYY-MM-DD, default today in the application time zone"})
    due_on = fields.Date(metadata={"description": "The day the Due tomorrow widget lists (default tomorrow)"})


class DashboardCardSchema(BaseSchema):
    id = fields.UUID()
    title = fields.String()
    board_id = fields.UUID()
    board_slug = fields.String()
    board_name = fields.String()
    priority = fields.String()
    end_date = fields.String(allow_none=True)
    due_state = fields.String(allow_none=True)
    assignee_name = fields.String(allow_none=True)


class DashboardCardListSchema(BaseSchema):
    count = fields.Integer()
    cards = fields.List(fields.Nested(DashboardCardSchema))
    due_on = fields.String()


class DashboardSchema(BaseSchema):
    range = fields.Dict(metadata={"description": "`from` and `to` as YYYY-MM-DD"})
    today = fields.String()
    overview = fields.Dict(metadata={"description": "total, done, in_progress, overdue (not limited by the date range)"})
    throughput = fields.Dict(metadata={"description": "weeks (oldest first, every week listed) and total, for the weeks that touch the range"})
    overdue = fields.Nested(DashboardCardListSchema, metadata={"description": "Open cards past their end date, the end date inside the range; first 10"})
    due_tomorrow = fields.Nested(DashboardCardListSchema, metadata={"description": "Open cards whose end date is `due_on`; first 10"})
    top_priority = fields.Dict(metadata={"description": "cards: up to 5 open cards, highest priority first then the nearest end date"})
    finished = fields.Dict(metadata={"description": "on_time and overdue counts of cards finished in the range that have an end date"})
    members = fields.List(fields.Dict(), metadata={"description": "People of the scope: id, full_name, avatar_url (no email)"})
