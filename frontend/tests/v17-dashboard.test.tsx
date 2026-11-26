import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ShellContext } from "@/components/shell/ShellContext";
import { barShares, filtersFromParams, filtersToQuery, finishedShares, formatWeek, greeting, percentDone, sumAnalytics, sumThroughput } from "@/lib/dashboard";
import { ApiError } from "@/lib/http";
import type { Analytics, DashboardData, TaskCard, Throughput } from "@/lib/types";
import { shellValue } from "./support/shell";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), search: { value: "" }, api: { analytics: { dashboard: vi.fn(), all: vi.fn() }, boards: { activity: vi.fn() } } }));
vi.mock("@/lib/api", () => ({ api: mocks.api }));
vi.mock("next/navigation", () => ({ usePathname: () => "/app/dashboard", useRouter: () => ({ replace: mocks.replace, push: vi.fn() }), useSearchParams: () => new URLSearchParams(mocks.search.value) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const a = (id: string, name: string, over: Partial<Analytics> = {}): Analytics => ({ board_id: id, name, total: 10, done: 4, in_progress: 3, overdue: 1, done_delta: 2, ...over });
const t = (id: string, name: string, done: number[]): Throughput => ({ board_id: id, name, total: done.reduce((n, d) => n + d, 0), weeks: done.map((d, i) => ({ week_start: `2026-11-${String(2 + i * 7).padStart(2, "0")}`, done: d })) });
const card = (id: string, title: string, over: Partial<TaskCard> = {}): TaskCard => ({ id, title, board_id: "b1", board_slug: "alpha", board_name: "Alpha", priority: "medium", end_date: "2026-11-20", due_state: "overdue", assignee_name: "Ann Lee", ...over });
const data = (over: Partial<DashboardData> = {}): DashboardData => ({
  range: { from: "2026-10-28", to: "2026-11-26" },
  today: "2026-11-26",
  overview: { total: 14, done: 8, in_progress: 3, overdue: 2 },
  throughput: { weeks: [{ week_start: "2026-11-02", done: 1 }, { week_start: "2026-11-09", done: 2 }, { week_start: "2026-11-16", done: 5 }], total: 8 },
  overdue: { count: 12, cards: [card("k1", "Late one")] },
  due_tomorrow: { count: 1, due_on: "2026-11-27", cards: [card("k2", "Soon one", { due_state: "due_tomorrow", end_date: "2026-11-27" })] },
  top_priority: { cards: [card("k3", "Ship it", { priority: "high", due_state: null })] },
  finished: { on_time: 3, overdue: 1 },
  members: [{ id: "u1", full_name: "Ann Lee", avatar_url: null }],
  ...over,
});

const boards = [{ id: "b1", name: "Alpha" }, { id: "b2", name: "Beta" }];
const view = (role: "manager" | "supervisor", list = boards, user = { id: "u1", full_name: "Ann Lee", username: "ann", email: "a@x.com", avatar_url: null }) =>
  render(
    <ShellContext.Provider value={shellValue({ user })}>
      <DashboardView role={role} boards={list} />
    </ShellContext.Provider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search.value = "";
  mocks.api.analytics.dashboard.mockResolvedValue(data());
  mocks.api.analytics.all.mockResolvedValue([a("1", "Alpha"), a("2", "Beta")]);
  mocks.api.boards.activity.mockResolvedValue([]);
});

describe("dashboard figures", () => {
  it("adds the analytics of several boards", () => {
    expect(sumAnalytics([a("1", "A"), a("2", "B", { total: 5, done: 5, done_delta: 0 })])).toEqual({ total: 15, done: 9, in_progress: 6, overdue: 2, done_delta: 2 });
    expect(percentDone({ total: 0, done: 0 })).toBe(0);
  });

  it("adds weekly series week by week and formats a week as '12 Oct'", () => {
    expect(sumThroughput([t("1", "A", [1, 2]), t("2", "B", [3, 0])]).map((w) => w.done)).toEqual([4, 2]);
    expect(formatWeek("2026-10-12")).toBe("12 Oct");
  });

  it("gives the tallest week 100 percent and an all-zero series no height (Property)", () => {
    expect(barShares([{ week_start: "x", done: 0 }, { week_start: "y", done: 0 }])).toEqual([0, 0]);
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 26 }), (xs) => {
        const shares = barShares(xs.map((done, i) => ({ week_start: String(i), done })));
        expect(shares.every((s) => s >= 0 && s <= 100)).toBe(true);
        if (Math.max(...xs) > 0) expect(Math.max(...shares)).toBe(100);
      }),
    );
  });
});

describe("greeting (DASH-10)", () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 26, h, m);
  it("changes at 12:00 and 18:00 by the local hour", () => {
    expect(greeting(at(0, 0), "Ann Lee")).toBe("Good morning, Ann");
    expect(greeting(at(11, 59), "Ann Lee")).toBe("Good morning, Ann");
    expect(greeting(at(12, 0), "Ann Lee")).toBe("Good afternoon, Ann");
    expect(greeting(at(17, 59), "Ann Lee")).toBe("Good afternoon, Ann");
    expect(greeting(at(18, 0), "Ann Lee")).toBe("Good evening, Ann");
    expect(greeting(at(23, 59), "Ann Lee")).toBe("Good evening, Ann");
  });
  it("uses the first word of the name and 'there' when it is empty", () => {
    expect(greeting(at(9), "  Mary   Jane Watson ")).toBe("Good morning, Mary");
    expect(greeting(at(9), "")).toBe("Good morning, there");
    expect(greeting(at(9), null)).toBe("Good morning, there");
  });
});

