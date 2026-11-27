import html
import re

import nh3

TAGS = {"p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "a", "h2", "h3", "blockquote", "code", "pre"}
ATTRIBUTES = {"a": {"href", "title"}}
URL_SCHEMES = {"http", "https", "mailto"}


def clean_html(value):
    if value is None:
        return None
    cleaned = nh3.clean(value, tags=TAGS, attributes=ATTRIBUTES, url_schemes=URL_SCHEMES, link_rel="noopener noreferrer nofollow").strip()
    return cleaned if to_text(cleaned) else None


def to_text(value):
    if not value:
        return ""
    text = nh3.clean(re.sub(r"<(br|/p|/li|/h[23]|/blockquote|/pre)\b[^>]*>", " ", value), tags=set())
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def from_plain_text(value):
    if value is None or not value.strip():
        return None
    return "<p>" + html.escape(value.strip()).replace("\n", "<br>") + "</p>"
