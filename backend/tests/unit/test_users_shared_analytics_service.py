"""Unit tests of the users, shared (public link), and analytics services: repositories and Board checks mocked."""
import io
from uuid import UUID
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.blueprints.analytics import service as analytics
from app.blueprints.shared import service as shared
from app.blueprints.users import service as users
from app.common import clock
from app.common.errors import CannotDeactivateSelf, Conflict, Forbidden, NotFound, UserHasOpenWork, ValidationError
from app.common.signing import avatar_url
from app.models import User
from tests.unit.support import actor, new_id, row

NOW = datetime(2026, 11, 27, 9, tzinfo=timezone.utc)  # a Friday
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 16


@pytest.fixture(autouse=True)
def fixed_clock():
    clock.set_now(lambda: NOW)
    yield
    clock.set_now(None)


# ---- users -------------------------------------------------------------------------------------------------------

def person(**over):
    base = dict(id=new_id(), full_name="Ann", username="ann", email="ann@x.co", role="member", is_active=True, is_available=True, avatar_path=None)
    return row(**{**base, **over})


@pytest.fixture
def us(stub, session):
    auth_repo = stub(users, "auth_repo")
    auth_repo.User = User  # the avatar lock builds a real SELECT ... FOR UPDATE; the mocked session never runs it
    auth_service = stub(users, "auth_service")
    auth_service.duplicate_details.return_value = {}
    repo = stub(users, "repo")
    repo.open_assigned.return_value = (0, [])
    repo.open_owned_boards.return_value = (0, [])
    return SimpleNamespace(repo=repo, auth_repo=auth_repo, auth_service=auth_service, activity=stub(users, "activity"), session=session)


def test_list_and_create_users(us):
    us.repo.list_page.return_value = ("rows", 1)
    assert users.list_users(2, 10) == ("rows", 1)
    made = person()
    us.auth_service.create_account.return_value = made
    assert users.create_user(actor("admin"), {"full_name": "Ann", "username": "ann", "email": "a@x.co", "password": "pw"}) is made
    assert us.auth_service.create_account.call_args.args[4] == "member"
    with pytest.raises(ValidationError):
        users.create_user(actor("admin"), {"role": "owner"})


def test_update_user_fields_and_role(us, stub):
    u = person()
    us.auth_repo.get_by_id.return_value = u
    from app.blueprints.boards import repository as boards_repo
    from app.blueprints.invites import repository as invites_repo

    membership = row(board_id=new_id())
    stub(boards_repo, "memberships_of", lambda uid: [membership])
    deleted = stub(boards_repo, "delete_member")
    pending = stub(invites_repo, "delete_pending_of_user")
    users.update_user(actor("admin"), str(u.id), {"full_name": " Ann Lee ", "username": "Ann.Lee", "email": "A@X.CO", "is_available": False, "role": "manager"})
    assert (u.full_name, u.username, u.email, u.is_available, u.role) == ("Ann Lee", "ann.lee", "a@x.co", False, "manager")
    deleted.assert_called_once_with(membership)
    pending.assert_called_once_with(u.id)
    with pytest.raises(ValidationError):
        users.update_user(actor("admin"), str(u.id), {"full_name": " "})
    with pytest.raises(ValidationError):
        users.update_user(actor("admin"), str(u.id), {"role": "boss"})
    us.auth_service.duplicate_details.return_value = {"email": ["taken"]}
    with pytest.raises(Conflict):
        users.update_user(actor("admin"), str(u.id), {"email": "b@x.co"})
    us.auth_repo.get_by_id.return_value = None
    with pytest.raises(NotFound):
        users.update_user(actor("admin"), "bad", {})


def test_deactivation_rules(us):
    me = actor("admin")
    u = person()
    us.auth_repo.get_by_id.return_value = u
    users.update_user(me, str(u.id), {"is_active": False})
    assert u.is_active is False
    users.update_user(me, str(u.id), {"is_active": True})
    assert u.is_active is True
    self_row = person(id=UUID(me.id))
    with pytest.raises(CannotDeactivateSelf):
        users._set_active(me, self_row, False)
    us.repo.open_assigned.return_value = (1, [row(id=new_id(), title="t", board_id=new_id(), slug="s", name="B")])
    us.repo.open_owned_boards.return_value = (1, [row(id=new_id(), slug="s", name="B", open=2)])
    with pytest.raises(UserHasOpenWork) as err:
        users._set_active(me, u, False)
    assert err.value.details["cards_total"] == 1 and err.value.details["boards"][0]["open_card_count"] == 2


