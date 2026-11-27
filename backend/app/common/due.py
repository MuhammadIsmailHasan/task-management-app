from datetime import timedelta

DONE = "Done"


def due_state(end_date, column_name, today):
    if end_date is None or column_name == DONE:
        return None
    if end_date < today:
        return "overdue"
    if end_date == today + timedelta(days=1):
        return "due_tomorrow"
    return None
