from flask_smorest import Blueprint

from app.blueprints.health import service
from app.blueprints.health.schema import HealthSchema
from app.common.docs import endpoint
from app.common.envelope import envelope
from app.common.responses import ok

bp = Blueprint("health", __name__, description="Liveness for containers and deploys. No Token needed.")


@bp.route("/health", methods=["GET"])
@endpoint(bp, "Health", "503 when the database does not answer within 5 seconds.", auth="none", errors=(503,))
@bp.response(200, envelope(HealthSchema))
def health():
    return ok(service.check())
