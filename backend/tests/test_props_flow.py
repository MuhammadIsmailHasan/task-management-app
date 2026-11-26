"""Properties 15, 16, 22-33, 35 (ordering, move, comments, activity, notifications, analytics, search)."""
import uuid
from datetime import date, datetime, timedelta, timezone

from hypothesis import given, strategies as st

from app.common import ordering
from app.extensions import db
from app.models import ActivityLog, Card, Comment, Notification
from helpers import PROP, UUID0, Env, Ticker, hdr, mkuser

# ---- Property 15: drop order and rebalance ----
@PROP
@given(inserts=st.lists(st.integers(0, 50), min_size=1, max_size=80))
def test_property_15_drop_order_and_rebalance(inserts):
    items = []  # orders, kept sorted by position, ids are the insertion index
    order = []
    for i, pos in enumerate(inserts):
        pos = pos % (len(order) + 1)
        prev = order[pos - 1][1] if pos > 0 else None
        nxt = order[pos][1] if pos < len(order) else None
        if ordering.needs_rebalance(prev, nxt):
            for j, v in enumerate(ordering.rebalance([o for _, o in order])):
                order[j] = (order[j][0], v)
            prev = order[pos - 1][1] if pos > 0 else None
            nxt = order[pos][1] if pos < len(order) else None
        new = ordering.position_for(prev, nxt, [o for _, o in order])
        order.insert(pos, (i, new))
        vals = [o for _, o in order]
        assert vals == sorted(vals) and len(set(vals)) == len(vals)
    assert ordering.position_for(None, None, []) == 1.0


# ---- Property 16 and 11 (move part): move persists, logs once, stays on the board ----
@PROP
@given(ops=st.lists(st.tuples(st.integers(0, 3), st.integers(0, 4), st.integers(0, 9)), min_size=1, max_size=25))
def test_property_16_move_persists_logs_once(client, ops):
    env = Env(client)
    cards = [env.card(title=f"c{i}")["id"] for i in range(4)]
    model = {i: [] for i in range(5)}
    model[0] = list(cards)
    for ci, col, pos in ops:
        cid = cards[ci]
        for lst in model.values():
            if cid in lst:
                lst.remove(cid)
        pos %= len(model[col]) + 1
        prev = model[col][pos - 1] if pos > 0 else None
        nxt = model[col][pos] if pos < len(model[col]) else None
        log_before = ActivityLog.query.filter_by(action="card.moved", target_id=uuid.UUID(cid)).count()
        r = client.patch(f"/api/cards/{cid}/move", headers=env.h["manager"], json={"column_id": env.cols[col], "prev": prev, "next": nxt, "order": 12345})
        assert r.status_code == 200
        model[col].insert(pos, cid)
        assert ActivityLog.query.filter_by(action="card.moved", target_id=uuid.UUID(cid)).count() == log_before + 1
    listed = client.get(f"/api/boards/{env.bid}/cards", headers=env.h["manager"]).get_json()["data"]
    for col in range(5):
        got = [c["id"] for c in listed if c["column_id"] == env.cols[col]]
        assert got == model[col]
    other = client.post("/api/boards", headers=env.h["manager"], json={"name": "O"}).get_json()["data"]
    r = client.patch(f"/api/cards/{cards[0]}/move", headers=env.h["manager"], json={"column_id": other["columns"][0]["id"]})
    assert r.status_code == 400


@PROP
@given(assigned=st.booleans(), actor=st.sampled_from(["member", "member_other", "owner", "sup_other", "manager"]))
def test_property_11_member_move_scope(client, assigned, actor):
    env = Env(client)
    card = env.card(assignee_id=env.uid("member") if assigned else None)
    r = client.patch(f"/api/cards/{card['id']}/move", headers=env.h[actor], json={"column_id": env.cols[1]})
    expected = {"member": assigned, "member_other": False, "owner": True, "sup_other": False, "manager": True}[actor]
    assert r.status_code == (200 if expected else 403)
    assert client.patch(f"/api/cards/{card['id']}/move", json={"column_id": env.cols[1]}).status_code == 401


