import pytest

from app.common.errors import ValidationError
from app.common.validation import classify_identifier, is_email_shape, is_username, normalize_email, normalize_username


def test_normalise_trims_and_lowers():
    assert normalize_username("  Ann_Lee ") == "ann_lee"
    assert normalize_email(" Ann@Example.COM ") == "ann@example.com"


@pytest.mark.parametrize("value,ok", [("ann", True), ("ann.lee_1", True), ("an", False), ("a" * 31, False), ("ann lee", False), ("ann-lee", False), ("ANN", False)])
def test_username_shape(value, ok):
    assert is_username(value) is ok


@pytest.mark.parametrize("value,ok", [("a@b.co", True), ("a.b@c.d.e", True), ("a@b", False), ("a b@c.d", False), ("a@@b.c", False), ("@b.c", False), ("a@" + "b" * 250 + ".com", False)])
def test_email_shape(value, ok):
    assert is_email_shape(value) is ok


def test_classify_identifier():
    assert classify_identifier(" ANN ") == ("username", "ann")
    assert classify_identifier("Ann@Example.com") == ("email", "ann@example.com")
    for bad in ("not an email@", "a@b", "x"):
        with pytest.raises(ValidationError) as err:
            classify_identifier(bad)
        assert "identifier" in err.value.details
