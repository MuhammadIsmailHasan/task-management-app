from datetime import datetime, timezone

import pytest

from app.blueprints.boards import dto
from app.blueprints.boards import service as boards
from app.common.errors import Conflict, Forbidden, NotFound, Unauthorized, ValidationError
from tests.unit.support import actor, new_id, row


def board(**over):
    base = dict(id=new_id(), name="Alpha", slug="alpha", description=None, owner_id=None, deleted_at=None, archived_at=None, share_token=None)
    return row(**{**base, **over})


@pytest.fixture
def b(stub, session):
    repo = stub(boards, "repo")
    repo.is_member.return_value = False
    repo.get_member.return_value = None
    return row(repo=repo, users=stub(boards, "users"), activity=stub(boards, "activity"), notifications=stub(boards, "notifications"), session=session)


def test_access_by_role_owner_and_membership(b):
    sup = actor("supervisor")
    owned = board(owner_id=sup.id)
    plain = board()
    assert boards.is_owner(sup, owned) and not boards.is_owner(sup, plain) and not boards.is_owner(None, owned)
    assert boards.can_access(actor("manager"), plain) and boards.can_access(sup, owned)
    assert not boards.can_access(None, plain) and not boards.can_access(actor(), None) and not boards.can_access(actor("admin"), board(deleted_at=1))
    assert not boards.can_access(actor(), plain)
    b.repo.is_member.return_value = True
    assert boards.is_board_member(actor(), plain) and boards.can_access(actor(), plain)
    assert boards.can_write_staff(sup, plain) and not boards.can_write_staff(actor("member"), plain)
    assert boards.can_write_staff(actor("admin"), plain) and not boards.can_write_staff(None, plain)


def test_require_access_and_staff(b):
    with pytest.raises(Unauthorized):
        boards.require_access(None, board())
    with pytest.raises(NotFound):
        boards.require_access(actor(), None)
    with pytest.raises(Forbidden):
        boards.require_access(actor(), board())
    b.repo.is_member.return_value = True
    with pytest.raises(Forbidden):
        boards.require_staff(actor("member"), board())
    boards.require_staff(actor("supervisor"), board())


def test_load_board_and_details(b):
    x = board()
    b.repo.get_by_id.return_value = x
    b.repo.get_detail.return_value = x
    b.repo.get_by_slug.return_value = x
    m = actor("manager")
    assert boards.load_board(m, str(x.id)) is x
    with pytest.raises(NotFound):
        boards.load_board(m, "nope")
    assert boards.board_detail(m, str(x.id)) is x and boards.reload_detail(x) is x
    assert boards.board_detail_by_slug(m, "alpha") is x
    with pytest.raises(NotFound):
        boards.board_detail_by_slug(m, "Not A Slug")
    with pytest.raises(Unauthorized):
        boards.board_detail_by_slug(None, "alpha")


def test_create_board_adds_the_five_default_columns(b):
    made = board()
    b.repo.create_board.return_value = made
    assert boards.create_board(actor("manager"), {"name": " Alpha ", "description": "<p>Hi</p>"}) is made
    b.repo.create_board.assert_called_once_with("Alpha", description="<p>Hi</p>")
    assert [c.args[1] for c in b.repo.add_column.call_args_list] == list(dto.DEFAULT_COLUMNS)


def test_update_board_owner_rules(b, monkeypatch):
    x = board()
    b.repo.get_by_id.return_value = x
    sup = row(id=new_id(), role="supervisor")
    b.users.get_by_id.return_value = sup
    b.repo.is_member.return_value = True
    with pytest.raises(Forbidden):
        boards.update_board(actor("supervisor"), str(x.id), {"owner_id": str(sup.id)})
    boards.update_board(actor("manager"), str(x.id), {"owner_id": str(sup.id)})
    assert x.owner_id == sup.id
    b.notifications.add_board.assert_called_once()
    boards.update_board(actor("manager"), str(x.id), {"owner_id": None})
    assert x.owner_id is None
    b.users.get_by_id.return_value = row(id=new_id(), role="member")
    with pytest.raises(ValidationError):
        boards.update_board(actor("manager"), str(x.id), {"owner_id": str(new_id())})


def test_update_board_rename_and_description(b, monkeypatch):
    owner = actor("supervisor")
    x = board(owner_id=owner.id)
    b.repo.get_by_id.return_value = x
    monkeypatch.setattr(boards, "unique_slug", lambda conn, name, exclude_id: "beta")
    boards.update_board(owner, str(x.id), {"name": "Beta", "description": "<p>New</p>"})
    assert (x.name, x.slug, x.description) == ("Beta", "beta", "<p>New</p>")
    b.repo.is_member.return_value = True
    with pytest.raises(Forbidden):
        boards.update_board(actor("supervisor"), str(x.id), {"name": "Gamma"})


def test_owner_change_unassigns_cards_of_a_previous_owner_who_is_not_a_member(b):
    old = new_id()
    x = board(owner_id=old)
    card = row(id=new_id(), title="Fix", assignee_id=old)
    b.repo.assigned_cards.return_value = [card]
    boards._owner_changed(actor("manager"), x, row(id=new_id()))
    assert card.assignee_id is None
    b.activity.add.assert_called_once()


