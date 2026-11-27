import uuid

from hypothesis import given, strategies as st

from app.extensions import db
from app.models import Card, Column
from tests.helpers import PROP, hdr, mkuser, reset_db
from tests.test_api import col, mkcard, world


def cols(w, who="manager"):
    return w.client.get(f"/api/boards/{w.board['id']}", headers=w.h[who]).get_json()["data"]["columns"]


def add(w, name, who="manager"):
    return w.client.post(f"/api/boards/{w.board['id']}/columns", headers=w.h[who], json={"name": name})


def code(r):
    return r.get_json()["error"]["code"]


def done_id(w):
    return next(c["id"] for c in cols(w) if c["name"] == "Done")


def test_the_owner_a_manager_and_an_admin_manage_columns(world):
    for who in ("supervisor", "manager", "admin"):
        assert add(world, f"Col {who}", who).status_code == 201, who


def test_nobody_else_manages_columns(world):
    for who in ("member", "other_sup", "other_member"):
        assert add(world, "X", who).status_code == 403, who
    assert world.client.post(f"/api/boards/{world.board['id']}/columns", json={"name": "X"}).status_code == 401
    target = col(world, 0)
    for who in ("member", "other_sup"):
        assert world.client.patch(f"/api/columns/{target}", headers=world.h[who], json={"name": "Y"}).status_code == 403
        assert world.client.patch(f"/api/columns/{target}/move", headers=world.h[who], json={"position": 1}).status_code == 403
        assert world.client.delete(f"/api/columns/{target}", headers=world.h[who]).status_code == 403
    assert world.client.delete(f"/api/columns/{target}").status_code == 401


def test_a_supervisor_who_is_only_a_member_cannot_manage_columns(world):
    world.client.post(f"/api/boards/{world.board['id']}/members", headers=world.h["manager"], json={"user_id": str(world.users["other_sup"].id)})
    assert add(world, "X", "other_sup").status_code == 403


def test_names_are_trimmed_unique_ignoring_case_and_never_done(world):
    created = add(world, "  QA  ")
    assert created.status_code == 201 and created.get_json()["data"]["name"] == "QA"
    dup = add(world, "qa")
    assert dup.status_code == 409 and code(dup) == "CONFLICT" and "name" in dup.get_json()["error"]["details"]
    for name in ("Done", "done", " DONE "):
        r = add(world, name)
        assert r.status_code == 409 and code(r) == "COLUMN_LOCKED", name
    assert add(world, "   ").status_code == 400


def test_rename_and_the_locked_done_column(world):
    todo = col(world, 0)
    ok = world.client.patch(f"/api/columns/{todo}", headers=world.h["supervisor"], json={"name": "Backlog"})
    assert ok.status_code == 200 and ok.get_json()["data"]["name"] == "Backlog"
    assert world.client.patch(f"/api/columns/{col(world, 1)}", headers=world.h["supervisor"], json={"name": "backlog"}).status_code == 409
    r = world.client.patch(f"/api/columns/{done_id(world)}", headers=world.h["manager"], json={"name": "Finished"})
    assert r.status_code == 409 and code(r) == "COLUMN_LOCKED"
    r = world.client.patch(f"/api/columns/{todo}", headers=world.h["manager"], json={"name": "done"})
    assert r.status_code == 409 and code(r) == "COLUMN_LOCKED"
    assert world.client.patch(f"/api/columns/{uuid.uuid4()}", headers=world.h["manager"], json={"name": "X"}).status_code == 404


def test_move_renumbers_without_gaps_and_done_may_move(world):
    first = col(world, 0)
    r = world.client.patch(f"/api/columns/{first}/move", headers=world.h["supervisor"], json={"position": 4})
    assert r.status_code == 200
    now = cols(world)
    assert [c["order"] for c in now] == [0.0, 1.0, 2.0, 3.0, 4.0]
    assert now[-1]["id"] == first
    r = world.client.patch(f"/api/columns/{done_id(world)}/move", headers=world.h["manager"], json={"position": 0})
    assert r.status_code == 200 and cols(world)[0]["name"] == "Done"


def test_move_rejects_a_position_out_of_range(world):
    for position in (-1, 5, 99, "1", 1.5, None):
        r = world.client.patch(f"/api/columns/{col(world, 0)}/move", headers=world.h["manager"], json={"position": position})
        assert r.status_code == 400, position