# ---- Property 22-27: comments ----
@PROP
@given(content=st.one_of(st.text(alphabet=" \t\n", max_size=5), st.text(min_size=1, max_size=40).filter(lambda s: s.strip())))
def test_property_22_blank_comments_rejected(client, content):
    env = Env(client)
    card = env.card()
    r = client.post(f"/api/cards/{card['id']}/comments", headers=env.h["member"], json={"content": content})
    if content.strip():
        assert r.status_code == 201
    else:
        assert r.status_code == 400 and r.get_json()["error"]["details"]["content"][0] == "content is required"
        assert Comment.query.count() == 0
    assert client.post(f"/api/cards/{card['id']}/comments", headers=env.h["admin"], json={"content": "x"}).status_code == 403
    assert client.post(f"/api/cards/{card['id']}/comments", json={"content": "x"}).status_code == 401


@PROP
@given(replies=st.lists(st.integers(0, 3), max_size=12))
def test_property_23_reply_count_and_depth_cap(client, replies):
    env = Env(client)
    card = env.card()
    tops = [client.post(f"/api/cards/{card['id']}/comments", headers=env.h["member"], json={"content": f"t{i}"}).get_json()["data"] for i in range(4)]
    counts = [0] * 4
    last = None
    for t in replies:
        r = client.post(f"/api/comments/{tops[t]['id']}/replies", headers=env.h["owner"], json={"content": "r"})
        assert r.status_code == 201
        counts[t] += 1
        last = r.get_json()["data"]
    for i, t in enumerate(tops):
        assert db.session.get(Comment, uuid.UUID(t["id"])).reply_count == counts[i]
    if last:
        assert client.post(f"/api/comments/{last['id']}/replies", headers=env.h["owner"], json={"content": "deep"}).status_code == 400


@PROP
@given(
    spec=st.lists(st.tuples(st.sampled_from(["member", "owner", "manager"]), st.integers(0, 3)), min_size=1, max_size=8),
    flags=st.lists(st.integers(0, 7), max_size=4),
    sort=st.sampled_from(["latest", "popular", None]),
    viewer=st.sampled_from(["member", "owner", "manager", "admin"]),
)
def test_property_24_to_27_comment_listing(client, spec, flags, sort, viewer):
    with Ticker():
        env = Env(client)
        card = env.card()
        tops = []
        for author, n_replies in spec:
            t = client.post(f"/api/cards/{card['id']}/comments", headers=env.h[author], json={"content": "t"}).get_json()["data"]
            tops.append([t["id"], author, n_replies, False])
        for i in {f % len(tops) for f in flags}:
            r = client.patch(f"/api/comments/{tops[i][0]}/priority", headers=env.h["manager"])
            assert r.get_json()["data"]["is_priority"] is True
            tops[i][3] = True
        for t in tops:
            for _ in range(t[2]):
                client.post(f"/api/comments/{t[0]}/replies", headers=env.h["member"], json={"content": "r"})
        url = f"/api/cards/{card['id']}/comments" + (f"?sort={sort}" if sort else "")
        got = client.get(url, headers=env.h[viewer]).get_json()["data"]
        idx = {t[0]: i for i, t in enumerate(tops)}  # creation order = time order
        prio = sorted((t for t in tops if t[3]), key=lambda t: -idx[t[0]])
        rest = [t for t in tops if not t[3]]
        rest.sort(key=(lambda t: (-t[2], -idx[t[0]])) if sort == "popular" else (lambda t: -idx[t[0]]))
        assert [c["id"] for c in got] == [t[0] for t in prio + rest]
        for c in got:
            t = tops[idx[c["id"]]]
            assert c["is_priority"] == t[3] and c["reply_count"] == t[2] and len(c["replies"]) == t[2]
            assert [r["created_at"] for r in c["replies"]] == sorted(r["created_at"] for r in c["replies"])
            assert c["can_create_card"] == (viewer in ("owner", "manager", "admin") and t[1] == "manager")
        # priority toggle round trip, Manager only
        first = tops[0][0]
        before = db.session.get(Comment, uuid.UUID(first)).is_priority
        client.patch(f"/api/comments/{first}/priority", headers=env.h["manager"])
        client.patch(f"/api/comments/{first}/priority", headers=env.h["manager"])
        assert db.session.get(Comment, uuid.UUID(first)).is_priority == before
        assert client.patch(f"/api/comments/{first}/priority", headers=env.h["owner"]).status_code == 403
        assert client.patch(f"/api/comments/{first}/priority").status_code == 401


