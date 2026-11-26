"""Properties 1, 2, 6-14, 17-21 (auth, boards, columns, cards, subtasks, attachments, categories)."""
import io
import string
import uuid
from datetime import date, datetime, timedelta, timezone

from hypothesis import assume, given, strategies as st

from app.common.signing import sign_file_url, verify_file_signature
from app.extensions import db
from app.models import ActivityLog, Board, BoardMember, Card, Category, Column, Notification, Subtask
from helpers import PROP, UUID0, Env, hdr, mkuser, reset_db, verify_email

uname = st.text(alphabet=string.ascii_letters + string.digits + "_.", min_size=3, max_size=30)
local = st.text(alphabet=string.ascii_lowercase + string.digits, min_size=1, max_size=20)
email = st.builds(lambda a, b: f"{a}@{b}.com", local, local)
name = st.text(alphabet=string.ascii_letters + " ", min_size=1, max_size=30).filter(lambda s: s.strip())
pw = st.text(min_size=8, max_size=40)


# ---- Property 1 and 2: auth ----
@PROP
@given(full=name, username=uname, mail=email, password=pw)
def test_property_1_register_login_round_trip(client, full, username, mail, password):
    reset_db()
    r = client.post("/api/auth/register", json={"full_name": f" {full} ", "username": f" {username} ", "email": f" {mail} ", "password": password})
    assert r.status_code == 201
    data = r.get_json()["data"]
    assert data["user"]["full_name"] == full.strip() and data["user"]["username"] == username.lower() and data["user"]["email"] == mail
    assert "password" not in str(data) and data["token"] is None  # no Token before the email is confirmed (V17)
    assert client.post("/api/auth/login", json={"identifier": username, "password": password}).status_code == 403
    assert verify_email(client, mail).status_code == 200
    for ident in (username.swapcase(), mail.upper()):
        again = client.post("/api/auth/login", json={"identifier": ident, "password": password})
        assert again.status_code == 200 and again.get_json()["data"]["user"]["id"] == data["user"]["id"]
    assert client.post("/api/auth/login", json={"identifier": username, "password": password + "x"}).status_code == 401


@PROP
@given(
    full=st.one_of(st.just(""), st.just("   "), name),
    username=st.one_of(st.just(""), st.just("ab"), st.just("has space"), uname, st.text(alphabet="a", min_size=31, max_size=60)),
    mail=st.one_of(st.just(""), st.just("no-at"), email, st.just("a@b")),
    password=st.text(max_size=12),
)
def test_property_2_validation_and_unique_username_and_email(client, full, username, mail, password):
    reset_db()
    valid = bool(full.strip()) and 3 <= len(username) <= 30 and all(ch in string.ascii_letters + string.digits + "_." for ch in username)
    valid = valid and "@" in mail and "." in mail.split("@")[-1] and len(password) >= 8
    r = client.post("/api/auth/register", json={"full_name": full, "username": username, "email": mail, "password": password})
    assert r.status_code == (201 if valid else 400)
    if valid:
        dup = client.post("/api/auth/register", json={"full_name": "x", "username": username.swapcase(), "email": "z-other@x.com", "password": "abcdefgh"})
        assert dup.status_code == 409 and set(dup.get_json()["error"]["details"]) == {"username"}
        dup = client.post("/api/auth/register", json={"full_name": "x", "username": "freshname", "email": mail.upper(), "password": "abcdefgh"})
        assert dup.status_code == 409 and set(dup.get_json()["error"]["details"]) == {"email"}


# ---- Property 6, 7: board seeding and column order ----
@PROP
@given(
    board_name=name,
    # names are unique ignoring case on a board and never `Done` (V17, COL-02, COL-10)
    extra=st.lists(name.filter(lambda n: n.strip().lower() not in {"done", "todo", "in progress", "review", "revision"}), max_size=6, unique_by=lambda n: n.strip().lower()),
)
def test_property_6_7_default_columns_and_append_order(client, board_name, extra):
    env = Env(client)
    b = client.post("/api/boards", headers=env.h["manager"], json={"name": board_name}).get_json()["data"]
    assert [c["name"] for c in b["columns"]] == ["Todo", "In Progress", "Review", "Revision", "Done"]
    assert [c["order"] for c in b["columns"]] == [0, 1, 2, 3, 4]
    last = 4
    for n in extra:
        r = client.post(f"/api/boards/{b['id']}/columns", headers=env.h["manager"], json={"name": n})
        assert r.status_code == 201 and r.get_json()["data"]["order"] == last + 1
        last += 1


