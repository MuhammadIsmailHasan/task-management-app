from flask_smorest import Blueprint

from app.blueprints.analytics import service
from app.blueprints.analytics.schema import AnalyticsSchema, DashboardQuerySchema, DashboardSchema, ThroughputQuerySchema, ThroughputSchema
from app.common.auth import current_actor, require_role
from app.common.docs import endpoint
from app.common.envelope import envelope
from app.common.responses import ok

bp = Blueprint("analytics", __name__, description="Board and cross-board summaries")


@bp.route("/boards/<board_id>/analytics", methods=["GET"])
@endpoint(bp, "Board analytics", "Manager on any board; Supervisor only as board owner. Member and Admin 403.")
@require_role("member", "supervisor", "manager", "admin")
@bp.response(200, envelope(AnalyticsSchema))
def board_analytics(board_id):
    return ok(service.board_analytics(current_actor(), board_id))


@bp.route("/analytics/boards", methods=["GET"])
@endpoint(bp, "Cross-board analytics", "Manager only. One summary per board.", errors=(401, 403))
@require_role("manager")
@bp.response(200, envelope(AnalyticsSchema, many=True))
def all_boards():
    return ok(service.all_boards(current_actor()))


@bp.route("/boards/<board_id>/analytics/throughput", methods=["GET"])
@endpoint(bp, "Board throughput", "Cards completed per week. Manager on any board; Supervisor only as board owner. Member and Admin 403.")
@require_role("member", "supervisor", "manager", "admin")
@bp.arguments(ThroughputQuerySchema, location="query")
@bp.response(200, envelope(ThroughputSchema))
def board_throughput(args, board_id):
    return ok(service.board_throughput(current_actor(), board_id, args["weeks"]))


@bp.route("/analytics/throughput", methods=["GET"])
@endpoint(bp, "Cross-board throughput", "Manager only. One weekly series per board.", errors=(400, 401, 403))
@require_role("manager")
@bp.arguments(ThroughputQuerySchema, location="query")
@bp.response(200, envelope(ThroughputSchema, many=True))
def all_throughput(args):
    return ok(service.all_throughput(current_actor(), args["weeks"]))


@bp.route("/analytics/dashboard", methods=["GET"])
@endpoint(bp, "Dashboard", "Supervisor (the Boards it owns) and Manager (any Board). Member and Admin 403. One aggregated answer with a fixed number of queries: overview, throughput, overdue, due tomorrow, top priority, finished on time and overdue, and the people of the scope. A range longer than 182 days is a 400.", errors=(400, 401, 403, 404))
@require_role("supervisor", "manager", "member", "admin")
@bp.arguments(DashboardQuerySchema, location="query")
@bp.response(200, envelope(DashboardSchema))
def dashboard(args):
    return ok(service.dashboard(current_actor(), args.get("board"), args.get("member"), args.get("date_from"), args.get("date_to"), args.get("due_on")))