# ---- Property 29, 30, 28: activity and guest privacy ----
@PROP
@given(ops=st.lists(st.sampled_from(["title", "priority", "move", "assign", "unassign", "archive", "unarchive", "subtask", "comment", "bad"]), min_size=1, max_size=14))
def test_property_29_one_activity_row_per_change(client, ops):
    env = Env(client)
    card = env.card()
    cid = uuid.UUID(card["id"])
    h = env.h["manager"]
    state = {"archived": False, "assigned": False, "title": 0, "col": 0}

    def count():
        return ActivityLog.query.count()

    for op in ops:
        before = count()
        if op == "title":
            state["title"] += 1
            r = client.patch(f"/api/cards/{card['id']}", headers=h, json={"title": f"n{state['title']}"})
            delta = 1
        elif op == "priority":
            cur = db.session.get(Card, cid).priority
            r = client.patch(f"/api/cards/{card['id']}", headers=h, json={"priority": "low" if cur != "low" else "high"})
            delta = 1
        elif op == "move":
            target = (state["col"] + 1) % 5
            r = client.patch(f"/api/cards/{card['id']}/move", headers=h, json={"column_id": env.cols[target]})
            if state["archived"]:  # an archived Card cannot be moved (CARD_ARCHIVED)
                assert r.status_code == 409
                delta = 0
            else:
                state["col"] = target
                delta = 1
        elif op == "assign":
            r = client.patch(f"/api/cards/{card['id']}", headers=h, json={"assignee_id": env.uid("member")})
            delta = 0 if state["assigned"] else 1
            state["assigned"] = True
        elif op == "unassign":
            r = client.patch(f"/api/cards/{card['id']}", headers=h, json={"assignee_id": None})
            delta = 1 if state["assigned"] else 0
            state["assigned"] = False
        elif op == "archive":
            r = client.post(f"/api/cards/{card['id']}/archive", headers=h)
            if state["archived"]:  # idempotent: nothing changes, nothing is logged
                delta = 0
            elif state["col"] == 4:  # the Done column (V17: CARD_IN_DONE)
                assert r.status_code == 409
                delta = 0
            else:
                state["archived"] = True
                delta = 1
        elif op == "unarchive":
            r = client.post(f"/api/cards/{card['id']}/unarchive", headers=h)
            if state["archived"]:  # a restored Card lands in the first Column (V17)
                state["archived"], state["col"] = False, 0
                delta = 1
            else:
                assert r.status_code == 409  # CARD_NOT_ARCHIVED
                delta = 0
        elif op == "subtask":
            r = client.post(f"/api/cards/{card['id']}/subtasks", headers=h, json={"title": "s"})
            delta = 1
        elif op == "comment":
            r = client.post(f"/api/cards/{card['id']}/comments", headers=h, json={"content": "c"})
            delta = 1
        else:  # a failing request must leave no row behind
            r = client.patch(f"/api/cards/{card['id']}", headers=h, json={"priority": "nope"})
            delta = 0
            assert r.status_code == 400
        assert r.status_code < 400 or op == "bad" or delta == 0 and r.status_code == 409
        assert count() - before == delta, op


