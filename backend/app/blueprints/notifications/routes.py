from flask_smorest import Blueprint

from app.blueprints.notifications import service
from app.blueprints.notifications.schema import InboxQuerySchema, InboxSchema, NotificationSchema, PreferencesSchema
from app.common.auth import current_actor, require_role
from app.common.docs import endpoint
from app.common.paging import PageQuerySchema
from app.common.envelope import NullEnvelopeSchema, envelope
from app.common.responses import ok

bp = Blueprint("notifications", __name__, description="Inbox (created server-side only)")
USERS = ("member", "supervisor", "manager", "admin")


@bp.route("/notifications", methods=["GET"])
@endpoint(bp, "List my notifications", "Only the caller's rows. Paged with `limit` and `before`; `unread=true` lists only unread rows; `unread_count` counts all of them.", errors=(400, 401))
@require_role(*USERS)
@bp.arguments(InboxQuerySchema, location="query")
@bp.response(200, envelope(InboxSchema))
def inbox(page):
    return ok(service.inbox(current_actor(), page["limit"], page.get("before"), page.get("unread") == "true"))


@bp.route("/notifications/read-all", methods=["PATCH"])
@endpoint(bp, "Mark all my notifications read", errors=(401,))
@require_role(*USERS)
@bp.response(200, NullEnvelopeSchema)
def read_all():
    service.mark_all_read(current_actor())
    return ok(None, "All notifications marked read")


@bp.route("/notifications/<notification_id>/read", methods=["PATCH"])
@endpoint(bp, "Mark one notification read", "404 for another user's or unknown id.", errors=(401, 404))
@require_role(*USERS)
@bp.response(200, envelope(NotificationSchema))
def read_one(notification_id):
    return ok(service.serialize(service.mark_read(current_actor(), notification_id)), "Notification marked read")


@bp.route("/me/notification-preferences", methods=["GET"])
@endpoint(bp, "My notification preferences", "Exactly five types, in order; `enabled` is true where nothing was saved. In-app notifications only.", errors=(401,))
@require_role(*USERS)
@bp.response(200, envelope(PreferencesSchema))
def get_preferences():
    return ok(service.preferences(current_actor()))


@bp.route("/me/notification-preferences", methods=["PUT"])
@endpoint(bp, "Save notification preferences", "Upserts the listed types (one to five, no repeat) in one transaction and returns the full list. An unknown type or a non-boolean `enabled` is a 400.", errors=(400, 401))
@require_role(*USERS)
@bp.arguments(PreferencesSchema)
@bp.response(200, envelope(PreferencesSchema))
def put_preferences(data):
    return ok(service.set_preferences(current_actor(), data), "Preferences saved")
