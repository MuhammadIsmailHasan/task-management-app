"""Unit tests of the cards service and DTO: fields, assignment, archive, move, subtasks, attachments, listing, My Tasks.

Repositories, the Board checks, Activity_Log, and notifications are mocked; `db.session` is a MagicMock.
"""
import io
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.blueprints.cards import dto
from app.blueprints.cards import service as cards
from app.common import clock
from app.common.errors import CardArchived, CardInDone, CardNotArchived, Forbidden, NotFound, ValidationError
from tests.unit.support import actor, new_id, row

NOW = datetime(2026, 11, 27, 9, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def fixed_clock():
    clock.set_now(lambda: NOW)
    yield
    clock.set_now(None)


def card(**over):
    base = dict(id=new_id(), title="Fix login", description=None, priority="medium", start_date=None, end_date=None, assignee_id=None, category_id=None, column_id=new_id(), order=1.0, archived_at=None, completed_at=None, deleted_at=None, subtasks=[], attachments=[])
    return row(**{**base, **over})


@pytest.fixture
def c(stub, session, ctx):
    board = row(id=new_id(), owner_id=None, share_token=None)
    repo = stub(cards, "repo")
    boards_repo = stub(cards, "boards_repo")
    boards_repo.get_by_id.return_value = board
    boards_repo.is_member.return_value = True
    policy = stub(cards, "policy")
    return SimpleNamespace(repo=repo, boards_repo=boards_repo, boards=stub(cards, "boards"), users=stub(cards, "users"), activity=stub(cards, "activity"), notif=stub(cards, "notif_repo"), policy=policy, board=board, session=session)


def load(c, x):
    c.repo.get_card.return_value = x
    return str(x.id)


# ---- loading and permissions ---------------------------------------------------------------------------------------

def test_load_card_and_get_card(c):
    x = card()
    assert cards.get_card(actor(), load(c, x)) is x
    c.boards.require_access.assert_called_once()
    c.repo.get_card.return_value = None
    with pytest.raises(NotFound):
        cards.load_card(actor(), "bad")


def test_field_edit_rules(c):
    x, who = card(), actor()
    with pytest.raises(Forbidden):
        cards._require_fields_edit(None, x, c.board, ["title"])
    c.policy.is_staff.return_value = True
    cards._require_fields_edit(who, x, c.board, ["title"])
    c.policy.is_staff.return_value = False
    c.policy.is_assignee.return_value = False
    with pytest.raises(Forbidden):
        cards._require_fields_edit(who, x, c.board, ["description"])
    c.policy.is_assignee.return_value = True
    cards._require_fields_edit(who, x, c.board, ["description"])
    with pytest.raises(Forbidden):
        cards._require_fields_edit(who, x, c.board, ["description", "title"])
    with pytest.raises(Forbidden):
        cards._require(False)


def test_present_builds_the_full_card(c, stub):
    from app.blueprints.comments import service as comments_service

    x = card(column_id=new_id())
    stub(comments_service, "list_comments").return_value = []
    c.activity.for_card.return_value = []
    c.activity.serialize_many.return_value = []
    c.repo.get_detail.return_value = x
    c.repo.get_column.return_value = row(name="Todo")
    c.users.identities.return_value = {}
    data = cards.present(x, actor())
    assert data["id"] == str(x.id) and data["comments"] == [] and data["activity"] == []


def test_completion_stamp():
    old = NOW - timedelta(days=1)
    assert cards.completion_stamp(None, "Done", None, NOW) == NOW
    assert cards.completion_stamp("Done", "Done", old, NOW) == old
    assert cards.completion_stamp("Done", "Todo", old, NOW) is None


# ---- create and update --------------------------------------------------------------------------------------------

def test_create_card_in_a_column(c):
    col = row(id=new_id(), board_id=c.board.id, name="Todo")
    c.repo.get_column.return_value = col
    c.repo.max_order.return_value = 2.0
    made = card()
    c.repo.add_card.return_value = made
    assert cards.create_card(actor("manager"), str(col.id), {"title": " New ", "priority": "high"}) is made
    kwargs = c.repo.add_card.call_args.kwargs
    assert kwargs["order"] == 3.0 and kwargs["title"] == "New" and kwargs["completed_at"] is None
    c.repo.get_column.return_value = None
    with pytest.raises(NotFound):
        cards.create_card(actor("manager"), str(col.id), {"title": "x"})


def test_create_card_with_an_assignee_and_category(c):
    col = row(id=new_id(), board_id=c.board.id, name="Done")
    cat = row(id=new_id(), board_id=c.board.id, name="bug")
    user = row(id=new_id(), role="member", is_active=True, is_available=True, full_name="Ann")
    c.repo.get_column.return_value = col
    c.repo.max_order.return_value = None
    c.repo.get_category.return_value = cat
    made = card(assignee_id=None)
    c.repo.add_card.return_value = made
    c.users.get_by_id.return_value = user
    cards.create_card(actor("manager"), str(col.id), {"title": "x", "category_id": str(cat.id), "assignee_id": str(user.id)})
    kwargs = c.repo.add_card.call_args.kwargs
    assert kwargs["order"] == 1.0 and kwargs["completed_at"] == NOW and kwargs["category_id"] == cat.id
    assert made.assignee_id == user.id
    c.notif.insert_ignore.assert_called_once()


def test_category_must_belong_to_the_board(c):
    fields = {}
    cards._apply_category(fields, {}, c.board)
    assert fields == {}
    cards._apply_category(fields, {"category_id": None}, c.board)
    assert fields == {"category_id": None}
    c.repo.get_category.return_value = row(id=new_id(), board_id=new_id())
    with pytest.raises(ValidationError):
        cards._apply_category(fields, {"category_id": str(new_id())}, c.board)


def test_assign_rules(c):
    x = card(assignee_id=new_id())
    who = actor("manager")
    cards._assign(who, x, None, c.board)
    assert x.assignee_id is None
    c.users.get_by_id.return_value = None
    with pytest.raises(ValidationError):
        cards._assign(who, x, str(new_id()), c.board)
    c.users.get_by_id.return_value = row(id=new_id(), role="admin")
    with pytest.raises(ValidationError) as err:
        cards._assign(who, x, str(new_id()), c.board)
    assert "assignee_id" in err.value.details
    c.users.get_by_id.return_value = row(id=new_id(), role="member", is_active=False, is_available=True)
    with pytest.raises(ValidationError):
        cards._assign(who, x, str(new_id()), c.board)
    c.users.get_by_id.return_value = row(id=new_id(), role="member", is_active=True, is_available=True)
    c.boards_repo.is_member.return_value = False
    with pytest.raises(ValidationError):
        cards._assign(who, x, str(new_id()), c.board)


def test_change_entries():
    assert cards._change("description", "a", "b") == {}
    assert cards._change("priority", "low", "high") == {"from": "low", "to": "high"}
    assert cards._change("end_date", None, date(2026, 1, 2)) == {"from": None, "to": "2026-01-02"}


def test_update_card_logs_each_change_and_reassigns(c):
    old_cat, new_cat = row(id=new_id(), board_id=c.board.id, name="bug"), row(id=new_id(), board_id=c.board.id, name="ui")
    x = card(category_id=old_cat.id, assignee_id=None)
    c.policy.is_staff.return_value = True
    c.repo.get_category.side_effect = lambda cid: {old_cat.id: old_cat, new_cat.id: new_cat}.get(cid)
    user = row(id=new_id(), role="member", is_active=True, is_available=True, full_name="Ann")
    c.users.get_by_id.return_value = user
    cards.update_card(actor("manager"), load(c, x), {"priority": "high", "end_date": "2026-12-01", "category_id": str(new_cat.id), "assignee_id": str(user.id)})
    meta = c.activity.add.call_args_list[0].args[4]
    assert meta["fields"] == ["category_id", "end_date", "priority"]
    assert meta["changes"]["category"] == {"from": "bug", "to": "ui"}
    assert x.assignee_id == user.id
    with pytest.raises(ValidationError):
        cards.update_card(actor("manager"), str(x.id), {"start_date": "2027-01-01"})


def test_delete_card(c):
    x = card()
    cards.delete_card(actor("manager"), load(c, x))
    assert x.deleted_at == NOW
    c.notif.notify_assignee.assert_called_once()


# ---- archive and restore ------------------------------------------------------------------------------------------

def test_archive_and_restore(c):
    x = card()
    c.repo.get_column.return_value = row(name="Todo")
    cards.set_archived(actor("manager"), load(c, x), True)
    assert x.column_id is None and x.archived_at == NOW
    assert cards.set_archived(actor("manager"), str(x.id), True) is x  # already archived: unchanged
    first = row(id=new_id(), name="Todo")
    c.repo.first_column.return_value = first
    c.repo.max_order.return_value = None
    cards.set_archived(actor("manager"), str(x.id), False)
    assert (x.column_id, x.order, x.archived_at) == (first.id, 1.0, None)
    with pytest.raises(CardNotArchived):
        cards.set_archived(actor("manager"), str(x.id), False)
    c.repo.get_column.return_value = row(name="Done")
    with pytest.raises(CardInDone):
        cards.set_archived(actor("manager"), str(x.id), True)
    x.archived_at = NOW
    c.repo.first_column.return_value = None
    with pytest.raises(NotFound):
        cards.set_archived(actor("manager"), str(x.id), False)


# ---- move ---------------------------------------------------------------------------------------------------------

def test_move_between_columns_places_the_card_and_notifies(c):
    source, target = row(id=new_id(), board_id=c.board.id, name="Todo"), row(id=new_id(), board_id=c.board.id, name="Done")
    x = card(column_id=source.id)
    prev = card(column_id=target.id, order=1.0)
    nxt = card(column_id=target.id, order=2.0)
    c.policy.can_move.return_value = True
    c.repo.get_card.side_effect = lambda cid: {x.id: x, prev.id: prev, nxt.id: nxt}.get(cid)
    c.repo.get_column.side_effect = lambda cid: {source.id: source, target.id: target}.get(cid)
    c.repo.column_cards.return_value = [prev, nxt]
    cards.move_card(actor(), str(x.id), {"column_id": str(target.id), "prev": str(prev.id), "next": str(nxt.id)})
    assert (x.column_id, x.order, x.completed_at) == (target.id, 1.5, NOW)
    c.notif.notify_assignee.assert_called_once()


def test_move_rebalances_when_neighbours_touch(c):
    target = row(id=new_id(), board_id=c.board.id, name="Todo")
    x = card(column_id=target.id)
    prev, nxt = card(column_id=target.id, order=1.0), card(column_id=target.id, order=1.0)
    c.policy.can_move.return_value = True
    c.repo.get_card.side_effect = lambda cid: {x.id: x, prev.id: prev, nxt.id: nxt}.get(cid)
    c.repo.get_column.return_value = target
    c.repo.column_cards.return_value = [prev, nxt]
    cards.move_card(actor(), str(x.id), {"column_id": str(target.id), "prev": str(prev.id), "next": str(nxt.id)})
    assert (prev.order, nxt.order) == (1.0, 2.0)
    c.session.flush.assert_called_once()
    c.notif.notify_assignee.assert_not_called()  # a reorder inside one Column notifies nobody


def test_move_refusals(c):
    target = row(id=new_id(), board_id=c.board.id, name="Todo")
    x = card()
    c.policy.can_move.return_value = False
    with pytest.raises(Forbidden):
        cards.move_card(actor(), load(c, x), {"column_id": str(target.id)})
    c.policy.can_move.return_value = True
    x.archived_at = NOW
    with pytest.raises(CardArchived):
        cards.move_card(actor(), str(x.id), {"column_id": str(target.id)})
    x.archived_at = None
    c.repo.get_column.return_value = None
    with pytest.raises(NotFound):
        cards.move_card(actor(), str(x.id), {"column_id": str(target.id)})
    c.repo.get_column.return_value = row(id=new_id(), board_id=new_id(), name="X")
    with pytest.raises(ValidationError):
        cards.move_card(actor(), str(x.id), {"column_id": str(target.id)})
    c.repo.get_column.return_value = target
    with pytest.raises(ValidationError):
        cards.move_card(actor(), str(x.id), {"column_id": str(target.id), "prev": str(x.id)})
    later, earlier = card(column_id=target.id, order=5.0), card(column_id=target.id, order=1.0)
    c.repo.get_card.side_effect = lambda cid: {x.id: x, later.id: later, earlier.id: earlier}.get(cid)
    with pytest.raises(ValidationError):
        cards.move_card(actor(), str(x.id), {"column_id": str(target.id), "prev": str(later.id), "next": str(earlier.id)})


# ---- subtasks -----------------------------------------------------------------------------------------------------

def subtask(x, **over):
    return row(**{**dict(id=new_id(), card_id=x.id, title="Write", is_done=False, order=1.0, created_by_id=None), **over})


def test_add_subtask(c):
    x = card()
    c.policy.can_add_item.return_value = True
    c.repo.max_subtask_order.return_value = 3.0
    c.repo.add_subtask.return_value = subtask(x)
    cards.add_subtask(actor(), load(c, x), {"title": " Write "})
    assert c.repo.add_subtask.call_args.args[1:3] == ("Write", 4.0)
    with pytest.raises(ValidationError):
        cards.add_subtask(actor(), str(x.id), {"title": " "})
    c.policy.can_add_item.return_value = False
    with pytest.raises(Forbidden):
        cards.add_subtask(actor(), str(x.id), {"title": "x"})


def test_update_subtask_check_rename_and_order(c):
    x = card()
    s = subtask(x)
    load(c, x)
    c.repo.get_subtask.return_value = s
    c.policy.can_check_subtask.return_value = True
    c.policy.can_edit_item.return_value = True
    cards.update_subtask(actor(), str(s.id), {"is_done": True})
    assert s.is_done is True
    c.notif.notify_assignee.assert_called_once()
    cards.update_subtask(actor(), str(s.id), {"title": " Ship ", "order": 7})
    assert (s.title, s.order) == ("Ship", 7.0)
    for bad in ({"title": ""}, {"is_done": "yes"}, {"order": True}):
        with pytest.raises(ValidationError):
            cards.update_subtask(actor(), str(s.id), bad)
    c.policy.can_edit_item.return_value = False
    with pytest.raises(Forbidden):
        cards.update_subtask(actor(), str(s.id), {"title": "x"})
    c.repo.get_subtask.return_value = None
    with pytest.raises(NotFound):
        cards.update_subtask(actor(), str(s.id), {"is_done": True})


def test_reorder_subtasks(c):
    x = card()
    s, a, b = subtask(x, order=9.0), subtask(x, order=1.0), subtask(x, order=1.0)
    c.repo.subtasks_of.return_value = [s, a, b]
    cards.reorder_subtasks(s, {"prev": str(a.id), "next": str(b.id)})
    assert (a.order, b.order, s.order) == (1.0, 2.0, 1.5)
    with pytest.raises(ValidationError):
        cards.reorder_subtasks(s, {"prev": str(new_id())})
    load(c, x)
    c.repo.get_subtask.return_value = s
    c.policy.can_edit_item.return_value = True
    cards.update_subtask(actor(), str(s.id), {"next": str(a.id)})
    assert s.order < a.order


def test_delete_subtask(c):
    x = card()
    s = subtask(x)
    load(c, x)
    c.repo.get_subtask.return_value = s
    c.policy.can_edit_item.return_value = True
    cards.delete_subtask(actor(), str(s.id))
    c.repo.delete_subtask.assert_called_once_with(s)


# ---- attachments --------------------------------------------------------------------------------------------------

class Upload:
    def __init__(self, filename, mimetype):
        self.filename, self.mimetype, self.saved = filename, mimetype, None

    def save(self, path):
        self.saved = path
        open(path, "wb").close()


def test_add_a_link_or_a_file(c, ctx):
    x = card()
    load(c, x)
    c.policy.can_add_item.return_value = True
    c.repo.add_attachment.return_value = row(id=new_id(), name="doc")
    cards.add_attachment(actor(), str(x.id), {"url": "https://example.com/a "}, None)
    assert c.repo.add_attachment.call_args.kwargs["url"] == "https://example.com/a"
    with pytest.raises(ValidationError):
        cards.add_attachment(actor(), str(x.id), {"url": "ftp://x"}, None)
    up = Upload("Brief.PDF", "application/pdf")
    cards.add_attachment(actor(), str(x.id), {}, up)
    assert up.saved.endswith(".pdf") and c.repo.add_attachment.call_args.kwargs["mime_type"] == "application/pdf"
    with pytest.raises(ValidationError):
        cards.add_attachment(actor(), str(x.id), {}, Upload("x.exe", "application/octet-stream"))


def test_delete_attachment_removes_the_file(c, ctx, tmp_path):
    x = card()
    load(c, x)
    att = row(id=new_id(), card_id=x.id, name="a.pdf", file_path="stored.pdf", url=None, created_by_id=None)
    c.repo.get_attachment.return_value = att
    c.policy.can_edit_item.return_value = True
    cards.delete_attachment(actor(), str(att.id))  # the file is already gone: no error
    c.repo.delete_attachment.assert_called_once_with(att)
    c.repo.get_attachment.return_value = None
    with pytest.raises(NotFound):
        cards.delete_attachment(actor(), str(att.id))


def test_attachment_url(c, ctx):
    x = card()
    load(c, x)
    link = row(id=new_id(), card_id=x.id, name="a", file_path=None, url="https://e.x", mime_type=None, created_by_id=None)
    c.repo.get_attachment.return_value = link
    assert cards.attachment_url(actor(), str(link.id)) == {"file_url": "https://e.x", "expires_at": None}
    link.file_path = "f.pdf"
    out = cards.attachment_url(actor(), str(link.id))
    assert "/attachments/" in out["file_url"] and out["expires_at"]


def test_attachment_file_path_checks_the_signature_and_share_scope(c, ctx):
    from app.common.signing import share_scope, sign_file_url

    x = card()
    att = row(id=new_id(), card_id=x.id, file_path="f.pdf")
    c.repo.get_attachment.return_value = att
    c.repo.get_card.return_value = x
    path, exp = sign_file_url(att.id, NOW)
    sig = path.split("sig=")[1]
    full, found = cards.attachment_file_path(str(att.id), exp, sig)
    assert full.endswith("f.pdf") and found is att
    with pytest.raises(Forbidden):
        cards.attachment_file_path(str(att.id), exp, "bad")
    c.board.share_token = "tok"
    scope = share_scope("tok")
    path, exp = sign_file_url(att.id, NOW, scope=scope)
    sig = path.split("sig=")[1].split("&")[0]
    assert cards.attachment_file_path(str(att.id), exp, sig, scope)[1] is att
    c.board.share_token = None
    with pytest.raises(Forbidden):
        cards.attachment_file_path(str(att.id), exp, sig, scope)
    att.file_path = None
    path, exp = sign_file_url(att.id, NOW)
    with pytest.raises(NotFound):
        cards.attachment_file_path(str(att.id), exp, path.split("sig=")[1])


# ---- listing and My Tasks -----------------------------------------------------------------------------------------

def test_parse_filters():
    assert cards.parse_archived({}) is False and cards.parse_archived({"archived": "true"}) is True
    with pytest.raises(ValidationError):
        cards.parse_archived({"archived": "yes"})
    uid = new_id()
    out = cards.parse_card_filters({"search": " fix ", "archived": "false", "filter[priority]": "high", "filter[assignee]": str(uid), "filter[category]": str(uid)})
    assert out == {"search": "fix", "priority": "high", "assignee": uid, "category": uid}
    for bad in ({"filter[priority]": "urgent"}, {"filter[assignee]": "x"}, {"filter[category]": "x"}, {"filter[colour]": "red"}):
        with pytest.raises(ValidationError):
            cards.parse_card_filters(bad)


def test_list_board_cards(c):
    board = row(id=new_id())
    c.boards.load_board.return_value = board
    col = row(id=new_id(), name="Todo")
    x = card(column_id=col.id, end_date=date(2026, 11, 26))
    c.repo.list_for_board.return_value = [x]
    c.boards_repo.list_columns.return_value = [col]
    c.users.identities.return_value = {}
    out = cards.list_board_cards(actor(), str(board.id), {})
    assert out[0]["id"] == str(x.id) and out[0]["due_state"] == "overdue"


def test_group_key():
    today = date(2026, 11, 25)  # a Wednesday
    assert cards.group_key(None, today) == "no_due"
    assert cards.group_key(today - timedelta(days=1), today) == "overdue"
    assert cards.group_key(today, today) == "today"
    assert cards.group_key(today + timedelta(days=1), today) == "tomorrow"
    assert cards.group_key(date(2026, 11, 29), today) == "this_week"
    assert cards.group_key(date(2026, 11, 30), today) == "later"


def test_my_cards_groups_and_orders_and_refuses_staff(c):
    def mine(end, priority):
        return row(id=new_id(), title="t", board_id=new_id(), slug="s", board_name="B", priority=priority, end_date=end, category_id=None, category_name=None, color=None)

    late_low, late_high, none = mine(date(2026, 11, 20), "low"), mine(date(2026, 11, 20), "high"), mine(None, "medium")
    c.repo.assigned_open.return_value = [late_low, none, late_high]
    out = cards.my_cards(actor("member"))
    assert out["today"] == "2026-11-27"
    assert [g["key"] for g in out["groups"]] == ["overdue", "no_due"]
    assert [x["id"] for x in out["groups"][0]["cards"]] == [str(late_high.id), str(late_low.id)]
    with pytest.raises(Forbidden):
        cards.my_cards(actor("manager"))


# ---- DTO ----------------------------------------------------------------------------------------------------------

def test_validate_card_fields():
    out = dto.validate_card_fields({"title": " T ", "description": "<p>d</p>", "priority": "low", "start_date": "2026-01-01", "end_date": None}, partial=False)
    assert out == {"title": "T", "description": "<p>d</p>", "priority": "low", "start_date": date(2026, 1, 1), "end_date": None}
    assert dto.validate_card_fields({}, partial=True) == {}
    for bad in ({"title": ""}, {"title": "x" * 256}, {"description": 1}, {"priority": "urgent"}, {"end_date": "tomorrow"}):
        with pytest.raises(ValidationError):
            dto.validate_card_fields(bad, partial=True)
    with pytest.raises(ValidationError):
        dto.validate_card_fields({"description": "<p>" + "a" * dto.MAX_DESCRIPTION_HTML + "</p>"}, partial=True)
    with pytest.raises(ValidationError):
        dto.check_dates(date(2026, 1, 2), date(2026, 1, 1))
    dto.check_dates(None, date(2026, 1, 1))


def test_progress():
    subs = [row(is_done=True), row(is_done=False), row(is_done=False)]
    assert dto.derive_progress(subs) == (3, 1, 3)
    assert dto.progress_fields([]) == {"progress": None, "subtask_done_count": 0, "subtask_total_count": 0}


def test_item_can_edit():
    m = actor("member")
    assert dto.item_can_edit(None, None, None) is False
    assert dto.item_can_edit(actor("supervisor"), None, None) is True
    assert dto.item_can_edit(m, m.id, m.id) is True
    assert dto.item_can_edit(m, new_id(), m.id) is False


def test_serialize_card_hides_comments_and_activity_from_guests(ctx):
    owner = new_id()
    s = row(id=new_id(), card_id=new_id(), title="s", is_done=True, order=1.0, created_by_id=owner)
    a = row(id=new_id(), card_id=s.card_id, name="f", mime_type="application/pdf", url=None, file_path="f.pdf", created_by_id=None)
    x = card(assignee_id=owner, start_date=date(2026, 1, 1))
    ident = row(full_name="Ann", is_active=True, is_available=False)
    viewer = actor("manager")
    full = dto.serialize_card(x, viewer, [s], [a], comments=[], activity=[], idents={owner: ident}, urls={owner: "/u"})
    assert full["assignee_name"] == "Ann" and full["assignee_is_available"] is False and full["comments"] == [] and full["activity"] == []
    assert full["subtasks"][0]["created_by_id"] == str(owner) and full["attachments"][0]["file_url"]
    guest = dto.serialize_card(x, None, comments=[1], activity=[1])
    assert "comments" not in guest and "activity" not in guest and guest["assignee_name"] is None