@PROP
@given(n_cards=st.integers(1, 3))
def test_property_30_activity_queries_return_right_rows(client, n_cards):
    env = Env(client)
    other = client.post("/api/boards", headers=env.h["manager"], json={"name": "O"}).get_json()["data"]
    oc = client.post(f"/api/columns/{other['columns'][0]['id']}/cards", headers=env.h["manager"], json={"title": "o"}).get_json()["data"]
    cards = [env.card(title=f"c{i}") for i in range(n_cards)]
    client.post(f"/api/boards/{env.bid}/columns", headers=env.h["manager"], json={"name": "X"})
    for c in cards:
        rows = client.get(f"/api/cards/{c['id']}/activity", headers=env.h["member"]).get_json()["data"]
        assert rows and all(r["target_type"] == "card" and r["target_id"] == c["id"] for r in rows)
    board_rows = client.get(f"/api/boards/{env.bid}/activity", headers=env.h["manager"]).get_json()["data"]
    ids = {r["target_id"] for r in board_rows}
    assert {c["id"] for c in cards} <= ids and env.bid in ids and oc["id"] not in ids and other["id"] not in ids
    assert {"column.created", "card.created", "board.created"} <= {r["action"] for r in board_rows}


@PROP
@given(who=st.sampled_from(["guest", "member", "manager"]), fields=st.sampled_from(["", "?fields=comments,activity", "?include=activity"]))
def test_property_28_guest_never_sees_comments_or_activity(client, who, fields):
    env = Env(client)
    card = env.card()
    client.post(f"/api/cards/{card['id']}/comments", headers=env.h["manager"], json={"content": "c"})
    if who == "guest":
        for path in (f"/api/cards/{card['id']}", f"/api/cards/{card['id']}/comments", f"/api/cards/{card['id']}/activity", f"/api/boards/{env.bid}/activity", f"/api/boards/{env.bid}/cards"):
            r = client.get(path)
            assert r.status_code == 401 and "data" not in r.get_json()
    else:
        body = client.get(f"/api/cards/{card['id']}{fields}", headers=env.h[who]).get_json()["data"]
        assert "comments" in body and "activity" in body


# ---- Property 31, 32: notifications ----
@PROP
@given(
    cards=st.lists(st.tuples(st.integers(-2, 2), st.booleans(), st.booleans()), min_size=1, max_size=6),
    hour=st.integers(0, 23),
    tz=st.sampled_from(["UTC", "Asia/Jakarta", "America/Los_Angeles"]),
)
def test_property_31_due_job_once_in_app_timezone(client, app, cards, hour, tz):
    from zoneinfo import ZoneInfo

    from app.jobs.due import run

    app.config["APP_TIMEZONE"] = tz
    env = Env(client)
    now = datetime(2026, 6, 15, hour, 30, tzinfo=timezone.utc)
    today = now.astimezone(ZoneInfo(tz)).date()
    expected = set()
    for offset, assigned, deleted in cards:
        end = (today + timedelta(days=offset)).isoformat()
        c = env.card(end_date=end, assignee_id=env.uid("member") if assigned else None)
        if deleted:
            client.delete(f"/api/cards/{c['id']}", headers=env.h["manager"])
        if offset == 0 and assigned and not deleted:
            expected.add(c["id"])
    Notification.query.filter_by(type="assigned").delete()
    db.session.commit()
    run(now)
    run(now)
    got = {str(n.card_id) for n in Notification.query.filter_by(type="due_today").all()}
    assert got == expected and Notification.query.filter_by(type="due_today").count() == len(expected)


@PROP
@given(assign=st.lists(st.sampled_from(["member", "sup_member", "owner"]), min_size=1, max_size=6))
def test_property_32_inbox_isolation_and_read_marking(client, assign):
    env = Env(client)
    for who in assign:
        env.card(assignee_id=env.uid(who))
    for who in set(assign):
        inbox = client.get("/api/notifications", headers=env.h[who]).get_json()["data"]
        assigned = [n for n in inbox["items"] if n["type"] == "assigned"]
        assert len(assigned) == assign.count(who) and inbox["unread_count"] == assign.count(who) + 1  # + board_added
        assert all(db.session.get(Notification, uuid.UUID(n["id"])).user_id == env.users[who].id for n in inbox["items"])
    victim = next(iter(set(assign)))
    nid = client.get("/api/notifications", headers=env.h[victim]).get_json()["data"]["items"][0]["id"]
    stranger = next(w for w in ("member", "sup_member", "owner") if w != victim)
    assert client.patch(f"/api/notifications/{nid}/read", headers=env.h[stranger]).status_code == 404
    assert client.patch(f"/api/notifications/{UUID0}/read", headers=env.h[victim]).status_code == 404
    client.patch("/api/notifications/read-all", headers=env.h[stranger])
    assert client.get("/api/notifications", headers=env.h[victim]).get_json()["data"]["unread_count"] == assign.count(victim) + 1
    client.patch("/api/notifications/read-all", headers=env.h[victim])
    assert client.get("/api/notifications", headers=env.h[victim]).get_json()["data"]["unread_count"] == 0