def test_avatar_set_replace_and_clear(us, ctx, stub):
    store = stub(users, "_store")
    u = person(avatar_path="old.png")
    us.session.scalars.return_value.first.return_value = u
    assert users.set_avatar(actor(), io.BytesIO(PNG)) is u
    assert u.avatar_path.endswith(".png")
    store.delete.assert_called_once_with("old.png")
    users.clear_avatar(actor())
    assert u.avatar_path is None
    users.clear_avatar(actor())  # nothing to clear
    us.session.rollback.assert_called_once()
    us.session.scalars.return_value.first.return_value = None
    with pytest.raises(NotFound):
        users.set_avatar(actor(), io.BytesIO(PNG))
    store.delete.assert_called_with(store.save.call_args.args[0])  # the new file is removed when the switch fails


@pytest.mark.parametrize("data,message", [(None, "required"), (b"", "empty"), (b"x" * (2_097_152 + 1), "2 MB"), (b"GIF89a....", "PNG")])
def test_avatar_file_rules(us, data, message):
    with pytest.raises(ValidationError) as err:
        users.set_avatar(actor(), None if data is None else io.BytesIO(data))
    assert message in err.value.message


def test_open_avatar(us, ctx):
    u = person(avatar_path="abc.png")
    us.auth_repo.get_by_id.return_value = u
    url = avatar_url(u.id, NOW)
    exp, sig = url.split("exp=")[1].split("&sig=")
    path, mime = users.open_avatar(str(u.id), exp, sig)
    assert path.endswith("abc.png") and mime == "image/png"
    with pytest.raises(Forbidden):
        users.open_avatar(str(u.id), exp, "bad")
    u.avatar_path = None
    with pytest.raises(NotFound):
        users.open_avatar(str(u.id), exp, sig)


# ---- shared (public link) ----------------------------------------------------------------------------------------

@pytest.fixture
def sh(stub, ctx):
    col = row(id=new_id(), board_id=None, name="Todo", order=0.0)
    board = row(id=new_id(), name="Alpha", description=None, columns=[col], share_token="tok")
    repo = stub(shared, "repo")
    repo.board_by_token.return_value = board
    repo.names_of.return_value = {}
    return SimpleNamespace(repo=repo, cards_repo=stub(shared, "cards_repo"), categories_repo=stub(shared, "categories_repo"), boards=stub(shared, "boards"), board=board, col=col)


def shared_card(sh, **over):
    base = dict(id=new_id(), column_id=sh.col.id, category_id=None, assignee_id=None, title="t", description=None, priority="low", start_date=None, end_date=date(2026, 11, 26), order=1.0, archived_at=None, subtasks=[], attachments=[])
    return row(**{**base, **over})


def test_shared_board_and_cards(sh):
    sh.boards.can_access.return_value = True
    out = shared.get_board("tok", actor())
    assert out["has_board_access"] is True and out["columns"][0]["name"] == "Todo"
    assert shared.get_board("tok", None)["has_board_access"] is False
    x = shared_card(sh, attachments=[row(id=new_id(), card_id=None, name="f", mime_type=None, url=None, file_path="f.pdf", created_by_id=None)])
    sh.cards_repo.list_for_board.return_value = [x]
    item = shared.list_cards("tok", {})[0]
    assert item["due_state"] == "overdue" and "st=share:" in item["attachments"][0]["file_url"]
    sh.repo.card_in_board.return_value = x
    assert shared.get_card("tok", str(x.id))["id"] == str(x.id)
    sh.repo.card_in_board.return_value = None
    with pytest.raises(NotFound):
        shared.get_card("tok", str(x.id))
    sh.repo.board_by_token.return_value = None
    with pytest.raises(NotFound):
        shared.get_board("gone", None)


def test_shared_categories_and_attachment_url(sh):
    sh.categories_repo.list_for_board.return_value = [row(id=new_id(), board_id=sh.board.id, name="bug", color=None)]
    assert shared.list_categories("tok")[0]["name"] == "bug"
    link = row(id=new_id(), card_id=None, url="https://e.x", file_path=None, name="l", mime_type=None, created_by_id=None)
    sh.repo.attachment_in_board.return_value = link
    assert shared.attachment_url("tok", str(link.id)) == {"file_url": "https://e.x", "expires_at": None}
    link.file_path = "f.pdf"
    assert "st=share:" in shared.attachment_url("tok", str(link.id))["file_url"]
    sh.repo.attachment_in_board.return_value = None
    with pytest.raises(NotFound):
        shared.attachment_url("tok", str(link.id))


# ---- analytics ---------------------------------------------------------------------------------------------------

