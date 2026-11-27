from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import OperationalError

from app.blueprints.categories import service as categories
from app.blueprints.columns import service as columns
from app.blueprints.health import service as health
from app.blueprints.notifications import service as notifications
from app.common.errors import ColumnLocked, ColumnNotEmpty, Conflict, Forbidden, NotFound, ServiceUnavailable, Unauthorized, ValidationError
from tests.unit.support import actor, new_id, row


def test_health_reports_ok_and_turns_a_database_error_into_503(stub):
    repo = stub(health, "repo")
    assert health.check() == {"database": "ok"}
    repo.ping.side_effect = OperationalError("SELECT 1", {}, Exception("host=db user=app"))
    with pytest.raises(ServiceUnavailable):
        health.check()


@pytest.fixture
def cats(stub, session):
    board = row(id=new_id())
    boards = stub(categories, "boards")
    boards.load_board.return_value = board
    return row(repo=stub(categories, "repo"), boards=boards, boards_repo=stub(categories, "boards_repo"), board=board, session=session)


def test_category_serialize_and_list(cats):
    c = row(id=new_id(), board_id=cats.board.id, name="bug", color="red")
    assert categories.serialize(c) == {"id": str(c.id), "board_id": str(cats.board.id), "name": "bug", "color": "red"}
    cats.repo.list_for_board.return_value = [c]
    assert categories.list_categories(actor(), cats.board.id) == [c]


def test_create_category_trims_the_name_checks_staff_and_refuses_a_duplicate(cats):
    cats.repo.find_by_name.return_value = None
    who = actor("manager")
    categories.create(who, cats.board.id, {"name": "  bug ", "color": "red"})
    cats.boards.require_staff.assert_called_once_with(who, cats.board)
    cats.repo.add.assert_called_once_with(cats.board.id, "bug", "red")
    cats.session.commit.assert_called_once()
    cats.repo.find_by_name.return_value = row()
    with pytest.raises(Conflict):
        categories.create(who, cats.board.id, {"name": "bug"})


@pytest.mark.parametrize("name", [None, "   ", "x" * 256])
def test_category_name_rules(cats, name):
    with pytest.raises(ValidationError):
        categories.create(actor("manager"), cats.board.id, {"name": name})


def test_update_and_delete_category(cats):
    cat = row(id=new_id(), board_id=cats.board.id, name="bug", color="red")
    cats.repo.get.return_value = cat
    cats.repo.find_by_name.return_value = None
    who = actor("manager")
    assert categories.update(who, str(cat.id), {"name": "defect", "color": "blue"}) is cat
    assert (cat.name, cat.color) == ("defect", "blue")
    cats.repo.find_by_name.return_value = row()
    with pytest.raises(Conflict):
        categories.update(who, str(cat.id), {"name": "taken"})
    categories.delete(who, str(cat.id))
    cats.repo.delete.assert_called_once_with(cat)
    cats.repo.get.return_value = None
    with pytest.raises(NotFound):
        categories.delete(who, "not-a-uuid")
    with pytest.raises(NotFound):
        categories.delete(who, str(new_id()))


@pytest.fixture
def cols(stub, session):
    board = row(id=new_id(), owner_id=None, updated_at=None)
    boards = stub(columns, "boards")
    boards.PRIVILEGED = ("manager", "admin")
    boards.load_board.return_value = board
    boards.is_owner.return_value = False
    boards_repo = stub(columns, "boards_repo")
    boards_repo.get_by_id.return_value = board
    stub(columns, "activity")
    return row(repo=stub(columns, "repo"), boards=boards, boards_repo=boards_repo, board=board, session=session)


def column(board, name, order=0.0):
    return row(id=new_id(), board_id=board.id, name=name, order=order)


def test_only_owner_manager_or_admin_manage_columns(cols):
    with pytest.raises(Unauthorized):
        columns._manager(None, cols.board)
    with pytest.raises(Forbidden):
        columns._manager(actor("supervisor"), cols.board)
    cols.boards.is_owner.return_value = True
    columns._manager(actor("supervisor"), cols.board)
    columns._manager(actor("admin"), cols.board)


def test_create_column_appends_after_the_last_and_refuses_done_or_a_duplicate(cols):
    cols.repo.siblings.return_value = [column(cols.board, "Todo")]
    cols.boards_repo.max_column_order.return_value = 4.0
    columns.create(actor("manager"), cols.board.id, {"name": "QA"})
    cols.boards_repo.add_column.assert_called_once_with(cols.board.id, "QA", 5.0)
    cols.boards_repo.max_column_order.return_value = None
    columns.create(actor("manager"), cols.board.id, {"name": "First"})
    assert cols.boards_repo.add_column.call_args.args[2] == 0.0
    with pytest.raises(ColumnLocked):
        columns.create(actor("manager"), cols.board.id, {"name": " done "})
    with pytest.raises(Conflict):
        columns.create(actor("manager"), cols.board.id, {"name": "todo"})


