from app.common import clock
from app.common.identities import Identity
from app.extensions import db
from app.models import User


def get_by_username(username):
    return User.query.filter(db.func.lower(User.username) == username.lower()).first()


def get_by_email(email):
    return User.query.filter(db.func.lower(User.email) == email.lower()).first()


def identities(user_ids):
    """id -> Identity for these users in one query. Columns only, so the email is never loaded."""
    ids = {i for i in user_ids if i is not None}
    if not ids:
        return {}
    rows = db.session.execute(db.select(User.id, User.full_name, User.avatar_path, User.is_active, User.is_available).where(User.id.in_(ids))).all()
    return {r.id: Identity(r.full_name, r.avatar_path, r.is_active, r.is_available) for r in rows}


def get_by_id(user_id):
    return db.session.get(User, user_id) if user_id is not None else None


def create_user(full_name, username, email, password_hash, role="member", verified=False):
    user = User(full_name=full_name, username=username, email=email, password_hash=password_hash, role=role, email_verified_at=clock.now() if verified else None)
    db.session.add(user)
    db.session.flush()
    return user
