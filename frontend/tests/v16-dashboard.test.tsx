import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ShellContext } from "@/components/shell/ShellContext";
import { barShares, formatWeek, percentDone, sumAnalytics, sumThroughput } from "@/lib/dashboard";
import type { Analytics, Throughput } from "@/lib/types";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/api", () => ({ api: { boards: { activity: vi.fn().mockResolvedValue([]) } } }));

const a = (id: string, name: string, over: Partial<Analytics> = {}): Analytics => ({ board_id: id, name, total: 10, done: 4, in_progress: 3, overdue: 1, done_delta: 2, ...over });
const t = (id: string, name: string, done: number[]): Throughput => ({ board_id: id, name, total: done.reduce((n, d) => n + d, 0), weeks: done.map((d, i) => ({ week_start: `2026-11-${String(2 + i * 7).padStart(2, "0")}`, done: d })) });

const ctx = { session: null, user: null, boardId: null, boards: [], panel: null, inbox: null, refreshInbox: vi.fn(), toggleSidePanel: vi.fn(), closeSidePanel: vi.fn(), adjustUnread: vi.fn() };
const view = (role: "manager" | "supervisor", analytics: Analytics[], throughput: Throughput[]) =>
  render(
    <ShellContext.Provider value={ctx}>
      <DashboardView role={role} analytics={analytics} throughput={throughput} />
    </ShellContext.Provider>,
  );

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

describe("DashboardView (Requirement 43)", () => {
  const data = { analytics: [a("1", "Alpha"), a("2", "Beta", { total: 4, done: 4, overdue: 0, in_progress: 0, done_delta: 4 })], throughput: [t("1", "Alpha", [0, 2, 1]), t("2", "Beta", [1, 0, 4])] };

  it("starts a Manager on All boards with the summed figures, one bar per week, a hidden table, and the Boards table", () => {
    view("manager", data.analytics, data.throughput);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("57% Done")).toBeInTheDocument(); // 8 of 14
    expect(within(screen.getByRole("region", { name: "Open work" })).getByText("6")).toBeInTheDocument(); // open cards: 14 - 8
    expect(screen.getByRole("img", { name: /3 weeks: 8 in total/ })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Cards completed per week" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(screen.getByRole("region", { name: "Boards" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Recent activity" })).not.toBeInTheDocument();
  });

  it("starts a Supervisor on the first owned Board with recent activity and no Boards table", async () => {
    view("supervisor", [data.analytics[0]], [data.throughput[0]]);
    expect(await screen.findByRole("region", { name: "Recent activity" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Boards" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "All boards" })).not.toBeInTheDocument();
  });

  it("switches to one Board and shows its own figures", async () => {
    view("manager", data.analytics, data.throughput);
    await userEvent.click(screen.getByRole("button", { name: /Board/ }));
    await userEvent.click(within(screen.getByRole("listbox")).getByText("Beta"));
    expect(screen.getByText("100% Done")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Recent activity" })).toBeInTheDocument();
  });

  it("shows no estimate, capacity, velocity, or Weekly/Monthly switch (DASH-08)", () => {
    view("manager", data.analytics, data.throughput);
    expect(document.body.textContent).not.toMatch(/estimate|capacity|velocity|Monthly|Weekly throughput/i);
  });

  it("shows the empty state with a link to Home when there is no Board", () => {
    view("supervisor", [], []);
    expect(screen.getByText("No boards to show yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/boards");
  });
});
