import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsStrip } from "@/components/board/AnalyticsStrip";
import { BoardTile } from "@/components/board/BoardTile";
import { CardTile } from "@/components/board/CardTile";
import { ChipStrip } from "@/components/board/ChipStrip";
import { FileDropZone } from "@/components/card/FileDropZone";
import type { Analytics, Board, Card, Category, Member } from "@/lib/types";

const board = { id: "b1", name: "Website", description: "Redesign the site", owner_id: null, archived_at: null, card_count: 8, done_count: 2, overdue_count: 1, member_count: 5 } as Board;
const members = ["Ann Lee", "Bob Roy", "Cy Day"].map((n, i) => ({ id: `u${i}`, full_name: n, username: n.replace(" ", "").toLowerCase(), avatar_url: null })) as Member[];

describe("BoardTile", () => {
  it("shows description, progress, counts, three avatars, and +N", () => {
    render(<BoardTile board={board} members={members} />);
    expect(screen.getByText("Redesign the site")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Website progress" })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("8 cards")).toBeInTheDocument();
    expect(screen.getByText("1 overdue")).toBeInTheDocument();
    expect(screen.getAllByRole("img").filter((e) => /Ann|Bob|Cy/.test(e.getAttribute("aria-label") ?? ""))).toHaveLength(3);
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/boards/b1");
  });

  it("copes with a board without counts or description", () => {
    render(<BoardTile board={{ ...board, description: null, card_count: undefined, done_count: undefined, overdue_count: undefined, member_count: undefined }} members={[]} />);
    expect(screen.getByText("0 cards")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});

describe("AnalyticsStrip", () => {
  it("sums the rows", () => {
    const rows = [
      { board_id: "a", name: "A", total: 5, done: 2, in_progress: 1, overdue: 1, done_delta: 0 },
      { board_id: "b", name: "B", total: 5, done: 3, in_progress: 2, overdue: 0, done_delta: 0 },
    ] as Analytics[];
    render(<AnalyticsStrip rows={rows} />);
    expect(screen.getByText("In progress").previousSibling).toHaveTextContent("3");
    expect(screen.getByText("Done").previousSibling).toHaveTextContent("5");
    expect(screen.getByText("Overdue").previousSibling).toHaveTextContent("1");
  });
});

describe("two badge types on a card", () => {
  const card = { id: "c1", column_id: "x", title: "T", priority: "high", description: null, end_date: null, subtasks: [], attachments: [], category_id: "k1", assignee_id: null } as unknown as Card;
  const category = { id: "k1", board_id: "b1", name: "Design", color: null } as Category;

  it("draws the category as an upper-case tag and the priority as a tinted pill with a flag", () => {
    render(<CardTile card={card} category={category} overdue={false} draggable onOpen={() => undefined} onDragStart={() => undefined} onDragEnd={() => undefined} />);
    const cat = screen.getByText("Design");
    const pri = screen.getByText("high");
    expect(cat.className).toMatch(/uppercase/);
    expect(pri.className).toMatch(/bg-danger-soft/);
    expect(cat.className).not.toMatch(/bg-danger-soft/);
  });
});

describe("FileDropZone", () => {
  it("accepts a dropped PDF and refuses another type", () => {
    const onFile = vi.fn();
    render(<FileDropZone onFile={onFile} />);
    const zone = screen.getByRole("button", { name: "Drop a file or browse" });
    expect(screen.getByText("Drop a file here or browse · PDF, Word or RAR")).toBeInTheDocument();
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["x"], "brief.pdf", { type: "application/pdf" })] } });
    expect(onFile).toHaveBeenCalledTimes(1);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["x"], "pic.png", { type: "image/png" })] } });
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Only PDF, Word or RAR");
  });
});

describe("ChipStrip", () => {
  it("shows an arrow only on a side with hidden chips and scrolls the strip", async () => {
    const proto = HTMLElement.prototype;
    const sizes = { scrollWidth: 600, clientWidth: 200 };
    const spy = (name: "scrollWidth" | "clientWidth") => vi.spyOn(proto, name, "get").mockReturnValue(sizes[name]);
    spy("scrollWidth");
    spy("clientWidth");
    render(
      <ChipStrip label="categories">
        <div>chips</div>
      </ChipStrip>,
    );
    expect(await screen.findByRole("button", { name: "Scroll categories right" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Scroll categories left" })).not.toBeInTheDocument();
    const strip = screen.getByText("chips").parentElement as HTMLElement;
    strip.scrollBy = vi.fn();
    await userEvent.click(screen.getByRole("button", { name: "Scroll categories right" }));
    expect(strip.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 160 }));
    vi.restoreAllMocks();
  });

  it("shows no arrows when everything fits", () => {
    render(
      <ChipStrip label="categories">
        <div>chips</div>
      </ChipStrip>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
