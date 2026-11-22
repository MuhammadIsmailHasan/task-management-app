"""The deadline scheduler (Requirement 33, criterion 9)."""


class Stop:
    """An Event that stops after `rounds` waits."""

    def __init__(self, rounds):
        self.rounds, self.waits = rounds, []

    def is_set(self):
        return len(self.waits) >= self.rounds

    def wait(self, seconds):
        self.waits.append(seconds)


def test_scheduler_runs_at_once_then_hourly(app, monkeypatch):
    from app.jobs import deadlines

    calls = []
    monkeypatch.setattr(deadlines, "run", lambda: calls.append(1) or 0)
    stop = Stop(3)
    deadlines.run_forever(stop)
    assert len(calls) == 3 and stop.waits == [3600] * 3


def test_scheduler_survives_a_failed_run(app, monkeypatch):
    from app.jobs import deadlines

    calls = []

    def flaky():
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("database restarting")
        return 0

    monkeypatch.setattr(deadlines, "run", flaky)
    stop = Stop(2)
    deadlines.run_forever(stop)
    assert len(calls) == 2