# ---- Property 33: analytics ----
@PROP
@given(
    cards=st.lists(st.tuples(st.integers(0, 4), st.integers(-3, 3), st.booleans()), max_size=10),
    actor=st.sampled_from(["manager", "owner", "sup_member", "sup_other", "member", "admin", "guest"]),
)
def test_property_33_analytics_access_and_correctness(client, app, cards, actor):
    env = Env(client)
    today = datetime.now(timezone.utc).date()
    for col, offset, deleted in cards:
        c = env.card(col=col, end_date=(today + timedelta(days=offset)).isoformat())
        if deleted:
            client.delete(f"/api/cards/{c['id']}", headers=env.h["manager"])
    live = [(col, off) for (col, off, d) in cards if not d]
    r = client.get(f"/api/boards/{env.bid}/analytics", headers=env.h[actor])
    if actor == "guest":
        assert r.status_code == 401
    elif actor in ("manager", "owner"):
        d = r.get_json()["data"]
        assert d["total"] == len(live)
        assert d["done"] == sum(1 for col, _ in live if col == 4)
        assert d["in_progress"] == sum(1 for col, _ in live if col == 1)
        assert d["overdue"] == sum(1 for col, off in live if off < 0 and col != 4)
        assert d["done_delta"] <= d["done"]
        assert set(d) == {"board_id", "name", "total", "done", "in_progress", "overdue", "done_delta"}
    else:
        assert r.status_code == 403
    allb = client.get("/api/analytics/boards", headers=env.h[actor])
    assert allb.status_code == (200 if actor == "manager" else (401 if actor == "guest" else 403))


# ---- Property 35: search and filter ----
words = st.sampled_from(["fix", "Login", "bug", "docs", "API", "ui"])


@PROP
@given(
    cards=st.lists(st.tuples(words, st.one_of(st.none(), words), st.sampled_from(["high", "medium", "low"]), st.booleans(), st.booleans()), max_size=8),
    search=st.one_of(st.none(), st.sampled_from(["fix", "LOGIN", "bu", "zzz"])),
    prio=st.one_of(st.none(), st.sampled_from(["high", "medium", "low"])),
    use_assignee=st.booleans(),
)
def test_property_35_search_and_filter(client, cards, search, prio, use_assignee):
    env = Env(client)
    made = []
    for title, desc, p, assigned, deleted in cards:
        c = env.card(title=title, description=desc, priority=p, assignee_id=env.uid("member") if assigned else None)
        if deleted:
            client.delete(f"/api/cards/{c['id']}", headers=env.h["manager"])
        else:
            made.append((c["id"], title, desc, p, assigned))
    q = []
    if search:
        q.append(f"search={search}")
    if prio:
        q.append(f"filter[priority]={prio}")
    if use_assignee:
        q.append(f"filter[assignee]={env.uid('member')}")
    got = client.get(f"/api/boards/{env.bid}/cards" + ("?" + "&".join(q) if q else ""), headers=env.h["member"]).get_json()["data"]
    exp = [
        m for m in made
        if (not search or search.lower() in m[1].lower() or search.lower() in (m[2] or "").lower())
        and (not prio or m[3] == prio)
        and (not use_assignee or m[4])
    ]
    assert {c["id"] for c in got} == {m[0] for m in exp}
    assert client.get(f"/api/boards/{env.bid}/cards?filter[bogus]=1", headers=env.h["member"]).status_code == 400
