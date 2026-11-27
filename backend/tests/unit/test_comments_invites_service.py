"""Unit tests of the comments and invites services: repositories, Board checks, and notifications mocked."""
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError

from app.blueprints.comments import service as comments
from app.blueprints.invites import service as invites
from app.common.errors import Conflict, Forbidden, NotFound, ValidationError
from tests.unit.support import actor, new_id, row


# ---- comments ----------------------------------------------------------------------------------------------------

def comment(card_id, **over):
    base = dict(id=new_id(), card_id=card_id, author_id=new_id(), parent_id=None, content="hi", is_priority=False, reply_count=0, created_at=datetime(2026, 1, 1, tzinfo=timezone.utc), replies=[])
    return row(**{**base, **over})


@pytest.fixture
def cm(stub, session, ctx):
    card = row(id=new_id(), title="Fix", assignee_id=None)
    cards_repo = stub(comments, "cards_repo")
    cards_repo.get_card.return_value = card
    policy = stub(comments, "policy")
    policy.can_comment.return_value = True
    return SimpleNamespace(repo=stub(comments, "repo"), cards_repo=cards_repo, boards=stub(comments, "boards"), boards_repo=stub(comments, "boards_repo"), activity=stub(comments, "activity"), notifications=stub(comments, "notifications"), policy=policy, card=card, session=session)


def test_create_comment_trims_and_notifies(cm):
    made = comment(cm.card.id)
    cm.repo.add.return_value = made
    assert comments.create_comment(actor(), str(cm.card.id), {"content": "  hi "}) is made
    assert cm.repo.add.call_args.args[2] == "hi"
    cm.notifications.notify_assignee.assert_called_once()
    with pytest.raises(ValidationError):
        comments.create_comment(actor(), str(cm.card.id), {"content": " "})
    cm.policy.can_comment.return_value = False
    with pytest.raises(Forbidden):
        comments.create_comment(actor("admin"), str(cm.card.id), {"content": "x"})
    cm.cards_repo.get_card.return_value = None
    with pytest.raises(NotFound):
        comments.create_comment(actor(), "bad", {"content": "x"})


def test_reply_counts_and_stops_at_one_level(cm):
    parent = comment(cm.card.id, reply_count=None)
    cm.repo.get.return_value = parent
    cm.repo.add.return_value = comment(cm.card.id, parent_id=parent.id)
    comments.reply(actor(), str(parent.id), {"content": "yes"})
    assert parent.reply_count == 1
    parent.parent_id = new_id()
    with pytest.raises(ValidationError):
        comments.reply(actor(), str(parent.id), {"content": "deeper"})
    cm.repo.get.return_value = None
    with pytest.raises(NotFound):
        comments.reply(actor(), str(parent.id), {"content": "x"})


def test_delete_comment_author_only_with_replies(cm):
    who = actor()
    top = comment(cm.card.id, author_id=who.id)
    cm.repo.get.return_value = top
    cm.repo.delete_replies.return_value = 2
    assert comments.delete_comment(who, str(top.id)) == {"deleted": 3}
    parent = comment(cm.card.id, reply_count=1)
    answer = comment(cm.card.id, author_id=who.id, parent_id=parent.id)
    cm.repo.get.side_effect = lambda cid: {answer.id: answer, parent.id: parent}.get(cid)
    assert comments.delete_comment(who, str(answer.id)) == {"deleted": 1}
    assert parent.reply_count == 0
    with pytest.raises(Forbidden):
        comments.delete_comment(actor(), str(answer.id))
    with pytest.raises(NotFound):
        comments.delete_comment(who, str(new_id()))


def test_toggle_priority(cm):
    c = comment(cm.card.id)
    cm.repo.get.return_value = c
    assert comments.toggle_priority(actor("manager"), str(c.id)).is_priority is True
    cm.repo.get.return_value = None
    with pytest.raises(NotFound):
        comments.toggle_priority(actor("manager"), str(c.id))


def test_serialize_and_listing(cm):
    manager_id = new_id()
    reply_row = comment(cm.card.id)
    top = comment(cm.card.id, author_id=manager_id, replies=[reply_row])
    cm.repo.list_for_card.return_value = ([top], {manager_id: "manager"})
    cm.repo.author_identities.return_value = {manager_id: row(full_name="Mia", avatar_path=None)}
    cm.repo.count_top_level.return_value = 7
    page = comments.list_for_request(actor("supervisor"), str(cm.card.id), None, limit=5)
    item = page["items"][0]
    assert page["total"] == 7 and item["author_name"] == "Mia" and item["can_create_card"] is True and len(item["replies"]) == 1
    with pytest.raises(ValidationError):
        comments.list_comments(cm.card, actor(), "oldest")
    one = comments.serialize_one(comment(cm.card.id, created_at=None), "member")
    assert one["created_at"] is None and one["can_create_card"] is False and "replies" not in one


