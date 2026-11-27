import hashlib
import hmac

from flask import current_app

TTL_SECONDS = 900


def api_base():
    try:
        return (current_app.config.get("API_PUBLIC_PREFIX") or "/api").rstrip("/")
    except RuntimeError:
        return "/api"


def _secret(secret):
    return (secret or current_app.config["FILE_URL_SECRET"]).encode()


def _mac(resource_id, exp, secret, scope=None):
    return hmac.new(_secret(secret), f"{resource_id}.{exp}.{scope or ''}".encode(), hashlib.sha256).hexdigest()


def share_scope(share_token, secret=None):
    return "share:" + hmac.new(_secret(secret), share_token.encode(), hashlib.sha256).hexdigest()[:16]


def sign_file_url(attachment_id, now, secret=None, scope=None):
    exp = int(now.timestamp()) + TTL_SECONDS
    path = f"{api_base()}/attachments/{attachment_id}/file?exp={exp}&sig={_mac(attachment_id, exp, secret, scope)}"
    if scope:
        path += f"&st={scope}"
    return path, exp


def verify_file_signature(attachment_id, exp, sig, now, secret=None, scope=None):
    if not exp or not sig:
        return False
    try:
        exp_i = int(exp)
    except (TypeError, ValueError):
        return False
    if not hmac.compare_digest(_mac(attachment_id, exp_i, secret, scope), str(sig)):
        return False
    return int(now.timestamp()) <= exp_i


def avatar_url(user_id, now, secret=None):
    exp = int(now.timestamp()) + TTL_SECONDS
    return f"{api_base()}/users/{user_id}/avatar/file?exp={exp}&sig={_mac(user_id, exp, secret, 'avatar')}"


def verify_avatar_signature(user_id, exp, sig, now, secret=None):
    return verify_file_signature(user_id, exp, sig, now, secret, scope="avatar")
