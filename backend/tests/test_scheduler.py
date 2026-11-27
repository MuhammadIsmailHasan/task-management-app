class Stop:
    def __init__(self, rounds):
        self.rounds, self.waits = rounds, []

    def is_set(self):
        return len(self.waits) >= self.rounds

    def wait(self, seconds):
        self.waits.append(seconds)


def test_scheduler_runs_at_once_then_every_fifteen_minutes(app, monkeypatch):
    from app.jobs import due

    calls = []
    monkeypatch.setattr(due, "run", lambda: calls.append(1) or (0, 0, 0))
    stop = Stop(3)
    due.run_forever(stop)
    assert len(calls) == 3 and stop.waits == [900] * 3


def test_scheduler_survives_a_failed_run(app, monkeypatch):
    from app.jobs import due

    calls = []

    def flaky():
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("database restarting")
        return (0, 0, 0)

    monkeypatch.setattr(due, "run", flaky)
    stop = Stop(2)
    due.run_forever(stop)
    assert len(calls) == 2