# ---- Property 8, 9: soft delete and archive round trip ----
@PROP
@given(flags=st.lists(st.tuples(st.booleans(), st.booleans()), min_size=1, max_size=5))
def test_property_8_9_board_soft_delete_and_archive(client, flags):
    env = Env(client)
    ids = []
    for delete, archive in flags:
        b = client.post("/api/boards", headers=env.h["manager"], json={"name": "x"}).get_json()["data"]
        ids.append((b["id"], delete, archive))
        if archive:
            assert client.post(f"/api/boards/{b['id']}/archive", headers=env.h["manager"]).get_json()["data"]["archived_at"]
            client.post(f"/api/boards/{b['id']}/unarchive", headers=env.h["manager"])
            assert client.get(f"/api/boards/{b['id']}", headers=env.h["manager"]).get_json()["data"]["archived_at"] is None
        if delete:
            client.delete(f"/api/boards/{b['id']}", headers=env.h["manager"])
    for bid, delete, _ in ids:
        row = db.session.get(Board, uuid.UUID(bid))
        assert row is not None and (row.deleted_at is not None) == delete
        assert client.get(f"/api/boards/{bid}", headers=env.h["manager"]).status_code == (404 if delete else 200)


@PROP
@given(card_deleted=st.booleans(), archive=st.booleans())
def test_property_8_9_card_soft_delete_hides_children(client, card_deleted, archive):
    env = Env(client)
    card = env.card()
    sub = client.post(f"/api/cards/{card['id']}/subtasks", headers=env.h["manager"], json={"title": "s"}).get_json()["data"]
    client.post(f"/api/cards/{card['id']}/comments", headers=env.h["manager"], json={"content": "c"})
    if archive:
        client.post(f"/api/cards/{card['id']}/archive", headers=env.h["manager"])
        client.post(f"/api/cards/{card['id']}/unarchive", headers=env.h["manager"])
        assert client.get(f"/api/cards/{card['id']}", headers=env.h["manager"]).get_json()["data"]["archived_at"] is None
    if card_deleted:
        client.delete(f"/api/cards/{card['id']}", headers=env.h["manager"])
        assert client.get(f"/api/cards/{card['id']}", headers=env.h["manager"]).status_code == 404
        assert client.patch(f"/api/subtasks/{sub['id']}", headers=env.h["manager"], json={"is_done": True}).status_code == 404
        assert client.get(f"/api/cards/{card['id']}/comments", headers=env.h["manager"]).status_code == 404
        assert db.session.get(Card, uuid.UUID(card["id"])) is not None
        assert db.session.get(Subtask, uuid.UUID(sub["id"])) is not None
        assert client.get(f"/api/boards/{env.bid}/cards", headers=env.h["manager"]).get_json()["data"] == []


# ---- Property 18, 19: members and owner reassignment ----
@PROP
@given(ops=st.lists(st.tuples(st.sampled_from(["add", "remove"]), st.integers(0, 2)), max_size=10))
def test_property_18_board_member_add_remove(client, ops):
    env = Env(client)
    targets = [env.users["member_other"], env.users["sup_other"], env.users["admin"]]
    model = set()
    for op, i in ops:
        u = targets[i]
        if op == "add":
            r = client.post(f"/api/boards/{env.bid}/members", headers=env.h["manager"], json={"user_id": str(u.id)})
            if u.role not in ("member", "supervisor"):  # Property 52: a Manager or an Admin is never a Board_Member
                assert r.status_code == 400 and "user_id" in r.get_json()["error"]["details"]
                continue
            assert r.status_code == (409 if u.id in model else 201)
            model.add(u.id)
        else:
            r = client.delete(f"/api/boards/{env.bid}/members/{u.id}", headers=env.h["manager"])
            assert r.status_code == (200 if u.id in model else 404)
            model.discard(u.id)
    rows = {m.user_id for m in BoardMember.query.filter_by(board_id=uuid.UUID(env.bid)).all()}
    assert rows - {env.users["member"].id, env.users["sup_member"].id} == model
    assert client.post(f"/api/boards/{env.bid}/members", headers=env.h["manager"], json={"user_id": UUID0}).status_code == 404


@PROP
@given(target=st.sampled_from(["member", "supervisor", "manager", "admin", None]), actor=st.sampled_from(["manager", "admin", "owner", "member"]))
def test_property_19_owner_reassignment(client, target, actor):
    env = Env(client)
    user = None if target is None else mkuser(target)
    body = {"owner_id": None if user is None else str(user.id)}
    r = client.patch(f"/api/boards/{env.bid}", headers=env.h[actor], json=body)
    if actor in ("manager", "admin"):
        ok = target in (None, "supervisor")
        assert r.status_code == (200 if ok else 400)
        if ok:
            assert db.session.get(Board, uuid.UUID(env.bid)).owner_id == (user.id if user else None)
    else:
        assert r.status_code == 403


