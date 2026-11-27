from app.blueprints.boards import service as boards


def is_assignee(actor, card):
    return actor is not None and actor.role == "member" and card.assignee_id is not None and str(card.assignee_id) == actor.id


def is_staff(actor, board):
    return actor is not None and actor.role != "member" and boards.can_write_staff(actor, board)


def can_edit_fields(actor, board):
    return is_staff(actor, board)


def can_edit_description(actor, card, board):
    return is_staff(actor, board) or is_assignee(actor, card)


def can_move(actor, card, board):
    return is_staff(actor, board) or is_assignee(actor, card)


def can_add_item(actor, card, board):
    return is_staff(actor, board) or is_assignee(actor, card)


def can_check_subtask(actor, card, board):
    return is_staff(actor, board) or is_assignee(actor, card)


def can_edit_item(actor, card, board, created_by_id):
    if is_staff(actor, board):
        return True
    return is_assignee(actor, card) and created_by_id is not None and str(created_by_id) == actor.id


def can_comment(actor, card, board):
    if actor is None or actor.role == "admin":
        return False
    if actor.role == "manager":
        return True
    if actor.role == "supervisor":
        return boards.can_write_staff(actor, board)
    return is_assignee(actor, card)
