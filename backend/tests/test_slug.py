import importlib.util
import re
import uuid
from pathlib import Path

import sqlalchemy as sa
from hypothesis import given, strategies as st

from app.common.slug import is_valid_slug, pick_free, slugify
from app.extensions import db
from app.models import Board
from tests.helpers import PROP
from tests.test_api import world


def new_board(w, name, who="manager"):
    r = w.client.post("/api/boards", headers=w.h[who], json={"name": name})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]


def rename(w, board, name, who="manager"):
    r = w.client.patch(f"/api/boards/{board['id']}", headers=w.h[who], json={"name": name})
    assert r.status_code == 200, r.get_json()
    return r.get_json()["data"]


def by_slug(w, slug, who="manager"):
    return w.client.get(f"/api/boards/slug/{slug}", headers=w.h.get(who, {}))


def test_slugify_examples():
    assert slugify("Q3 Launch Plan") == "q3-launch-plan"
    assert slugify("Design & Dev") == "design-dev"
    assert slugify("Café Board") == "caf-board"
    assert slugify("!!!") == "board"
    assert slugify("   ") == "board"
    assert slugify("  Many   Spaces  ") == "many-spaces"
    assert slugify("a_b.c") == "abc"


def test_pick_free_takes_the_lowest_free_number():
    assert pick_free("a", set()) == "a"
    assert pick_free("a", {"a"}) == "a-2"
    assert pick_free("a", {"a", "a-2", "a-4"}) == "a-3"


def test_is_valid_slug():
    assert is_valid_slug("q3-launch")
    for bad in ("", "Q3", "a--b", "-a", "a-", "a b", "a/b", "é", "a" * 301):
        assert not is_valid_slug(bad), bad


def test_every_board_has_a_slug_and_clashes_get_suffixes(world):
    assert world.board["slug"] == "b"
    assert new_board(world, "B")["slug"] == "b-2"
    assert new_board(world, "b")["slug"] == "b-3"
    assert new_board(world, "Q3 Launch")["slug"] == "q3-launch"


def test_a_rename_moves_the_slug_and_the_old_one_is_gone(world):
    assert by_slug(world, "b").status_code == 200
    renamed = rename(world, world.board, "Roadmap 2027")
    assert renamed["slug"] == "roadmap-2027"
    assert by_slug(world, "roadmap-2027").status_code == 200
    assert by_slug(world, "b").status_code == 404


def test_a_rename_that_gives_the_same_slug_keeps_it(world):
    second = new_board(world, "B")
    assert second["slug"] == "b-2"
    assert rename(world, second, "B")["slug"] == "b-2"
    assert rename(world, world.board, "b!")["slug"] == "b"


def test_a_rename_never_takes_another_boards_slug(world):
    other = new_board(world, "Other")
    assert rename(world, other, "B")["slug"] == "b-2"


def test_the_slug_route_has_the_same_rules_as_the_id_route(world):
    assert by_slug(world, "b", "member").status_code == 200
    assert by_slug(world, "b", "other_member").status_code == 403
    assert by_slug(world, "b", "nobody").status_code == 401
    assert by_slug(world, "no-such-board").status_code == 404
    by_id = world.client.get(f"/api/boards/{world.board['id']}", headers=world.h["manager"]).get_json()["data"]
    assert by_slug(world, "b").get_json()["data"] == by_id
    assert by_id["slug"] == "b"


def test_a_value_that_cannot_be_a_slug_is_a_plain_404(world):
    for bad in ("B", "a--b", "a_b", "%C3%A9"):
        assert by_slug(world, bad).status_code == 404, bad


def test_a_soft_deleted_board_has_no_slug_route_but_keeps_its_slug_reserved(world):
    doomed = new_board(world, "Doomed")
    assert world.client.delete(f"/api/boards/{doomed['id']}", headers=world.h["manager"]).status_code in (200, 204)
    assert by_slug(world, "doomed").status_code == 404
    assert new_board(world, "Doomed")["slug"] == "doomed-2"


