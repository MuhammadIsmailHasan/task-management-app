"""Board slugs (V17, Requirement 48): a readable, unique, lower-case ASCII name for a Board's URL."""
import re

_STRIP = re.compile(r"[^a-z0-9]")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_SUFFIX_TRIES = 5


def slugify(name):
    """Lower-case, split on white space, drop every character outside a-z and 0-9, drop empty words, join with `-`.

    "Q3 Launch Plan" gives `q3-launch-plan`; "Café Board" gives `caf-board`; a name with no letters or digits gives `board`.
    """
    words = (_STRIP.sub("", word) for word in (name or "").lower().split())
    return "-".join(w for w in words if w) or "board"


def pick_free(base, taken):
    """`base` when it is free, else `base-2`, `base-3`, ... with the lowest free number from 2."""
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def is_valid_slug(value):
    """A path value that can be a slug at all: only a-z, 0-9 and single hyphens between words."""
    return bool(value) and len(value) <= 300 and bool(SLUG_RE.match(value))
