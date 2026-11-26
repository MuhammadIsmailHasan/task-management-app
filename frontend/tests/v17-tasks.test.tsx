import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MyTasksView } from "@/components/tasks/MyTasksView";
import type { MyCards, TaskCard } from "@/lib/types";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const task = (id: string, title: string, over: Partial<TaskCard> = {}): TaskCard => ({ id, title, board_id: "b1", board_slug: "alpha", board_name: "Alpha", priority: "medium", end_date: "2026-11-20", due_state: null, category: null, ...over });

describe("My Tasks (Requirement 52)", () => {
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
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["Overdue", "Tomorrow", "No due date"]);
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

  it("says Nothing assigned to you when there is no group", () => {
    render(<MyTasksView data={{ today: "2026-11-26", groups: [] }} />);
    expect(screen.getByText("Nothing assigned to you")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to boards" })).toHaveAttribute("href", "/app/boards");
  });
});