@pytest.fixture
def an(stub, ctx):
    board = row(id=new_id())
    boards = stub(analytics, "boards")
    boards.load_board.return_value = board
    boards.is_owner.return_value = False
    return SimpleNamespace(repo=stub(analytics, "repo"), boards=boards, board=board)


def test_week_boundaries_are_monday_to_monday():
    starts, bounds = analytics.week_boundaries(2, NOW, "UTC")
    assert starts == [date(2026, 11, 16), date(2026, 11, 23)]
    assert bounds[-1] == datetime(2026, 11, 30, tzinfo=timezone.utc) and len(bounds) == 3


def test_throughput_access_and_shape(an):
    an.repo.throughput.return_value = [(an.board.id, "Alpha", 1, 3), (an.board.id, "Alpha", None, None)]
    out = analytics.board_throughput(actor("manager"), "b", 2)
    assert out["total"] == 3 and [w["done"] for w in out["weeks"]] == [0, 3]
    assert analytics.all_throughput(actor("admin"), 2)[0]["name"] == "Alpha"
    with pytest.raises(Forbidden):
        analytics.board_throughput(actor("supervisor"), "b", 2)
    with pytest.raises(Forbidden):
        analytics.all_throughput(actor("supervisor"), 2)


def test_summaries(an):
    an.repo.summaries.return_value = [(an.board.id, "Alpha", 5, 2, 1, 1, 1)]
    an.boards.is_owner.return_value = True
    assert analytics.board_analytics(actor("supervisor"), "b")["done_delta"] == 1
    assert analytics.all_boards(actor("manager"))[0]["total"] == 5
    with pytest.raises(Forbidden):
        analytics.all_boards(actor("supervisor"))
    an.boards.is_owner.return_value = False
    with pytest.raises(Forbidden):
        analytics.board_analytics(actor("supervisor"), "b")


def test_scope_by_role(an):
    with pytest.raises(Forbidden):
        analytics._scope(actor("member"), None)
    assert analytics._scope(actor("admin"), an.board.id) == [an.board.id]
    with pytest.raises(Forbidden):
        analytics._scope(actor("supervisor"), an.board.id)
    an.repo.boards_in_scope.return_value = [(an.board.id, "Alpha")]
    sup = actor("supervisor")
    assert analytics._scope(sup, None) == [an.board.id]
    assert an.repo.boards_in_scope.call_args.kwargs["owner_id"] is not None


def dash_card(**over):
    return row(**{**dict(id=new_id(), title="t", board_id=new_id(), slug="a", board_name="A", priority="high", end_date=date(2026, 11, 20), assignee_name="Ann"), **over})


def test_dashboard_builds_every_widget(an):
    an.repo.boards_in_scope.return_value = [(an.board.id, "Alpha")]
    an.repo.overview.return_value = [4, 1, 2, 1]
    an.repo.overdue_cards.return_value = (1, [dash_card()])
    an.repo.due_on_cards.return_value = (0, [])
    an.repo.top_priority.return_value = [dash_card(end_date=None)]
    an.repo.weekly_done.return_value = {0: 2}
    an.repo.finished_pairs.return_value = [(datetime(2026, 11, 20, 10), date(2026, 11, 21)), (datetime(2026, 11, 25, tzinfo=timezone.utc), date(2026, 11, 24))]
    an.repo.people.return_value = [row(id=new_id(), full_name="Ann", avatar_path=None)]
    out = analytics.dashboard(actor("manager"), None, str(new_id()), date(2026, 11, 16), date(2026, 11, 27), None)
    assert out["overview"] == {"total": 4, "done": 1, "in_progress": 2, "overdue": 1}
    assert out["due_tomorrow"]["due_on"] == "2026-11-28" and out["finished"] == {"on_time": 1, "overdue": 1}
    assert [w["week_start"] for w in out["throughput"]["weeks"]] == ["2026-11-16", "2026-11-23"] and out["throughput"]["total"] == 2
    assert out["overdue"]["cards"][0]["due_state"] == "overdue" and out["top_priority"]["cards"][0]["end_date"] is None


def test_dashboard_defaults_empty_scope_and_bad_range(an):
    an.repo.boards_in_scope.return_value = []
    out = analytics.dashboard(actor("supervisor"), None, None, None, None, None)
    assert out["range"] == {"from": "2026-10-29", "to": "2026-11-27"} and out["overview"]["total"] == 0 and out["members"] == []
    with pytest.raises(ValidationError):
        analytics.dashboard(actor("manager"), None, None, date(2026, 11, 2), date(2026, 11, 1), None)
    with pytest.raises(ValidationError):
        analytics.dashboard(actor("manager"), None, None, date(2026, 1, 1) - timedelta(days=200), date(2026, 1, 1), None)
