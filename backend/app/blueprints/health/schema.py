import marshmallow as ma
from marshmallow import fields


class HealthSchema(ma.Schema):
    database = fields.String(metadata={"description": "ok"})
