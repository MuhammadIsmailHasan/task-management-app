import pytest

from app.common.rich_text import clean_html, from_plain_text, to_text
from helpers import Env


@pytest.mark.parametrize(
    "dirty,clean",
    [
        ("<p>Hi <strong>there</strong></p>", "<p>Hi <strong>there</strong></p>"),
        ("<p onclick=\"x()\">a</p><script>alert(1)</script>", "<p>a</p>"),
        ('<a href="javascript:alert(1)">x</a>', "<a rel=\"noopener noreferrer nofollow\">x</a>"),
        ('<img src=x onerror=alert(1)><p style="color:red">t</p>', "<p>t</p>"),
        ("<p></p>", None),
        ("plain <b>bold</b>", "plain bold"),
    ],
)
def test_clean_html_keeps_the_allowlist_only(dirty, clean):
    assert clean_html(dirty) == clean


def test_text_and_plain_conversion():
    assert to_text("<p>One</p><ul><li>two</li></ul>") == "One two"
    assert from_plain_text("a < b\nc") == "<p>a &lt; b<br>c</p>"
    assert from_plain_text("  ") is None


def test_card_and_board_descriptions_are_sanitised_on_write(client):
    env = Env(client)
    card = env.card()
    r = client.patch(f"/api/cards/{card['id']}", headers=env.h["owner"], json={"description": "<p>ok</p><script>bad()</script>"})
    assert r.get_json()["data"]["description"] == "<p>ok</p>"
    r = client.patch(f"/api/boards/{env.bid}", headers=env.h["manager"], json={"description": "<h2>Goal</h2><iframe src=x></iframe>"})
    assert r.status_code == 200
    board = client.get(f"/api/boards/{env.bid}", headers=env.h["manager"]).get_json()["data"]
    assert board["description"] == "<h2>Goal</h2>"
    long = "<p>" + "x" * 501 + "</p>"
    assert client.patch(f"/api/boards/{env.bid}", headers=env.h["manager"], json={"description": long}).status_code == 400
    assert client.patch(f"/api/boards/{env.bid}", headers=env.h["manager"], json={"description": "<p>" + "x" * 500 + "</p>"}).status_code == 200
