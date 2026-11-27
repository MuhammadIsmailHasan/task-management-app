"""Unit tests of the Card permission matrix (PERM-02): plain objects, the Board access check faked."""
from types import SimpleNamespace

import pytest

from app.common import card_policy as policy

CARD = SimpleNamespace(assignee_id="m1")
BOARD = SimpleNamespace(id="b1")


@pytest.fixture(autouse=True)
def staff_access(monkeypatch):
    # Board_Staff_Access: a Manager and an Admin always; a Supervisor only when on the Board (here: "s1")
    monkeypatch.setattr(policy.boards, "can_write_staff", lambda actor, board: actor.role in ("manager", "admin") or actor.id == "s1")


def actor(role, id_):
    return SimpleNamespace(role=role, id=id_)


ASSIGNEE, OTHER = actor("member", "m1"), actor("member", "m2")
SUP_ON, SUP_OFF, MANAGER, ADMIN = actor("supervisor", "s1"), actor("supervisor", "s2"), actor("manager", "g1"), actor("admin", "a1")


@pytest.mark.parametrize(
    "who,fields,desc,move,add,check,comment",
    [
        (MANAGER, True, True, True, True, True, True),
        (ADMIN, True, True, True, True, True, False),  # an Admin never comments (Decision B)
        (SUP_ON, True, True, True, True, True, True),
        (SUP_OFF, False, False, False, False, False, False),
        (ASSIGNEE, False, True, True, True, True, True),
        (OTHER, False, False, False, False, False, False),
    ],
)
def test_matrix(who, fields, desc, move, add, check, comment):
    assert policy.can_edit_fields(who, BOARD) is fields
    assert policy.can_edit_description(who, CARD, BOARD) is desc
    assert policy.can_move(who, CARD, BOARD) is move
    assert policy.can_add_item(who, CARD, BOARD) is add
    assert policy.can_check_subtask(who, CARD, BOARD) is check
    assert policy.can_comment(who, CARD, BOARD) is comment


def test_the_assignee_edits_only_items_they_created():
    assert policy.can_edit_item(ASSIGNEE, CARD, BOARD, "m1") is True
    assert policy.can_edit_item(ASSIGNEE, CARD, BOARD, "s1") is False
    assert policy.can_edit_item(ASSIGNEE, CARD, BOARD, None) is False  # rows from before V18
    assert policy.can_edit_item(OTHER, CARD, BOARD, "m2") is False
    assert policy.can_edit_item(SUP_ON, CARD, BOARD, None) is True
    assert policy.can_comment(None, CARD, BOARD) is False
