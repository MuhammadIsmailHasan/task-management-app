import uuid
from types import SimpleNamespace


def new_id():
    return uuid.uuid4()


def actor(role="member", id_=None):
    return SimpleNamespace(id=str(id_ or new_id()), role=role)


def row(**fields):
    return SimpleNamespace(**fields)
