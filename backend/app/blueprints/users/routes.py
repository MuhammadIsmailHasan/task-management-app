from flask import request, send_file
from flask_smorest import Blueprint

from app.blueprints.auth.dto import serialize_user, serialize_user_admin
from app.blueprints.auth.schema import AdminUserSchema, UserSchema
from app.blueprints.users import service
from app.blueprints.users.schema import CreateUserSchema, UpdateUserSchema, UserListQuerySchema, UserPageSchema
from app.common.auth import current_actor, require_role
from app.common.docs import endpoint
from app.common.envelope import envelope
from app.common.responses import ok

bp = Blueprint("users", __name__, description="User administration (Admin only)")


@bp.route("/users", methods=["GET"])
@endpoint(bp, "List users", "Admin only. Sorted by role, then name; paged with `page` and `per_page` (default 20, at most 100).", errors=(401, 403))
@require_role("admin")
@bp.arguments(UserListQuerySchema, location="query")
@bp.response(200, envelope(UserPageSchema))
def list_users(args):
    rows, total = service.list_users(args["page"], args["per_page"])
    return ok({"items": [serialize_user_admin(u) for u in rows], "page": args["page"], "per_page": args["per_page"], "total": total})


@bp.route("/users", methods=["POST"])
@endpoint(bp, "Create a user", "Admin only. Logs user.created.", errors=(400, 401, 403, 409))
@require_role("admin")
@bp.arguments(CreateUserSchema)
@bp.response(201, envelope(AdminUserSchema))
def create_user(data):
    return ok(serialize_user_admin(service.create_user(current_actor(), data)), "User created", 201)


@bp.route("/users/<user_id>", methods=["PATCH"])
@endpoint(bp, "Update a user or assign a role", "Admin only. Logs user.updated and user.role_changed.", errors=(400, 401, 403, 404, 409))
@require_role("admin")
@bp.arguments(UpdateUserSchema)
@bp.response(200, envelope(AdminUserSchema))
def update_user(data, user_id):
    return ok(serialize_user_admin(service.update_user(current_actor(), user_id, data)), "User updated")


_ANY_ROLE = ("member", "supervisor", "manager", "admin")
_AVATAR_BODY = {"content": {"multipart/form-data": {"schema": {"type": "object", "properties": {"file": {"type": "string", "format": "binary"}}, "required": ["file"]}}}}


@bp.route("/users/me/avatar", methods=["POST"])
@endpoint(bp, "Upload my avatar", "Multipart part `file`: PNG, JPEG or WebP by content, at most 2 MB. Replaces any previous avatar.", errors=(400, 401), requestBody=_AVATAR_BODY)
@require_role(*_ANY_ROLE)
@bp.response(200, envelope(UserSchema))
def upload_avatar():
    upload = request.files.get("file")
    return ok(serialize_user(service.set_avatar(current_actor(), upload.stream if upload else None)), "Avatar updated")


@bp.route("/users/me/avatar", methods=["DELETE"])
@endpoint(bp, "Remove my avatar", "Idempotent.", errors=(401,))
@require_role(*_ANY_ROLE)
@bp.response(200, envelope(UserSchema))
def remove_avatar():
    return ok(serialize_user(service.clear_avatar(current_actor())), "Avatar removed")


@bp.route("/users/<user_id>/avatar/file", methods=["GET"])
@endpoint(
    bp,
    "Download an avatar image",
    "No Token: access is the HMAC signature (exp and sig). Served inline with nosniff.",
    auth="none",
    errors=(403, 404),
    responses={"200": {"description": "Image bytes", "content": {"image/*": {"schema": {"type": "string", "format": "binary"}}}}},
)
def avatar_file(user_id):
    path, mime = service.open_avatar(user_id, request.args.get("exp"), request.args.get("sig"))
    response = send_file(path, mimetype=mime, as_attachment=False)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Disposition"] = "inline"
    response.headers["Cache-Control"] = "private, max-age=300"
    return response
