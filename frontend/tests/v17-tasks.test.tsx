import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyTasksView } from "@/components/tasks/MyTasksView";
import type { MyCards, TaskCard } from "@/lib/types";

const kpi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { me: { kpi } } }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const task = (id: string, title: string, over: Partial<TaskCard> = {}): TaskCard => ({ id, title, board_id: "b1", board_slug: "alpha", board_name: "Alpha", priority: "medium", end_date: "2026-11-20", due_state: null, category: null, ...over });

describe("My Tasks (Requirement 52)", () => {
  beforeEach(() => kpi.mockResolvedValue({ range: { from: "2026-10-28", to: "2026-11-26" }, finished: 4, on_time_rate: 0.75, throughput: 0.9, overdue_now: 1, oldest_overdue_days: 2, cycle_days: 3.5, rework_rate: 0.25, open: 5 }));

  it("shows the caller's own KPIs under the title", async () => {
    render(<MyTasksView data={{ today: "2026-11-26", groups: [] }} role="member" />);
    const mine = within(await screen.findByRole("region", { name: "My performance" }));
    expect(await mine.findByText("75%")).toBeInTheDocument();
    expect(mine.getByText("3.5 d")).toBeInTheDocument();
    expect(mine.getByText("oldest 2 d late")).toBeInTheDocument();
  });

  const data: MyCards = {
    today: "2026-11-26",
    groups: [
      { key: "overdue", cards: [task("1", "Late one", { due_state: "overdue", priority: "high" })] },
      { key: "tomorrow", cards: [task("2", "Soon one", { due_state: "due_tomorrow", end_date: "2026-11-27" })] },
      { key: "no_due", cards: [task("3", "Whenever", { end_date: null })] },
    ],
  };

  it("shows the groups in the Backend's order with a count each, and leaves out an empty one", () => {
    render(<MyTasksView data={data} />);
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["My performance", "Overdue", "Tomorrow", "No due date"]);
    expect(screen.queryByRole("region", { name: "Today" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Overdue" })).getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My tasks");
  });

  it("makes each row a link that opens the Card over its Board, with the Board name, priority, and due badge", () => {
    render(<MyTasksView data={data} />);
    const row = screen.getByRole("link", { name: /Late one/ });
    expect(row).toHaveAttribute("href", "/app/b/alpha?card=1");
    expect(row).toHaveTextContent("Alpha");
    expect(row).toHaveTextContent("high");
    expect(row).toHaveTextContent("Overdue");
    expect(screen.getByRole("link", { name: /Soon one/ })).toHaveTextContent("Due tomorrow");
    expect(screen.getByRole("link", { name: /Whenever/ })).not.toHaveTextContent(/Overdue|Due tomorrow/);
  });

  it.each([
    ["with tasks", data],
    ["without tasks", { today: "2026-11-26", groups: [] }],
  ])("shows the role after the title %s", (_name, value) => {
    render(<MyTasksView data={value} role="member" />);
    expect(screen.getByText("as Member")).toBeInTheDocument();
  });

  it("says Nothing assigned to you when there is no group", () => {
    render(<MyTasksView data={{ today: "2026-11-26", groups: [] }} />);
    expect(screen.getByText("Nothing assigned to you")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to boards" })).toHaveAttribute("href", "/app/boards");
  });
});