describe("filters in the query string (DASH-11)", () => {
  it("round-trips, keeps a fixed order, and leaves out what is not set", () => {
    const f = { board: "b1", member: "u1", from: "2026-11-01", to: "2026-11-26", dueOn: "2026-11-30" };
    expect(filtersToQuery(f)).toBe("?board=b1&member=u1&from=2026-11-01&to=2026-11-26&due_on=2026-11-30");
    expect(filtersFromParams((k) => new URLSearchParams(filtersToQuery(f)).get(k))).toEqual(f);
    expect(filtersToQuery({ board: "", member: "", from: "", to: "", dueOn: "" })).toBe("");
  });
  it("finished shares: nothing for no cards, and the two parts add to 100", () => {
    expect(finishedShares({ on_time: 0, overdue: 0 })).toBeNull();
    fc.assert(fc.property(fc.nat(50), fc.nat(50), (x, y) => { const s = finishedShares({ on_time: x, overdue: y }); return x + y === 0 ? s === null : s!.onTime + s!.overdue === 100; }));
  });
});

describe("DashboardView (Requirements 43 and 51)", () => {
  it("shows a loading state, then the greeting, the figures, and every widget", async () => {
    view("manager");
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(await screen.findByText("57% Done")).toBeInTheDocument(); // 8 of 14
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^Good (morning|afternoon|evening), Ann$/);
    expect(within(screen.getByRole("region", { name: "Open work" })).getByText("6")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /3 weeks: 8 in total/ })).toBeInTheDocument();
    expect(screen.getAllByText("Not limited by the date range").length).toBeGreaterThanOrEqual(2); // the overview and Top 5 (DASH-12)
    const overdue = screen.getByRole("region", { name: "Overdue cards" });
    expect(within(overdue).getByRole("link", { name: "Late one" })).toHaveAttribute("href", "/app/b/alpha?card=k1");
    expect(within(overdue).getByText("and 11 more")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Due tomorrow" })).getByText("Soon one")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Top 5 priority cards" })).getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByText("On time 75%")).toBeInTheDocument();
  });

  it("reads its filters from the query string and sends them to the endpoint", async () => {
    mocks.search.value = "board=b2&member=u1&from=2026-11-01&to=2026-11-10&due_on=2026-11-30";
    view("manager");
    await screen.findByText("57% Done");
    expect(mocks.api.analytics.dashboard).toHaveBeenCalledWith({ board: "b2", member: "u1", from: "2026-11-01", to: "2026-11-10", dueOn: "2026-11-30" });
  });

  it("a Manager starts on All boards, a Supervisor on the first Board it owns", async () => {
    view("manager");
    await screen.findByText("57% Done");
    expect(mocks.api.analytics.dashboard.mock.calls[0][0].board).toBeUndefined();
    expect(await screen.findByRole("region", { name: "Boards" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Recent activity" })).not.toBeInTheDocument();
  });

  it("starts a Supervisor on its first Board, with recent activity and no Boards table", async () => {
    view("supervisor", [boards[0]]);
    await screen.findByText("57% Done");
    expect(mocks.api.analytics.dashboard.mock.calls[0][0].board).toBe("b1");
    expect(await screen.findByRole("region", { name: "Recent activity" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Boards" })).not.toBeInTheDocument();
  });

  it("changing a filter writes it to the query string instead of fetching by itself", async () => {
    view("manager");
    await screen.findByText("57% Done");
    await userEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    expect(mocks.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/app\/dashboard\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/));
  });

  it("offers the people of the scope in the Member filter", async () => {
    view("manager");
    await screen.findByText("57% Done");
    await userEvent.click(screen.getByRole("button", { name: /Member/ }));
    expect(within(screen.getByRole("listbox")).getByText("Anyone")).toBeInTheDocument();
    expect(within(screen.getByRole("listbox")).getByText("Ann Lee")).toBeInTheDocument();
  });

  it("the Due on date has its own control and is sent as due_on", async () => {
    view("manager");
    await screen.findByText("57% Done");
    const field = screen.getByLabelText("Due on");
    expect(field).toHaveValue("2026-11-27");
    fireEvent.change(field, { target: { value: "2026-11-30" } });
    expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("due_on=2026-11-30"));
  });

  it("says what is empty in each widget and shows no 'On time' figure without finished cards (DASH-22)", async () => {
    mocks.api.analytics.dashboard.mockResolvedValue(data({ overdue: { count: 0, cards: [] }, due_tomorrow: { count: 0, due_on: "2026-11-27", cards: [] }, top_priority: { cards: [] }, finished: { on_time: 0, overdue: 0 } }));
    view("manager");
    expect(await screen.findByText("Nothing overdue")).toBeInTheDocument();
    expect(screen.getByText("Nothing due tomorrow")).toBeInTheDocument();
    expect(screen.getByText("No cards to rank")).toBeInTheDocument();
    expect(screen.getByText("No finished cards in this period")).toBeInTheDocument();
    expect(screen.queryByText(/^On time/)).not.toBeInTheDocument();
  });

  it("shows an error with Retry and loads again on Retry", async () => {
    mocks.api.analytics.dashboard.mockRejectedValueOnce(new ApiError(500, "INTERNAL_ERROR", "boom"));
    view("manager");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the dashboard.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("57% Done")).toBeInTheDocument();
    expect(mocks.api.analytics.dashboard).toHaveBeenCalledTimes(2);
  });

  it("shows no estimate, capacity, velocity, or Weekly/Monthly switch (DASH-18)", async () => {
    view("manager");
    await screen.findByText("57% Done");
    expect(document.body.textContent).not.toMatch(/estimate|capacity|velocity|Monthly|Weekly throughput/i);
  });

  it("shows the empty state with a link to Home when there is no Board", () => {
    view("supervisor", []);
    expect(screen.getByText("No boards to show yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/app/boards");
    expect(mocks.api.analytics.dashboard).not.toHaveBeenCalled();
  });
});
