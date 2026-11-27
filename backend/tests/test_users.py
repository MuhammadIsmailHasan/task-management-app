import uuid

from conftest import TEST_PASSWORD
from hypothesis import given, strategies as st

from app.extensions import db
from app.models import Card, User
from tests.helpers import PROP, hdr, mkuser, reset_db
from tests.test_api import col, mkcard, world


def patch(w, user, who="admin", **body):
    return w.client.patch(f"/api/users/{user.id}", headers=w.h[who], json=body)


def code(r):
    return r.get_json()["error"]["code"]


def test_the_user_list_carries_both_flags_and_no_pending_email(world):
    rows = world.client.get("/api/users", headers=world.h["admin"]).get_json()["data"]["items"]
    assert all(r["is_active"] is True and r["is_available"] is True for r in rows)
    assert "pending_email" not in str(rows)


def test_there_is_no_user_delete(world):
    r = world.client.delete(f"/api/users/{world.users['member'].id}", headers=world.h["admin"])
    assert r.status_code == 405


def test_only_an_admin_sets_the_flags(world):
    member = world.users["member"]
    for who in ("member", "supervisor", "manager"):
        assert patch(world, member, who, is_active=False).status_code == 403
        assert patch(world, member, who, is_available=False).status_code == 403
    r = patch(world, member, is_available=False)
    assert r.status_code == 200 and r.get_json()["data"]["is_available"] is False


def test_an_idle_user_can_be_deactivated_and_reactivated(world):
    other = world.users["other_member"]
    off = patch(world, other, is_active=False)
    assert off.status_code == 200 and off.get_json()["data"]["is_active"] is False
    on = patch(world, other, is_active=True)
    assert on.status_code == 200 and on.get_json()["data"]["is_active"] is True


def test_open_assigned_cards_block_and_the_answer_lists_them(world):
    member = world.users["member"]
    mkcard(world, title="Mine", assignee_id=str(member.id))
    r = patch(world, member, is_active=False)
    assert r.status_code == 409 and code(r) == "USER_HAS_OPEN_WORK"
    details = r.get_json()["error"]["details"]
    assert details["cards_total"] == 1 and details["boards_total"] == 0
    assert details["cards"] == [{"id": details["cards"][0]["id"], "title": "Mine", "board_id": world.board["id"], "board_slug": "b", "board_name": "B"}]
    assert db.session.get(User, member.id).is_active is True


def test_an_owned_board_with_open_cards_blocks_whoever_the_assignee_is(world):
    mkcard(world, title="Someone else's")
    r = patch(world, world.users["supervisor"], is_active=False)
    assert r.status_code == 409 and code(r) == "USER_HAS_OPEN_WORK"
    details = r.get_json()["error"]["details"]
    assert details["boards_total"] == 1 and details["boards"][0]["open_card_count"] == 1 and details["boards"][0]["slug"] == "b"


def test_done_archived_and_deleted_cards_do_not_block(world):
    member = world.users["member"]
    done = mkcard(world, title="done", i=4, assignee_id=str(member.id))
    gone = mkcard(world, title="gone", assignee_id=str(member.id))
    old = mkcard(world, title="old", assignee_id=str(member.id))
    world.client.delete(f"/api/cards/{gone['id']}", headers=world.h["manager"])
    world.client.post(f"/api/cards/{old['id']}/archive", headers=world.h["manager"])
    assert patch(world, member, is_active=False).status_code == 200
    card = world.client.get(f"/api/cards/{done['id']}", headers=world.h["manager"]).get_json()["data"]
    assert card["assignee_id"] == str(member.id) and card["assignee_is_active"] is False and card["assignee_is_available"] is True


def test_an_admin_cannot_deactivate_themselves(world):
    r = patch(world, world.users["admin"], is_active=False)
    assert r.status_code == 409 and code(r) == "CANNOT_DEACTIVATE_SELF"


def test_lists_are_capped_at_fifty_with_exact_totals(world):
    member = world.users["member"]
    for n in range(53):
        mkcard(world, title=f"c{n:02d}", assignee_id=str(member.id))
    details = patch(world, member, is_active=False).get_json()["error"]["details"]
    assert details["cards_total"] == 53 and len(details["cards"]) == 50


def test_a_deactivated_users_token_stops_working_at_once(world):
    other = world.users["other_member"]
    assert world.client.get("/api/boards", headers=world.h["other_member"]).status_code == 200
    patch(world, other, is_active=False)
    r = world.client.get("/api/boards", headers=world.h["other_member"])
    assert r.status_code == 403 and code(r) == "ACCOUNT_DISABLED" and r.get_json()["message"] == "This account is disabled"
    assert world.client.get("/api/auth/me", headers=world.h["other_member"]).status_code == 403


def test_a_disabled_user_cannot_sign_in_and_a_wrong_password_stays_a_401(world, make_user):
    other = make_user("member", "idle")
    patch(world, other, is_active=False)
    right = world.client.post("/api/auth/login", json={"identifier": "idle", "password": TEST_PASSWORD})
    assert right.status_code == 403 and code(right) == "ACCOUNT_DISABLED"
    assert world.client.post("/api/auth/login", json={"identifier": "idle", "password": "wrong"}).status_code == 401


