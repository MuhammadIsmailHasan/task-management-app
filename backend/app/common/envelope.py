import marshmallow as ma
from marshmallow import fields

_cache = {}


class ErrorDetailSchema(ma.Schema):
    code = fields.String(metadata={"description": "Machine-readable error code"})
    details = fields.Dict(
        keys=fields.String(),
        values=fields.List(fields.String()),
        metadata={"description": "VALIDATION_ERROR only: field name to list of messages"},
    )


class ErrorEnvelopeSchema(ma.Schema):
    status = fields.Boolean(metadata={"description": "Always false on errors"})
    message = fields.String(metadata={"description": "Human-readable message"})
    error = fields.Nested(ErrorDetailSchema)


class NullEnvelopeSchema(ma.Schema):
    status = fields.Boolean(metadata={"description": "True when the HTTP status is 2xx"})
    message = fields.String()
    data = fields.Raw(allow_none=True, metadata={"description": "Always null"})


def envelope(data_schema, many=False):
    key = (data_schema, many)
    if key not in _cache:
        base = data_schema.__name__.removesuffix("Schema")
        name = f"{base}{'List' if many else ''}EnvelopeSchema"
        _cache[key] = type(
            name,
            (ma.Schema,),
            {
                "status": fields.Boolean(metadata={"description": "True when the HTTP status is 2xx"}),
                "message": fields.String(metadata={"description": "Human-readable message"}),
                "data": fields.Nested(data_schema, many=many, allow_none=True),
            },
        )
    return _cache[key]