# ---- Property 10, 11: card validation and edit scope ----
@PROP
@given(
    title=st.one_of(st.just(""), st.just("  "), name, st.text(alphabet="a", min_size=256, max_size=260)),
    priority=st.sampled_from(["high", "medium", "low", "urgent", "", None]),
    start=st.one_of(st.none(), st.dates(date(2020, 1, 1), date(2030, 1, 1))),
    end=st.one_of(st.none(), st.dates(date(2020, 1, 1), date(2030, 1, 1))),
)
def test_property_10_card_field_validation(client, title, priority, start, end):
    env = Env(client)
    body = {"title": title}
    if priority is not None:
        body["priority"] = priority
    if start:
        body["start_date"] = start.isoformat()
    if end:
        body["end_date"] = end.isoformat()
    valid = (
        0 < len(title.strip()) <= 255
        and priority in (None, "high", "medium", "low")
        and not (start and end and end < start)
    )
    r = client.post(f"/api/columns/{env.cols[0]}/cards", headers=env.h["supervisor" if False else "owner"], json=body)
    assert r.status_code == (201 if valid else 400)
    if not valid:
        assert r.get_json()["error"]["code"] == "VALIDATION_ERROR" and Card.query.count() == 0


@PROP
@given(assigned=st.booleans(), field=st.sampled_from(["title", "priority", "description"]))
def test_property_11_member_edit_scope(client, assigned, field):
    env = Env(client)
    card = env.card(assignee_id=env.uid("member") if assigned else None)
    value = {"title": "new", "priority": "low", "description": "d"}[field]
    r = client.patch(f"/api/cards/{card['id']}", headers=env.h["member"], json={field: value})
    assert r.status_code == (200 if assigned and field == "description" else 403)  # V18: description only
    assert client.patch(f"/api/cards/{card['id']}", headers=env.h["member_other"], json={field: value}).status_code == 403
    assert client.patch(f"/api/cards/{card['id']}", headers=env.h["sup_other"], json={field: value}).status_code == 403
    assert client.patch(f"/api/cards/{card['id']}", headers=env.h["owner"], json={field: value}).status_code == 200


# ---- Property 12: assignment ----
@PROP
@given(seq=st.lists(st.sampled_from(["member", "sup_member", None]), min_size=1, max_size=8))
def test_property_12_assignment_effects(client, seq):
    env = Env(client)
    card = env.card()
    cid = uuid.UUID(card["id"])
    current = None
    for who in seq:
        before = ActivityLog.query.filter_by(target_id=cid).count()
        notif_before = Notification.query.count()
        r = client.patch(f"/api/cards/{card['id']}", headers=env.h["manager"], json={"assignee_id": env.uid(who) if who else None})
        assert r.status_code == 200
        added = ActivityLog.query.filter_by(target_id=cid).count() - before
        if who == current:
            assert added == 0
        elif who is None:
            assert added == 1 and Notification.query.count() == notif_before
            assert ActivityLog.query.filter_by(target_id=cid).order_by(ActivityLog.created_at.desc()).first().action in ("card.unassigned",)
        else:
            assert added == 1
            assert Notification.query.filter_by(card_id=cid, type="assigned").count() >= 1
        current = who


def test_property_52_assignee_must_be_owner_or_board_member(client):
    env = Env(client)
    card = env.card()
    for who, status in (("member_other", 400), ("sup_other", 400), ("admin", 400), ("manager", 400), ("owner", 200), ("member", 200)):
        r = client.patch(f"/api/cards/{card['id']}", headers=env.h["manager"], json={"assignee_id": env.uid(who)})
        assert r.status_code == status, who
        if status == 400:
            assert "assignee_id" in r.get_json()["error"]["details"]


def test_property_52_removing_a_member_clears_assignments_without_notification(client):
    env = Env(client)
    card = env.card()
    client.patch(f"/api/cards/{card['id']}", headers=env.h["manager"], json={"assignee_id": env.uid("member")})
    before = Notification.query.count()
    assert client.delete(f"/api/boards/{env.bid}/members/{env.uid('member')}", headers=env.h["manager"]).status_code == 200
    assert Notification.query.count() == before
    got = client.get(f"/api/cards/{card['id']}", headers=env.h["manager"]).get_json()["data"]
    assert got["assignee_id"] is None
    assert ActivityLog.query.filter_by(target_id=uuid.UUID(card["id"]), action="card.unassigned").count() == 1


