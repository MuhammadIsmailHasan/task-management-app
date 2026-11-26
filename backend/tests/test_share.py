"""Share links and the read-only shared routes (Requirement 18; Properties 40, 41)."""
import io

from app.models import ActivityLog, Board
from helpers import Env


def _share(client, env, who="manager", method="post", suffix=""):
    return getattr(client, method)(f"/api/boards/{env.bid}/share{suffix}", headers=env.h[who])


def test_share_lifecycle_and_roles(client):
    env = Env(client)
    assert _share(client, env, "member", "get").status_code == 403
    assert _share(client, env, "sup_member").status_code == 403  # a BoardMember Supervisor is not enough
    assert _share(client, env, "owner").status_code == 403  # nor is the Board_Owner (V12, Decision Z)
    assert _share(client, env, "owner", "get").status_code == 403
    assert client.post(f"/api/boards/{env.bid}/share").status_code == 401
    off = _share(client, env, "manager", "get").get_json()["data"]
    assert off == {"enabled": False, "token": None, "path": None}
    on = _share(client, env, "manager").get_json()["data"]
    assert on["enabled"] and len(on["token"]) >= 43 and on["path"] == f"/app/shared/{on['token']}"
    assert _share(client, env, "manager").get_json()["data"]["token"] == on["token"]  # idempotent
    new = _share(client, env, "admin", suffix="/regenerate").get_json()["data"]
    assert new["token"] != on["token"]
    assert client.get(f"/api/shared/{on['token']}").status_code == 404
    assert client.get(f"/api/shared/{new['token']}").status_code == 200
    assert _share(client, env, "manager", "delete").get_json()["data"]["enabled"] is False
    assert _share(client, env, "manager", "delete").status_code == 200  # already off
    assert client.get(f"/api/shared/{new['token']}").status_code == 404
    rows = ActivityLog.query.filter(ActivityLog.action.like("board.share_%")).all()
    assert sorted(r.action for r in rows) == ["board.share_disabled", "board.share_enabled", "board.share_regenerated"]
    assert new["token"] not in str([r.metadata_ for r in rows])


def test_shared_payloads_never_leak_discussion_or_people(client):
    env = Env(client)
    card = env.card()
    client.patch(f"/api/cards/{card['id']}", headers=env.h["manager"], json={"assignee_id": env.uid("member")})
    client.post(f"/api/cards/{card['id']}/comments", headers=env.h["manager"], json={"content": "secret talk"})
    token = _share(client, env, "manager").get_json()["data"]["token"]
    board = client.get(f"/api/shared/{token}")
    assert board.status_code == 200 and board.headers["Cache-Control"] == "private, no-store"
    b = board.get_json()["data"]
    assert b["has_board_access"] is False and set(b) == {"id", "name", "description", "columns", "has_board_access"}
    cards = client.get(f"/api/shared/{token}/cards").get_json()["data"]
    assert len(cards) == 1 and cards[0]["assignee_name"]
    one = client.get(f"/api/shared/{token}/cards/{card['id']}").get_json()["data"]
    blob = str([b, cards, one]).lower()
    for banned in ("secret talk", "comments", "activity", "owner_id", "share_token", "email", "username", "avatar", "@example"):
        assert banned not in blob
    assert client.get(f"/api/shared/{token}/categories").status_code == 200
    assert client.get(f"/api/shared/{token}/cards?filter[priority]=bogus").status_code == 400
    # signed-in viewer with access sees has_board_access, an unusable Token reads as a Guest
    assert client.get(f"/api/shared/{token}", headers=env.h["member"]).get_json()["data"]["has_board_access"] is True
    assert client.get(f"/api/shared/{token}", headers={"Authorization": "Bearer junk"}).status_code == 200
    # the normal routes stay closed to a Guest and a private board stays private to others
    assert client.get(f"/api/boards/{env.bid}").status_code == 401
    assert client.get(f"/api/boards/{env.bid}", headers=env.h["member_other"]).status_code == 403


