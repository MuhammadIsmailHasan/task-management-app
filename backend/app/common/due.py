"""One rule for "overdue" and "due tomorrow" (V17, VIEW-08): the Card payload, My Tasks, and the Dashboard all use it."""
from datetime import timedelta

DONE = "Done"


def due_state(end_date, column_name, today):
    """`overdue` when `end_date` is before `today`, `due_tomorrow` when it is the day after, else None.

    Always None for a Card in the Done column or without an `end_date`. `today` is a date in APP_TIMEZONE.
    """
    if end_date is None or column_name == DONE:
        return None
    if end_date < today:
        return "overdue"
    if end_date == today + timedelta(days=1):
        return "due_tomorrow"
    return None