def test_rename_column(cols):
    todo = column(cols.board, "Todo")
    cols.repo.get.return_value = todo
    cols.repo.siblings.return_value = [todo]
    columns.rename(actor("admin"), str(todo.id), {"name": "Backlog"})
    assert todo.name == "Backlog" and cols.board.updated_at is not None
    cols.repo.get.return_value = column(cols.board, "Done")
    with pytest.raises(ColumnLocked):
        columns.rename(actor("admin"), str(todo.id), {"name": "Finished"})
    cols.repo.get.return_value = None
    with pytest.raises(NotFound):
        columns.rename(actor("admin"), str(todo.id), {"name": "x"})


def test_move_column_renumbers_every_column(cols):
    a, b, c = (column(cols.board, n, float(i)) for i, n in enumerate(("A", "B", "C")))
    cols.repo.get.return_value = c
    cols.repo.siblings.return_value = [a, b, c]
    columns.move(actor("manager"), str(c.id), {"position": 0})
    assert [(x.name, x.order) for x in sorted((a, b, c), key=lambda x: x.order)] == [("C", 0.0), ("A", 1.0), ("B", 2.0)]
    for bad in (3, -1, True, "1"):
        with pytest.raises(ValidationError):
            columns.move(actor("manager"), str(c.id), {"position": bad})


def test_delete_column(cols):
    todo = column(cols.board, "Todo")
    cols.repo.get.return_value = todo
    cols.repo.active_card_count.return_value = 2
    with pytest.raises(ColumnNotEmpty) as err:
        columns.delete(actor("manager"), str(todo.id))
    assert err.value.details == {"count": 2} and "2 cards" in err.value.message
    cols.repo.active_card_count.return_value = 0
    columns.delete(actor("manager"), str(todo.id))
    cols.repo.detach_deleted_cards.assert_called_once_with(todo.id)
    cols.repo.delete.assert_called_once_with(todo)
    cols.repo.get.return_value = column(cols.board, "Done")
    with pytest.raises(ColumnLocked):
        columns.delete(actor("manager"), str(todo.id))


def notification(**over):
    base = dict(id=new_id(), type="assigned", board_id=None, card_id=new_id(), actor_id=new_id(), action=None, is_read=False, notify_date=date(2026, 11, 27), created_at=datetime(2026, 11, 27, tzinfo=timezone.utc))
    return row(**{**base, **over})


def test_serialize_many_names_the_card_board_and_actor(stub):
    repo = stub(notifications, "repo")
    n = notification()
    board_id = new_id()
    repo.card_context.return_value = {n.card_id: ("Fix login", board_id)}
    repo.board_names.return_value = {board_id: "Alpha"}
    repo.board_slugs.return_value = {board_id: "alpha"}
    repo.user_names.return_value = {n.actor_id: "Ann"}
    out = notifications.serialize(n)
    assert out["card_title"] == "Fix login" and out["board_name"] == "Alpha" and out["board_slug"] == "alpha" and out["actor_name"] == "Ann"
    assert out["notify_date"] == "2026-11-27" and out["board_id"] == str(board_id)
    bare = notifications._one(notification(card_id=None, created_at=None))
    assert bare["card_id"] is None and bare["created_at"] is None and bare["board_id"] is None


def test_inbox_and_marking_read(stub, session):
    repo = stub(notifications, "repo")
    repo.list_for_user.return_value = []
    repo.unread_count.return_value = 3
    who = actor()
    assert notifications.inbox(who, unread=True) == {"items": [], "unread_count": 3}
    n = notification()
    repo.get_for_user.return_value = n
    assert notifications.mark_read(who, str(n.id)).is_read is True
    repo.get_for_user.return_value = None
    with pytest.raises(NotFound):
        notifications.mark_read(who, str(n.id))
    with pytest.raises(NotFound):
        notifications.mark_read(who, "bad")
    notifications.mark_all_read(who)
    repo.mark_all_read.assert_called_once()


def test_preferences_default_to_on_and_upsert(session):
    from app.models import PREFERENCE_TYPES

    off = row(type=PREFERENCE_TYPES[0], enabled=False)
    session.scalars.return_value = [off]
    prefs = notifications.preferences(actor())["preferences"]
    assert [p["type"] for p in prefs] == list(PREFERENCE_TYPES)
    assert prefs[0]["enabled"] is False and all(p["enabled"] for p in prefs[1:])
    notifications.set_preferences(actor(), {"preferences": [{"type": PREFERENCE_TYPES[0], "enabled": True}, {"type": PREFERENCE_TYPES[1], "enabled": False}]})
    assert off.enabled is True
    session.add.assert_called_once()
    with pytest.raises(ValidationError):
        notifications.set_preferences(actor(), {"preferences": [{"type": "x", "enabled": True}] * 2})