# ---- Property 13: subtasks ----
@PROP
@given(titles=st.lists(name, min_size=1, max_size=6), toggles=st.lists(st.integers(0, 5), max_size=8), delete=st.integers(0, 5))
def test_property_13_subtasks(client, titles, toggles, delete):
    env = Env(client)
    card = env.card()
    subs = [client.post(f"/api/cards/{card['id']}/subtasks", headers=env.h["manager"], json={"title": t}).get_json()["data"] for t in titles]
    assert all(not s["is_done"] for s in subs)
    state = {s["id"]: False for s in subs}
    for i in toggles:
        s = subs[i % len(subs)]
        state[s["id"]] = not state[s["id"]]
        r = client.patch(f"/api/subtasks/{s['id']}", headers=env.h["manager"], json={"is_done": state[s["id"]]})
        assert r.get_json()["data"]["is_done"] == state[s["id"]]
    gone = subs[delete % len(subs)]
    assert client.delete(f"/api/subtasks/{gone['id']}", headers=env.h["manager"]).status_code == 200
    got = client.get(f"/api/cards/{card['id']}", headers=env.h["manager"]).get_json()["data"]["subtasks"]
    assert {s["id"] for s in got} == set(state) - {gone["id"]}
    assert [s["order"] for s in got] == sorted(s["order"] for s in got)
    assert all(s["is_done"] == state[s["id"]] for s in got)


# ---- Property 14: attachment validity ----
EXT = {".pdf": "application/pdf", ".doc": "application/msword", ".rar": "application/x-rar-compressed"}


@PROP
@given(
    ext=st.sampled_from([".pdf", ".doc", ".rar", ".exe", ".txt", ".png"]),
    mime_ok=st.booleans(),
    link=st.one_of(st.none(), st.sampled_from(["https://e.com/a", "http://e.com", "ftp://x", "javascript:1", ""])),
)
def test_property_14_attachment_validity(client, ext, mime_ok, link):
    env = Env(client)
    card = env.card()
    url = f"/api/cards/{card['id']}/attachments"
    if link is not None:
        r = client.post(url, headers=env.h["manager"], json={"url": link})
        assert r.status_code == (201 if link.startswith(("http://", "https://")) else 400)
        return
    mime = EXT.get(ext, "application/octet-stream") if mime_ok else "text/plain"
    r = client.post(url, headers=env.h["manager"], data={"file": (io.BytesIO(b"x"), f"f{ext}", mime)}, content_type="multipart/form-data")
    assert r.status_code == (201 if ext in EXT and mime_ok else 400)
    assert client.post(url, headers=env.h["manager"], json={}).status_code == 400


# ---- Property 20: signed URL ----
@PROP
@given(
    offset=st.integers(-2000, 2000),
    tamper=st.sampled_from(["none", "sig", "exp", "id"]),
)
def test_property_20_signed_url_validity_and_expiry(offset, tamper):
    secret = "k" * 32
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    path, exp = sign_file_url("att-1", now, secret)
    sig = path.split("sig=")[1]
    att, e, s = "att-1", exp, sig
    if tamper == "sig":
        s = ("0" if sig[0] != "0" else "1") + sig[1:]
    elif tamper == "exp":
        e = exp + 1
    elif tamper == "id":
        att = "att-2"
    expected = tamper == "none" and offset <= 900
    assert verify_file_signature(att, e, s, now + timedelta(seconds=offset), secret) == expected


# ---- Property 17: categories ----
@PROP
@given(names=st.lists(st.text(alphabet="abcABC", min_size=1, max_size=3), min_size=1, max_size=8))
def test_property_17_categories_unique_and_scoped(client, names):
    env = Env(client)
    other = client.post("/api/boards", headers=env.h["manager"], json={"name": "O"}).get_json()["data"]
    seen = set()
    for n in names:
        r = client.post(f"/api/boards/{env.bid}/categories", headers=env.h["owner"], json={"name": n})
        assert r.status_code == (409 if n.lower() in seen else 201)
        seen.add(n.lower())
        assert client.post(f"/api/boards/{other['id']}/categories", headers=env.h["manager"], json={"name": n}).status_code in (201, 409)
    listed = client.get(f"/api/boards/{env.bid}/categories", headers=env.h["member"]).get_json()["data"]
    assert {c["name"].lower() for c in listed} == seen and all(c["board_id"] == env.bid for c in listed)
    victim = listed[0]
    card = env.card(category_id=victim["id"])
    client.delete(f"/api/categories/{victim['id']}", headers=env.h["owner"])
    assert db.session.get(Card, uuid.UUID(card["id"])).category_id is None
    assert Category.query.filter_by(board_id=uuid.UUID(env.bid)).count() == len(seen) - 1
    # staff-only mutations, public-style read
    assert client.post(f"/api/boards/{env.bid}/categories", headers=env.h["member"], json={"name": "zzz"}).status_code == 403