def test_property_54_a_public_link_grants_no_write(client):
    env = Env(client)
    card = env.card()
    token = _share(client, env).get_json()["data"]["token"]
    sub = client.post(f"/api/cards/{card['id']}/subtasks", headers=env.h["manager"], json={"title": "s"}).get_json()["data"]
    writes = (
        ("post", f"/api/cards/{card['id']}/comments", {"content": "x"}),
        ("patch", f"/api/cards/{card['id']}", {"title": "z"}),
        ("post", f"/api/cards/{card['id']}/attachments", {"url": "https://e.com/x"}),
        ("patch", f"/api/subtasks/{sub['id']}", {"is_done": True}),
        ("post", f"/api/cards/{card['id']}/archive", None),
        ("delete", f"/api/cards/{card['id']}", None),
    )
    for method, path, body in writes:
        kw = {"json": body} if body is not None else {}
        assert getattr(client, method)(path, **kw).status_code == 401, path  # Guest
        assert getattr(client, method)(path, headers=env.h["member_other"], **kw).status_code == 403, path  # no access
    # the link itself accepts nothing but GET
    for method in ("post", "patch", "put", "delete"):
        assert getattr(client, method)(f"/api/shared/{token}").status_code == 405
        assert getattr(client, method)(f"/api/shared/{token}/cards").status_code == 405


def test_a_token_never_reaches_another_board(client):
    a = Env(client)
    other = client.post("/api/boards", headers=a.h["manager"], json={"name": "Other"}).get_json()["data"]
    card_b = client.post(f"/api/columns/{other['columns'][0]['id']}/cards", headers=a.h["manager"], json={"title": "x"}).get_json()["data"]
    ta = _share(client, a).get_json()["data"]["token"]
    assert client.get(f"/api/shared/{ta}/cards/{card_b['id']}").status_code == 404
    assert client.get(f"/api/shared/{ta}/cards/not-a-uuid").status_code == 404
    assert client.get("/api/shared/not-a-token").status_code == 404


def test_shared_file_urls_are_scoped_and_die_with_the_link(client, app):
    env = Env(client)
    card = env.card()
    up = client.post(
        f"/api/cards/{card['id']}/attachments",
        headers=env.h["manager"],
        data={"file": (io.BytesIO(b"%PDF-1.4 x"), "doc.pdf", "application/pdf")},
        content_type="multipart/form-data",
    )
    att = up.get_json()["data"]
    token = _share(client, env, "manager").get_json()["data"]["token"]
    url = client.get(f"/api/shared/{token}/attachments/{att['id']}/url").get_json()["data"]["file_url"]
    assert "st=share:" in url and token not in url
    assert client.get(url).status_code == 200
    plain = att["file_url"]
    assert client.get(plain).status_code == 200  # ordinary URL unaffected
    assert client.get(url.replace("st=share:", "st=share:0")).status_code == 403
    assert client.get(plain + "&st=share:abcd").status_code == 403  # scope is inside the signature
    _share(client, env, "manager", suffix="/regenerate")
    assert client.get(url).status_code == 403
    assert client.get(plain).status_code == 200


def test_shared_prefix_is_get_only(app):
    rules = [r for r in app.url_map.iter_rules() if r.rule.startswith("/api/shared")]
    assert rules and all(r.methods - {"HEAD", "OPTIONS"} == {"GET"} for r in rules)
    assert not any("comment" in r.rule or "activity" in r.rule for r in rules)


def test_member_email_only_for_staff(client):
    env = Env(client)
    base = f"/api/boards/{env.bid}/members"
    plain = client.get(base, headers=env.h["member"]).get_json()["data"]
    assert plain and all("email" not in m for m in plain)
    assert client.get(base + "?include=email", headers=env.h["member"]).status_code == 403
    assert client.get(base + "?include=email", headers=env.h["sup_other"]).status_code == 403
    assert client.get(base + "?include=email").status_code == 401
    assert client.get(base + "?include=bogus", headers=env.h["manager"]).status_code == 400
    staff = client.get(base + "?include=email", headers=env.h["owner"]).get_json()["data"]
    assert all(m["email"].endswith("@t.test") for m in staff)