def test_a_column_with_active_cards_is_not_deleted(world):
    mkcard(world, i=0)
    mkcard(world, title="two", i=0)
    r = world.client.delete(f"/api/columns/{col(world, 0)}", headers=world.h["supervisor"])
    assert r.status_code == 409 and code(r) == "COLUMN_NOT_EMPTY"
    assert r.get_json()["error"]["details"] == {"count": 2}
    assert "2 cards" in r.get_json()["message"]
    assert len(cols(world)) == 5


def test_an_empty_column_is_deleted_and_logged(world):
    made = add(world, "Temp").get_json()["data"]
    r = world.client.delete(f"/api/columns/{made['id']}", headers=world.h["supervisor"])
    assert r.status_code == 200
    assert made["id"] not in [c["id"] for c in cols(world)]
    log = world.client.get(f"/api/boards/{world.board['id']}/activity", headers=world.h["manager"]).get_json()["data"]
    assert "column.deleted" in [e["action"] if "action" in e else e.get("type") for e in log]


def test_archived_and_soft_deleted_cards_do_not_block_a_delete(world):
    mkcard(world, i=1)
    one = mkcard(world, title="gone", i=1)
    two = mkcard(world, title="old", i=1)
    world.client.delete(f"/api/cards/{one['id']}", headers=world.h["manager"])
    world.client.post(f"/api/cards/{two['id']}/archive", headers=world.h["manager"])
    live = world.client.get(f"/api/boards/{world.board['id']}/cards", headers=world.h["manager"]).get_json()["data"]
    mover = next(c for c in live if c["title"] == "t")
    world.client.patch(f"/api/cards/{mover['id']}/move", headers=world.h["manager"], json={"column_id": col(world, 0)})
    r = world.client.delete(f"/api/columns/{col(world, 1)}", headers=world.h["manager"])
    assert r.status_code == 200
    detached = db.session.get(Card, uuid.UUID(one["id"]))
    assert detached.column_id is None and detached.board_id is not None
    assert db.session.get(Card, uuid.UUID(two["id"])).archived_at is not None


def test_the_done_column_is_not_deleted(world):
    r = world.client.delete(f"/api/columns/{done_id(world)}", headers=world.h["manager"])
    assert r.status_code == 409 and code(r) == "COLUMN_LOCKED"


def test_archiving_takes_the_card_out_of_its_column_and_keeps_its_board(world):
    card = mkcard(world, i=2)
    r = world.client.post(f"/api/cards/{card['id']}/archive", headers=world.h["supervisor"])
    assert r.status_code == 200
    data = r.get_json()["data"]
    assert data["column_id"] is None and data["archived_at"]
    row = db.session.get(Card, uuid.UUID(card["id"]))
    assert row.column_id is None and str(row.board_id) == world.board["id"]


def test_the_default_list_hides_archived_cards_and_archived_true_lists_only_them(world):
    keep = mkcard(world, title="keep")
    gone = mkcard(world, title="gone")
    world.client.post(f"/api/cards/{gone['id']}/archive", headers=world.h["manager"])
    url = f"/api/boards/{world.board['id']}/cards"
    live = world.client.get(url, headers=world.h["manager"]).get_json()["data"]
    arch = world.client.get(url, headers=world.h["manager"], query_string={"archived": "true"}).get_json()["data"]
    assert [c["id"] for c in live] == [keep["id"]]
    assert [c["id"] for c in arch] == [gone["id"]]
    assert world.client.get(url, headers=world.h["manager"], query_string={"archived": "maybe"}).status_code == 400
    listed = world.client.get("/api/boards", headers=world.h["manager"]).get_json()["data"]
    assert next(b for b in listed if b["id"] == world.board["id"])["card_count"] == 1


def test_an_archived_card_cannot_be_moved(world):
    card = mkcard(world)
    world.client.post(f"/api/cards/{card['id']}/archive", headers=world.h["manager"])
    r = world.client.patch(f"/api/cards/{card['id']}/move", headers=world.h["manager"], json={"column_id": col(world, 1)})
    assert r.status_code == 409 and code(r) == "CARD_ARCHIVED"


def test_a_card_in_done_cannot_be_archived(world):
    card = mkcard(world, i=4)
    r = world.client.post(f"/api/cards/{card['id']}/archive", headers=world.h["manager"])
    assert r.status_code == 409 and code(r) == "CARD_IN_DONE"
    assert db.session.get(Card, uuid.UUID(card["id"])).archived_at is None


