from flask_smorest import Blueprint

from app.blueprints.analytics import service
from app.blueprints.analytics.schema import AnalyticsSchema, DashboardQuerySchema, DashboardSchema, KpiQuerySchema, KpiSchema, MyKpiQuerySchema, MyKpiSchema, ThroughputQuerySchema, ThroughputSchema
from app.common.auth import current_actor, require_role
from app.common.docs import endpoint
from app.common.envelope import envelope
from app.common.responses import ok

bp = Blueprint("analytics", __name__, description="Board and cross-board summaries")


@bp.route("/boards/<board_id>/analytics", methods=["GET"])
@endpoint(bp, "Board analytics", "Manager on any board; Supervisor only as board owner. Member 403.")
@require_role("member", "supervisor", "manager", "admin")
@bp.response(200, envelope(AnalyticsSchema))
def board_analytics(board_id):
    return ok(service.board_analytics(current_actor(), board_id))


@bp.route("/analytics/boards", methods=["GET"])
@endpoint(bp, "Cross-board analytics", "Manager and Admin. One summary per board.", errors=(401, 403))
@require_role("manager", "admin")
@bp.response(200, envelope(AnalyticsSchema, many=True))
def all_boards():
    return ok(service.all_boards(current_actor()))


@bp.route("/boards/<board_id>/analytics/throughput", methods=["GET"])
@endpoint(bp, "Board throughput", "Cards completed per week. Manager on any board; Supervisor only as board owner. Member 403.")
@require_role("member", "supervisor", "manager", "admin")
@bp.arguments(ThroughputQuerySchema, location="query")
@bp.response(200, envelope(ThroughputSchema))
def board_throughput(args, board_id):
    return ok(service.board_throughput(current_actor(), board_id, args["weeks"]))


@bp.route("/analytics/throughput", methods=["GET"])
@endpoint(bp, "Cross-board throughput", "Manager and Admin. One weekly series per board.", errors=(400, 401, 403))
@require_role("manager", "admin")
@bp.arguments(ThroughputQuerySchema, location="query")
@bp.response(200, envelope(ThroughputSchema, many=True))
def all_throughput(args):
    return ok(service.all_throughput(current_actor(), args["weeks"]))


@bp.route("/analytics/dashboard", methods=["GET"])
@endpoint(bp, "Dashboard", "Supervisor (the Boards it owns) and Manager (any Board). Member 403. One aggregated answer with a fixed number of queries: overview, throughput, overdue, due tomorrow, top priority, finished on time and overdue, and the people of the scope. A range longer than 182 days is a 400.", errors=(400, 401, 403, 404))
@require_role("supervisor", "manager", "member", "admin")
@bp.arguments(DashboardQuerySchema, location="query")
@bp.response(200, envelope(DashboardSchema))
def dashboard(args):
    return ok(service.dashboard(current_actor(), args.get("board"), args.get("member"), args.get("date_from"), args.get("date_to"), args.get("due_on")))


@bp.route("/analytics/kpi", methods=["GET"])
@endpoint(bp, "Team KPIs", "Supervisor (the Boards it owns), Manager and Admin (any Board). Member 403. Team figures and one row per person of the scope for the date range.", errors=(400, 401, 403, 404))
@require_role("supervisor", "manager", "member", "admin")
@bp.arguments(KpiQuerySchema, location="query")
@bp.response(200, envelope(KpiSchema))
def team_kpi(args):
    return ok(service.kpi(current_actor(), args.get("board"), args.get("date_from"), args.get("date_to")))


@bp.route("/me/kpi", methods=["GET"])
@endpoint(bp, "My KPIs", "Every role. The caller's own figures over the cards assigned to them.", errors=(400, 401))
@require_role("supervisor", "manager", "member", "admin")
@bp.arguments(MyKpiQuerySchema, location="query")
@bp.response(200, envelope(MyKpiSchema))
def my_kpi(args):
    return ok(service.my_kpi(current_actor(), args.get("date_from"), args.get("date_to")))
