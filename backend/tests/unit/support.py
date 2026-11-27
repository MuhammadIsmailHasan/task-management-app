"""Plain helpers for the unit suite (fixtures live in conftest.py)."""
import uuid
from types import SimpleNamespace


def new_id():
    return uuid.uuid4()


def actor(role="member", id_=None):
    """The authenticated caller as the services see it: a string id and a role."""
    return SimpleNamespace(id=str(id_ or new_id()), role=role)


def row(**fields):
    """A plain object standing in for a model row."""
    return SimpleNamespace(**fields)
