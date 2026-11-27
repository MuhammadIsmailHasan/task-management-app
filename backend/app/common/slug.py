import re

_STRIP = re.compile(r"[^a-z0-9]")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_SUFFIX_TRIES = 5


def slugify(name):
    words = (_STRIP.sub("", word) for word in (name or "").lower().split())
    return "-".join(w for w in words if w) or "board"


def pick_free(base, taken):
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def is_valid_slug(value):
    return bool(value) and len(value) <= 300 and bool(SLUG_RE.match(value))
