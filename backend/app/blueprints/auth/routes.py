from flask import request
from flask_smorest import Blueprint

from app.blueprints.auth import service
from app.blueprints.auth.schema import (
    AuthSchema,
    AvailabilityQuerySchema,
    AvailabilitySchema,
    ChangePasswordSchema,
    LoginSchema,
    MessageSchema,
    RegisterSchema,
    ResendVerificationSchema,
    UpdateMeSchema,
    UserSchema,
    VerifyResultSchema,
    VerifySchema,
)
from app.common.auth import current_actor, require_role
from app.common.docs import endpoint
from app.common.envelope import NullEnvelopeSchema, envelope
from app.common.responses import ok

bp = Blueprint("auth", __name__, description="Register, log in and log out")


@bp.route("/auth/register", methods=["POST"])
@endpoint(bp, "Register an account", "Creates a member account and mails a confirmation link. No Token is returned (`token` is null): the account signs in after the email is confirmed.", auth="none", errors=(400, 409))
@bp.arguments(RegisterSchema)
@bp.response(201, envelope(AuthSchema))
def register(data):
    return ok(service.register(data), "User registered", 201)


@bp.route("/auth/login", methods=["POST"])
@endpoint(bp, "Log in", "The identifier is a username or an email, matched case-insensitively. One generic 401 for any mismatch. With the right password, 403 ACCOUNT_DISABLED (an Admin turned the account off) or 403 ACCOUNT_NOT_ACTIVATED (the email is not confirmed yet).", auth="none", errors=(400, 401, 403, 429))
@bp.arguments(LoginSchema)
@bp.response(200, envelope(AuthSchema))
def login(data):
    return ok(service.login(data, request.remote_addr), "Logged in")


@bp.route("/auth/verify", methods=["POST"])
@endpoint(bp, "Confirm an emailed link", "Body `token` from the link. Confirms the account's email, or applies a waiting email change. One use only: 400 TOKEN_INVALID for an unknown or used value, 400 TOKEN_EXPIRED after 24 hours. It never signs anyone in.", auth="none", errors=(400, 409))
@bp.arguments(VerifySchema)
@bp.response(200, envelope(VerifyResultSchema))
def verify(data):
    return ok(service.verify(data), "Email confirmed")


@bp.route("/auth/resend-verification", methods=["POST"])
@endpoint(bp, "Send a new confirmation link", "Always the same answer, whether or not the address exists or is confirmed. Rate limited per address and per client.", auth="none", errors=(400, 429))
@bp.arguments(ResendVerificationSchema)
@bp.response(200, envelope(MessageSchema))
def resend_verification(data):
    return ok(service.resend_verification(data["email"], request.remote_addr), "OK")


@bp.route("/auth/availability", methods=["GET"])
@endpoint(bp, "Check username and email availability", "Reports whether each supplied value is free. No Token needed.", auth="none", errors=(400, 429))
@bp.arguments(AvailabilityQuerySchema, location="query")
@bp.response(200, envelope(AvailabilitySchema))
def availability(args):
    return ok(service.availability(args.get("username"), args.get("email"), request.remote_addr), "OK")


@bp.route("/auth/logout", methods=["POST"])
@endpoint(bp, "Log out", "Revokes nothing; the client discards the Token, which stays valid until expiry.", auth="none", errors=())
@bp.response(200, NullEnvelopeSchema)
def logout():
    return ok(None, "Logged out")


_ANY_ROLE = ("member", "supervisor", "manager", "admin")


@bp.route("/auth/me", methods=["GET"])
@endpoint(bp, "Get the signed-in user", "Returns the user shape of register and login.", errors=(401,))
@require_role(*_ANY_ROLE)
@bp.response(200, envelope(UserSchema))
def me():
    return ok(service.get_me(current_actor()), "OK")


@bp.route("/auth/me", methods=["PATCH"])
@endpoint(bp, "Update the profile", "`full_name`, `username`, `email` and `is_available`. A new `email` waits as `pending_email` until its link is confirmed; the old one stays in use. Any other field is a 400.", errors=(400, 401, 409))
@require_role(*_ANY_ROLE)
@bp.arguments(UpdateMeSchema)
@bp.response(200, envelope(UserSchema))
def update_me(data):
    return ok(service.update_me(current_actor(), data), "Profile updated")


@bp.route("/auth/me/email/resend", methods=["POST"])
@endpoint(bp, "Send the email-change link again", "404 when no change is waiting. Rate limited.", errors=(401, 404, 429))
@require_role(*_ANY_ROLE)
@bp.response(200, envelope(UserSchema))
def resend_email_change():
    return ok(service.resend_email_change(current_actor()), "Link sent")


@bp.route("/auth/me/email/pending", methods=["DELETE"])
@endpoint(bp, "Cancel a waiting email change", "Clears `pending_email` and invalidates its links. Idempotent.", errors=(401,))
@require_role(*_ANY_ROLE)
@bp.response(200, envelope(UserSchema))
def cancel_email_change():
    return ok(service.cancel_email_change(current_actor()), "Email change cancelled")


@bp.route("/auth/change-password", methods=["POST"])
@endpoint(bp, "Change the password", "The current password is required. A wrong one is a 400 (never 401) and is counted; the issued Token stays valid. A notice goes to the account's email.", errors=(400, 401, 429))
@require_role(*_ANY_ROLE)
@bp.arguments(ChangePasswordSchema)
@bp.response(200, NullEnvelopeSchema)
def change_password(data):
    service.change_password(current_actor(), data)
    return ok(None, "Password changed")
