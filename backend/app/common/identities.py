"""People as other users see them: name and avatar, never the email (V10, Decision U)."""
from dataclasses import dataclass
from uuid import UUID

from app.common.signing import avatar_url


@dataclass(frozen=True)
class Identity:
    full_name: str
    avatar_path: str | None
    is_active: bool = True
    is_available: bool = True


def avatar_urls(identities: dict[UUID, Identity], now) -> dict[UUID, str | None]:
    """One signature per distinct user per response; no database access."""
    return {uid: (avatar_url(uid, now) if i.avatar_path else None) for uid, i in identities.items()}