def test_restore_returns_the_card_to_the_first_column_at_the_end(world):
    first = mkcard(world, title="first", i=0)
    card = mkcard(world, title="back", i=2)
    world.client.post(f"/api/cards/{card['id']}/archive", headers=world.h["manager"])
    r = world.client.post(f"/api/cards/{card['id']}/unarchive", headers=world.h["supervisor"])
    assert r.status_code == 200
    data = r.get_json()["data"]
    assert data["column_id"] == col(world, 0) and data["archived_at"] is None and data["order"] > first["order"]
    again = world.client.post(f"/api/cards/{card['id']}/unarchive", headers=world.h["manager"])
    assert again.status_code == 409 and code(again) == "CARD_NOT_ARCHIVED"


def test_restore_follows_the_first_column_after_a_reorder(world):
    card = mkcard(world, i=1)
    world.client.post(f"/api/cards/{card['id']}/archive", headers=world.h["manager"])
    world.client.patch(f"/api/columns/{col(world, 3)}/move", headers=world.h["manager"], json={"position": 0})
    data = world.client.post(f"/api/cards/{card['id']}/unarchive", headers=world.h["manager"]).get_json()["data"]
    assert data["column_id"] == col(world, 3)


def test_archived_cards_are_outside_analytics_and_the_default_views(world):
    keep = mkcard(world, title="a")
    gone = mkcard(world, title="b", i=1)
    world.client.post(f"/api/cards/{gone['id']}/archive", headers=world.h["manager"])
    stats = world.client.get(f"/api/boards/{world.board['id']}/analytics", headers=world.h["manager"]).get_json()["data"]
    assert stats["total"] == 1
    assert keep["id"]


@PROP
@given(st.lists(st.tuples(st.sampled_from(["create", "rename", "move", "delete", "card", "archive", "restore"]), st.integers(0, 6), st.text(max_size=6)), min_size=1, max_size=18))
def test_properties_70_to_72_columns_and_archived_cards(client, ops):
    reset_db()
    manager = mkuser("manager")
    h = hdr(manager)
    board = client.post("/api/boards", headers=h, json={"name": "P"}).get_json()["data"]
    cards = []
    for op, n, text in ops:
        columns = client.get(f"/api/boards/{board['id']}", headers=h).get_json()["data"]["columns"]
        target = columns[n % len(columns)]
        if op == "create":
            r = client.post(f"/api/boards/{board['id']}/columns", headers=h, json={"name": text or "x"})
            assert r.status_code in (201, 400, 409)
            assert r.status_code != 201 or r.get_json()["data"]["name"].lower() != "done"
        elif op == "rename":
            r = client.patch(f"/api/columns/{target['id']}", headers=h, json={"name": text or "y"})
            if target["name"] == "Done" or (text or "y").strip().lower() == "done":
                assert r.status_code in (400, 409) and (r.status_code == 400 or r.get_json()["error"]["code"] == "COLUMN_LOCKED")
        elif op == "move":
            client.patch(f"/api/columns/{target['id']}/move", headers=h, json={"position": n % len(columns)})
        elif op == "delete":
            live = Card.query.filter(Card.column_id == uuid.UUID(target["id"]), Card.deleted_at.is_(None), Card.archived_at.is_(None)).count()
            r = client.delete(f"/api/columns/{target['id']}", headers=h)
            if target["name"] == "Done":
                assert r.status_code == 409 and r.get_json()["error"]["code"] == "COLUMN_LOCKED"
            elif live:
                assert r.status_code == 409 and r.get_json()["error"]["details"] == {"count": live}
            else:
                assert r.status_code == 200
        elif op == "card":
            r = client.post(f"/api/columns/{target['id']}/cards", headers=h, json={"title": "c"})
            if r.status_code == 201:
                cards.append(r.get_json()["data"]["id"])
        elif cards:
            cid = cards[n % len(cards)]
            row = db.session.get(Card, uuid.UUID(cid))
            if op == "archive":
                was_done = row.column_id is not None and db.session.get(Column, row.column_id).name == "Done"
                r = client.post(f"/api/cards/{cid}/archive", headers=h)
                assert (r.status_code == 409) == (was_done and row.archived_at is None) or row.archived_at is not None
            else:
                client.post(f"/api/cards/{cid}/unarchive", headers=h)
    db.session.expire_all()
    names = [c.name for c in Column.query.all()]
    assert names.count("Done") == 1 and [n for n in names if n.lower() == "done"] == ["Done"]
    for card in Card.query.filter(Card.deleted_at.is_(None)).all():
        assert (card.archived_at is None) == (card.column_id is not None)
        assert card.board_id is not None