# ---- invites -----------------------------------------------------------------------------------------------------

@pytest.fixture
def inv(stub, session, ctx):
    board = row(id=new_id(), slug="alpha", name="Alpha", description=None, owner_id=None, invite_token=None)
    boards = stub(invites, "boards")
    boards.load_board.return_value = board
    boards.is_owner.return_value = False
    boards_repo = stub(invites, "boards_repo")
    boards_repo.is_member.return_value = False
    boards_repo.get_by_id.return_value = board
    repo = stub(invites, "repo")
    repo.board_by_invite_token.return_value = board
    repo.get_pending.return_value = None
    return SimpleNamespace(repo=repo, boards=boards, boards_repo=boards_repo, users=stub(invites, "users"), activity=stub(invites, "activity"), notifications=stub(invites, "notifications"), board=board, session=session)


def test_invite_link_lifecycle(inv):
    m = actor("manager")
    assert invites.get_invite(m, "b")["enabled"] is False
    on = invites.enable(m, "b")
    assert on["path"] == f"/app/invite/{inv.board.invite_token}"
    assert invites.enable(m, "b") == on
    assert invites.regenerate(m, "b")["token"] != on["token"]
    assert invites.disable(m, "b")["enabled"] is False
    assert invites.disable(m, "b")["token"] is None
    with pytest.raises(Forbidden):
        invites.get_invite(actor("supervisor"), "b")


def test_resolve_states(inv):
    assert invites.resolve(actor("admin"), "t")["state"] == "staff"
    assert invites.resolve(actor(), "t")["state"] == "can_request"
    inv.repo.get_pending.return_value = row(id=new_id(), status="pending")
    out = invites.resolve(actor(), "t")
    assert out["state"] == "pending" and out["request"]["status"] == "pending"
    inv.boards_repo.is_member.return_value = True
    assert invites.resolve(actor(), "t")["state"] == "member"
    inv.repo.board_by_invite_token.return_value = None
    with pytest.raises(NotFound):
        invites.resolve(actor(), "gone")


def test_create_request_notifies_staff_and_owner(inv):
    owner = new_id()
    inv.board.owner_id = owner
    req = row(id=new_id(), status="pending", created_at="now")
    inv.repo.add_request.return_value = req
    inv.repo.staff_ids.return_value = [new_id()]
    out = invites.create_request(actor(), "t")
    assert out["status"] == "pending" and inv.notifications.add_board.call_count == 2
    with pytest.raises(ValidationError):
        invites.create_request(actor("manager"), "t")
    inv.repo.add_request.side_effect = IntegrityError("insert", {}, Exception())
    with pytest.raises(Conflict):
        invites.create_request(actor(), "t")
    inv.session.rollback.assert_called_once()
    inv.repo.get_pending.return_value = row()
    with pytest.raises(Conflict):
        invites.create_request(actor(), "t")


def test_list_requests(inv):
    uid = new_id()
    inv.repo.list_for_board.return_value = [row(id=new_id(), status="pending", created_at="now", user_id=uid, full_name="Ann", username="ann", email="a@x.co", avatar_path=None)]
    out = invites.list_requests(actor("manager"), "b")
    assert out[0]["user"] == {"id": str(uid), "full_name": "Ann", "username": "ann", "email": "a@x.co", "avatar_url": None}


def test_decide(inv, stub):
    req = row(id=new_id(), board_id=inv.board.id, user_id=new_id(), status="pending", created_at="now", decided_by=None)
    inv.repo.get_request_for_update.return_value = req
    assert invites.decide(actor("manager"), str(req.id), "approved")["status"] == "approved"
    inv.boards.add_member_row.assert_called_once()
    with pytest.raises(Conflict):
        invites.decide(actor("manager"), str(req.id), "rejected")
    req.status = "pending"
    invites.decide(actor("manager"), str(req.id), "rejected")
    inv.notifications.add_board.assert_called_once()
    inv.boards_repo.get_by_id.return_value = None
    with pytest.raises(NotFound):
        invites.decide(actor("manager"), str(req.id), "approved")
    inv.repo.get_request_for_update.return_value = None
    with pytest.raises(NotFound):
        invites.decide(actor("manager"), str(req.id), "approved")