def test_archive_delete_and_list(b, ctx):
    x = board()
    b.repo.get_by_id.return_value = x
    assert boards.set_archived(actor("admin"), str(x.id), True).archived_at is not None
    assert boards.set_archived(actor("admin"), str(x.id), False).archived_at is None
    boards.soft_delete(actor("manager"), str(x.id))
    assert x.deleted_at is not None
    with pytest.raises(Forbidden):
        boards.soft_delete(actor("supervisor"), str(x.id))
    b.repo.get_by_id.return_value = None
    with pytest.raises(NotFound):
        boards.set_archived(actor("admin"), str(x.id), True)
    b.repo.list_visible.return_value = [x]
    b.repo.counts_for.return_value = {}
    assert boards.list_boards(actor("manager"), q="  ") == ([x], {})
    assert b.repo.list_visible.call_args.args[1] is None


def test_list_members_and_candidates(b):
    x = board()
    b.repo.get_by_id.return_value = x
    b.repo.list_members.return_value = ["m"]
    b.repo.candidates.return_value = ["c"]
    assert boards.list_members(actor("manager"), str(x.id), with_email=True) == ["m"]
    b.repo.is_member.return_value = True
    with pytest.raises(Forbidden):
        boards.list_members(actor("member"), str(x.id), with_email=True)
    assert boards.member_candidates(actor("manager"), str(x.id), "an") == ["c"]
    with pytest.raises(ValidationError):
        boards.member_candidates(actor("manager"), str(x.id), " a ")


def test_add_member_rules(b):
    x = board()
    b.repo.get_by_id.return_value = x
    m = actor("manager")
    user = row(id=new_id(), role="member", is_active=True, is_available=True)
    b.users.get_by_id.return_value = user
    assert boards.add_member(m, str(x.id), {"user_id": str(user.id)}) is user
    b.repo.add_member.assert_called_once_with(x.id, user.id)
    b.repo.get_member.return_value = row()
    with pytest.raises(Conflict):
        boards.add_member(m, str(x.id), {"user_id": str(user.id)})
    user.is_available = False
    with pytest.raises(ValidationError):
        boards.add_member(m, str(x.id), {"user_id": str(user.id)})
    user.role = "manager"
    with pytest.raises(ValidationError):
        boards.add_member(m, str(x.id), {"user_id": str(user.id)})
    b.users.get_by_id.return_value = None
    with pytest.raises(NotFound):
        boards.add_member(m, str(x.id), {"user_id": "bad"})


def test_add_member_row_records_how_they_joined(b):
    x = board()
    boards.add_member_row(actor("manager"), x, row(id=new_id()), via="join_request")
    assert b.activity.add.call_args.args[4]["via"] == "join_request"
    b.notifications.add_board.assert_called_once()


def test_remove_member(b):
    x = board()
    b.repo.get_by_id.return_value = x
    b.repo.assigned_cards.return_value = []
    member = row()
    b.repo.get_member.return_value = member
    boards.remove_member(actor("manager"), str(x.id), str(new_id()))
    b.repo.delete_member.assert_called_once_with(member)
    b.repo.get_member.return_value = None
    with pytest.raises(NotFound):
        boards.remove_member(actor("manager"), str(x.id), str(new_id()))
    b.repo.is_member.return_value = True
    with pytest.raises(Forbidden):
        boards.require_manage_members(actor("supervisor"), x)


def test_share_link_lifecycle(b):
    x = board()
    b.repo.get_by_id.return_value = x
    m = actor("manager")
    assert boards.get_share(m, str(x.id)) == {"enabled": False, "token": None, "path": None}
    first = boards.enable_share(m, str(x.id))
    assert first["enabled"] and first["path"] == f"/app/shared/{x.share_token}"
    assert boards.enable_share(m, str(x.id)) == first
    assert boards.regenerate_share(m, str(x.id))["token"] != first["token"]
    assert boards.disable_share(m, str(x.id))["enabled"] is False
    assert boards.disable_share(m, str(x.id))["enabled"] is False
    b.repo.is_member.return_value = True
    with pytest.raises(Forbidden):
        boards.get_share(actor("supervisor"), str(x.id))


def test_clean_name_and_description():
    assert dto.clean_name("  Alpha ") == "Alpha"
    for bad in (None, " ", "x" * 256, 3):
        with pytest.raises(ValidationError):
            dto.clean_name(bad)
    assert dto.clean_description(None) is None and dto.clean_description("<p></p>") is None
    assert dto.clean_description("<p>Hi<script>x</script></p>") == "<p>Hi</p>"
    with pytest.raises(ValidationError):
        dto.clean_description(5)
    with pytest.raises(ValidationError):
        dto.clean_description("<p>" + "a" * 501 + "</p>")


def test_serialize_board_and_column():
    x = board(owner_id=new_id(), archived_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    col = row(id=new_id(), board_id=x.id, name="Todo", order=0.0)
    data = dto.serialize_board(x, columns=[col], counts={"card_count": 2})
    assert data["owner_id"] == str(x.owner_id) and data["archived_at"].startswith("2026-01-01") and data["card_count"] == 2
    assert data["columns"] == [{"id": str(col.id), "board_id": str(x.id), "name": "Todo", "order": 0.0}]
    assert "columns" not in dto.serialize_board(board())