def test_an_admin_made_user_is_verified_and_signs_in(world):
    r = world.client.post("/api/users", headers=world.h["admin"], json={"full_name": "Made", "username": "made", "email": "made@x.com", "password": TEST_PASSWORD})
    assert r.status_code == 201
    assert world.client.post("/api/auth/login", json={"identifier": "made", "password": TEST_PASSWORD}).status_code == 200


def test_pickers_list_only_active_and_available_people(world):
    other = world.users["other_member"]
    url = f"/api/boards/{world.board['id']}/candidates"
    found = lambda: {u["id"] for u in world.client.get(url, headers=world.h["manager"], query_string={"search": "member"}).get_json()["data"]}
    assert str(other.id) in found()
    patch(world, other, is_available=False)
    assert str(other.id) not in found()
    patch(world, other, is_available=True)
    patch(world, other, is_active=False)
    assert str(other.id) not in found()


def test_the_assignee_picker_and_the_members_list(world):
    member = world.users["member"]
    url = f"/api/boards/{world.board['id']}/members"
    assignable = lambda: {m["id"] for m in world.client.get(url, headers=world.h["manager"], query_string={"assignable": "true"}).get_json()["data"]}
    assert str(member.id) in assignable()
    patch(world, member, is_available=False)
    assert str(member.id) not in assignable()
    everyone = world.client.get(url, headers=world.h["manager"]).get_json()["data"]
    row = next(m for m in everyone if m["id"] == str(member.id))
    assert row["is_available"] is False and row["is_active"] is True


def test_an_assignment_or_direct_add_of_an_unavailable_user_is_a_400(world):
    member = world.users["member"]
    card = mkcard(world)
    patch(world, member, is_available=False)
    r = world.client.patch(f"/api/cards/{card['id']}", headers=world.h["supervisor"], json={"assignee_id": str(member.id)})
    assert r.status_code == 400 and "assignee_id" in r.get_json()["error"]["details"]
    other = world.users["other_member"]
    patch(world, other, is_available=False)
    r = world.client.post(f"/api/boards/{world.board['id']}/members", headers=world.h["manager"], json={"user_id": str(other.id)})
    assert r.status_code == 400 and "user_id" in r.get_json()["error"]["details"]


def test_a_current_assignee_who_became_unavailable_keeps_the_card_and_can_be_saved_again(world):
    member = world.users["member"]
    card = mkcard(world, assignee_id=str(member.id))
    patch(world, member, is_available=False)
    again = world.client.patch(f"/api/cards/{card['id']}", headers=world.h["supervisor"], json={"assignee_id": str(member.id), "title": "kept"})
    assert again.status_code == 200
    assert again.get_json()["data"]["assignee_is_available"] is False


@PROP
@given(st.lists(st.tuples(st.booleans(), st.booleans()), min_size=1, max_size=6))
def test_property_73_pickers_list_assignable_people_only(client, flags):
    reset_db()
    manager = mkuser("manager")
    board = client.post("/api/boards", headers=hdr(manager), json={"name": "P"}).get_json()["data"]
    people = []
    for active, available in flags:
        u = mkuser("member")
        u.full_name, u.is_active, u.is_available = "Pickable Person", active, available
        db.session.commit()
        people.append(u)
    got = {c["id"] for c in client.get(f"/api/boards/{board['id']}/candidates", headers=hdr(manager), query_string={"search": "pickable"}).get_json()["data"]}
    assert got == {str(u.id) for u in people if u.is_active and u.is_available}


@PROP
@given(st.lists(st.tuples(st.sampled_from(["todo", "done", "archived", "deleted"]), st.booleans()), max_size=5), st.booleans())
def test_property_74_open_work_blocks_deactivation(client, cards, owns_board):
    reset_db()
    admin, manager, target = mkuser("admin"), mkuser("manager"), mkuser("supervisor")
    board = client.post("/api/boards", headers=hdr(manager), json={"name": "P"}).get_json()["data"]
    if owns_board:
        client.patch(f"/api/boards/{board['id']}", headers=hdr(manager), json={"owner_id": str(target.id)})
    else:
        client.patch(f"/api/boards/{board['id']}", headers=hdr(manager), json={"owner_id": str(mkuser("supervisor").id)})
    columns = {c["name"]: c["id"] for c in board["columns"]}
    expected_open = False
    for state, mine in cards:
        column = columns["Done"] if state == "done" else columns["Todo"]
        made = client.post(f"/api/columns/{column}/cards", headers=hdr(manager), json={"title": "x"}).get_json()["data"]
        if mine:
            db.session.get(Card, uuid.UUID(made["id"])).assignee_id = target.id
            db.session.commit()
        if state == "archived":
            client.post(f"/api/cards/{made['id']}/archive", headers=hdr(manager))
        elif state == "deleted":
            client.delete(f"/api/cards/{made['id']}", headers=hdr(manager))
        elif state == "todo":
            expected_open = expected_open or mine or owns_board
    r = client.patch(f"/api/users/{target.id}", headers=hdr(admin), json={"is_active": False})
    assert (r.status_code == 409) == expected_open
    db.session.expire_all()
    assert db.session.get(User, target.id).is_active == expected_open
