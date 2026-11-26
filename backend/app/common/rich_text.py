"""Rich text from the TinyMCE editor (round 6 within V18): one allowlist, applied on every write.

The Frontend sends HTML; the Backend keeps only these tags and attributes, so a description can never carry a script,
a style, an event handler, or a `javascript:` link. `to_text` gives the plain words for length limits and previews.
"""
import html
import re

import nh3

TAGS = {"p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "a", "h2", "h3", "blockquote", "code", "pre"}
ATTRIBUTES = {"a": {"href", "title"}}
URL_SCHEMES = {"http", "https", "mailto"}


def clean_html(value):
    """The sanitised HTML, or None when nothing readable is left (an empty editor sends `<p></p>`)."""
    if value is None:
        return None
    cleaned = nh3.clean(value, tags=TAGS, attributes=ATTRIBUTES, url_schemes=URL_SCHEMES, link_rel="noopener noreferrer nofollow").strip()
    return cleaned if to_text(cleaned) else None


def to_text(value):
    """The visible words of an HTML fragment, whitespace collapsed."""
    if not value:
        return ""
    text = nh3.clean(re.sub(r"<(br|/p|/li|/h[23]|/blockquote|/pre)\b[^>]*>", " ", value), tags=set())
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def from_plain_text(value):
    """An older plain-text description as HTML: escaped, one paragraph, line breaks kept."""
    if value is None or not value.strip():
        return None
    return "<p>" + html.escape(value.strip()).replace("\n", "<br>") + "</p>"