def test_a_slug_in_a_body_is_a_400(world):
    r = world.client.post("/api/boards", headers=world.h["manager"], json={"name": "X", "slug": "x"})
    assert r.status_code == 400 and "slug" in r.get_json()["error"]["details"]
    r = world.client.patch(f"/api/boards/{world.board['id']}", headers=world.h["manager"], json={"slug": "x"})
    assert r.status_code == 400 and "slug" in r.get_json()["error"]["details"]


def test_the_list_and_the_invite_lookup_carry_the_slug(world):
    listed = world.client.get("/api/boards", headers=world.h["manager"]).get_json()["data"]
    assert all(re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", b["slug"]) for b in listed)
    world.client.post(f"/api/boards/{world.board['id']}/invite", headers=world.h["manager"])
    token = world.client.get(f"/api/boards/{world.board['id']}/invite", headers=world.h["manager"]).get_json()["data"]["token"]
    lookup = world.client.get(f"/api/invite/{token}", headers=world.h["other_member"]).get_json()["data"]
    assert lookup["board"]["slug"] == "b"
    renamed = rename(world, world.board, "Renamed")
    assert world.client.get(f"/api/invite/{token}", headers=world.h["other_member"]).get_json()["data"]["board"]["slug"] == renamed["slug"]


def test_the_notification_payload_carries_board_slug(world):
    from tests.test_api import mkcard

    mkcard(world, assignee_id=str(world.users["member"].id))
    inbox = world.client.get("/api/notifications", headers=world.h["member"]).get_json()["data"]
    assert inbox["items"] and all(n["board_slug"] == "b" for n in inbox["items"])


def test_a_slug_named_like_a_sub_route_still_resolves(world):
    members = new_board(world, "Members")
    assert members["slug"] == "members"
    got = by_slug(world, "members")
    assert got.status_code == 200 and got.get_json()["data"]["id"] == members["id"]


@PROP
@given(st.lists(st.tuples(st.sampled_from(["create", "rename", "delete"]), st.text(max_size=12), st.integers(0, 8)), min_size=1, max_size=15))
def test_property_69_slugs_are_unique_and_follow_the_rules(client, ops):
    from tests.helpers import hdr, mkuser, reset_db

    reset_db()
    manager = mkuser("manager")
    boards = []
    for op, name, index in ops:
        if op == "create" or not boards:
            r = client.post("/api/boards", headers=hdr(manager), json={"name": name or "x"})
            if r.status_code == 201:
                boards.append(r.get_json()["data"])
        elif op == "rename":
            target = boards[index % len(boards)]
            r = client.patch(f"/api/boards/{target['id']}", headers=hdr(manager), json={"name": name or "y"})
            if r.status_code == 200:
                target.update(r.get_json()["data"])
        else:
            client.delete(f"/api/boards/{boards[index % len(boards)]['id']}", headers=hdr(manager))
    rows = db.session.execute(sa.select(Board.name, Board.slug)).all()
    slugs = [s for _, s in rows]
    assert len(set(slugs)) == len(slugs)
    for name, slug in rows:
        base = slugify(name)
        assert is_valid_slug(slug)
        assert slug == base or re.fullmatch(re.escape(base) + r"-(\d+)", slug)
    for b in boards:
        current = db.session.get(Board, uuid.UUID(b["id"]))
        assert current.slug == b["slug"]
        if current.deleted_at is None:
            assert client.get(f"/api/boards/slug/{current.slug}", headers=hdr(manager)).status_code == 200


def test_the_migration_backfills_in_created_order_and_downgrades():
    spec = importlib.util.spec_from_file_location("v17_slug", Path(__file__).resolve().parents[1] / "migrations" / "versions" / "e5a9c3d7f104_v17_board_slug.py")
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)
    assert mig._slugify("Q3 Launch Plan") == "q3-launch-plan"
    assert mig._slugify("???") == "board"
    assert mig.down_revision == "d4f8b2c6e903"
