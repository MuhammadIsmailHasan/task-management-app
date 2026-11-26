import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddColumn } from "@/components/board/AddColumn";
import { ArchivedView } from "@/components/board/ArchivedView";
import { CalendarView } from "@/components/board/CalendarView";
import { CardTile } from "@/components/board/CardTile";
import { ColumnHeader } from "@/components/board/ColumnHeader";
import { DueBadge } from "@/components/board/DueBadge";
import { ListView } from "@/components/board/ListView";
import { ShellContext } from "@/components/shell/ShellContext";
import { monthGrid } from "@/lib/dates";
import { ApiError } from "@/lib/http";
import type { Board, Card, Column } from "@/lib/types";
import { shellValue } from "./support/shell";

const mocks = vi.hoisted(() => ({ api: { cards: { restore: vi.fn() } } }));
vi.mock("@/lib/api", () => ({ api: mocks.api }));
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/toast", () => ({ toast: { success: toastSuccess, error: vi.fn() }, withoutErrorToast: <T,>(run: () => Promise<T>) => run() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const col = (id: string, name: string, order: number): Column => ({ id, board_id: "b1", name, order });
const columns = [col("c1", "Todo", 0), col("c2", "Review", 1), col("c3", "Done", 2)];
const card = (over: Partial<Card> = {}): Card =>
  ({ id: "k1", column_id: "c1", category_id: null, assignee_id: null, title: "Write docs", description: null, priority: "medium", start_date: null, end_date: null, order: 1, archived_at: null, due_state: null, subtasks: [], attachments: [], ...over }) as Card;

beforeEach(() => vi.clearAllMocks());

describe("ColumnHeader (COL-10, COL-11, COL-12)", () => {
  const header = (over: Partial<React.ComponentProps<typeof ColumnHeader>> = {}) =>
    render(<ColumnHeader column={columns[1]} tone="blue" count={2} canManage isFirst={false} isLast={false} onRename={vi.fn()} onMove={vi.fn()} onDelete={vi.fn()} {...over} />);

  it("shows no menu to someone who does not manage Columns", () => {
    header({ canManage: false });
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Column menu/ })).not.toBeInTheDocument();
  });

  it("offers Rename, Move left, Move right, and Delete, and moves through the callback", async () => {
    const onMove = vi.fn();
    header({ onMove });
    await userEvent.click(screen.getByRole("button", { name: "Column menu: Review" }));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Rename", "Move left", "Move right", "Delete"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Move left" }));
    expect(onMove).toHaveBeenCalledWith(-1);
  });

  it("disables Move left on the first Column and Move right on the last", async () => {
    header({ isFirst: true, isLast: true });
    await userEvent.click(screen.getByRole("button", { name: "Column menu: Review" }));
    expect(screen.getByRole("menuitem", { name: "Move left" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Move right" })).toHaveAttribute("aria-disabled", "true");
  });

  it("locks Rename and Delete on the Done column with the tooltip text, while it can still move", async () => {
    header({ column: columns[2] });
    await userEvent.click(screen.getByRole("button", { name: "Column menu: Done" }));
    for (const name of ["Rename", "Delete"]) {
      expect(screen.getByRole("menuitem", { name })).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("menuitem", { name })).toHaveAttribute("title", "The Done column is locked");
    }
    expect(screen.getByRole("menuitem", { name: "Move left" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("renames on Enter and does not rename on Escape", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    header({ onRename });
    await userEvent.click(screen.getByRole("button", { name: "Column menu: Review" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename column Review" });
    await userEvent.clear(input);
    await userEvent.type(input, "QA{Enter}");
    expect(onRename).toHaveBeenCalledWith("QA");
    await userEvent.click(screen.getByRole("button", { name: "Column menu: Review" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Rename column Review" }), "zz{Escape}");
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it("asks before it deletes, sends nothing until confirmed, and keeps the server's message when the Column is not empty (COL-05)", async () => {
    const onDelete = vi.fn().mockRejectedValue(new ApiError(409, "COLUMN_NOT_EMPTY", "Move or archive its 2 cards first.", { count: [] }));
    header({ onDelete });
    await userEvent.click(screen.getByRole("button", { name: "Column menu: Review" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete column “Review”?" });
    expect(onDelete).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(await within(dialog).findByText("Move or archive its 2 cards first.")).toBeInTheDocument();
  });
});

describe("AddColumn (COL-11, COL-12)", () => {
  it("creates only after the confirmation", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<AddColumn onCreate={onCreate} />);
    await userEvent.click(screen.getByRole("button", { name: "Add column" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Column name" }), "QA");
    await userEvent.click(screen.getByRole("button", { name: "Add column" }));
    expect(onCreate).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", { name: "Create column “QA”?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    expect(onCreate).toHaveBeenCalledWith("QA");
  });
});

describe("Due badges (VIEW-08, VIEW-09)", () => {
  it("says Overdue or Due tomorrow in text, and nothing otherwise", () => {
    const { rerender } = render(<DueBadge state="overdue" />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    rerender(<DueBadge state="due_tomorrow" />);
    expect(screen.getByText("Due tomorrow")).toBeInTheDocument();
    rerender(<DueBadge state={null} />);
    expect(document.body.textContent).toBe("");
  });

  it("shows the state of the Card on its tile, from the server field and not from the browser date", () => {
    const props = { draggable: false };
    const { rerender } = render(<CardTile card={card({ end_date: "2000-01-01" })} dueState={null} {...props} />);
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument(); // a past date means nothing without the server's state
    rerender(<CardTile card={card({ end_date: "2000-01-01" })} dueState="overdue" {...props} />);
    expect(screen.getByText(/Overdue · Jan 1/)).toBeInTheDocument();
    rerender(<CardTile card={card({ end_date: "2099-01-02" })} dueState="due_tomorrow" {...props} />);
    expect(screen.getByText(/Due tomorrow · Jan 2/)).toBeInTheDocument();
  });
});

describe("List view (VIEW-01, VIEW-02)", () => {
  const cards = [
    card({ id: "k1", title: "Late one", end_date: "2026-11-20", due_state: "overdue", assignee_name: "Ann Lee", priority: "high" }),
    card({ id: "k2", title: "Second", column_id: "c1", order: 2 }),
    card({ id: "k3", title: "In review", column_id: "c2" }),
    card({ id: "k4", title: "Finished", column_id: "c3", end_date: "2026-11-01", due_state: "overdue" }),
  ];

  it("groups the Cards by Column in Column order with a count and a row per Card", () => {
    render(<ListView columns={[...columns].reverse()} cards={cards} categories={[]} members={[]} onOpen={vi.fn()} />);
    const sections = screen.getAllByRole("region");
    expect(sections.map((s) => s.getAttribute("aria-label"))).toEqual(["Todo", "Review", "Done"]);
    expect(within(sections[0]).getAllByRole("button")).toHaveLength(2);
    expect(within(sections[0]).getByText("Ann Lee")).toBeInTheDocument();
    expect(within(sections[0]).getByText("Overdue")).toBeInTheDocument();
  });

  it("shows no due badge in the Done column, and says No cards for an empty Column", () => {
    render(<ListView columns={columns} cards={cards.filter((c) => c.column_id !== "c2")} categories={[]} members={[]} onOpen={vi.fn()} />);
    expect(within(screen.getByRole("region", { name: "Done" })).queryByText("Overdue")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Review" })).getByText("No cards")).toBeInTheDocument();
  });

  it("opens the Card from its row", async () => {
    const onOpen = vi.fn();
    render(<ListView columns={columns} cards={cards} categories={[]} members={[]} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Open card Late one" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "k1" }));
  });
});

describe("Calendar view (VIEW-03, VIEW-04)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 26, 12)); // 26 Nov 2026
  });
  afterEach(() => vi.useRealTimers());

  it("lays out November 2026 Monday first in whole weeks, marks today, and puts each Card on its end date", () => {
    const cards = [card({ id: "a", title: "On the 27th", end_date: "2026-11-27" }), card({ id: "b", title: "No date", end_date: null })];
    render(<CalendarView columns={columns} cards={cards} onOpen={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(screen.getAllByRole("gridcell")).toHaveLength(42); // 26 Oct to 6 Dec: six whole weeks
    expect(screen.getAllByRole("gridcell").find((c) => c.getAttribute("aria-current") === "date")).toHaveTextContent("26");
    const day = screen.getAllByRole("gridcell").find((c) => c.textContent?.startsWith("27") && within(c).queryByRole("button", { name: "Open card On the 27th" }));
    expect(day).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open card No date" })).not.toBeInTheDocument();
    expect(screen.getByText("1 card has no due date and is not shown.")).toBeInTheDocument();
  });

  it("moves between months and back to today", async () => {
    render(<CalendarView columns={columns} cards={[]} onOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("heading", { name: "December 2026" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument();
  });

  it("shows three Cards on a day and the rest behind +N more", async () => {
    const many = [1, 2, 3, 4, 5].map((n) => card({ id: `m${n}`, title: `Task ${n}`, end_date: "2026-11-10" }));
    render(<CalendarView columns={columns} cards={many} onOpen={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /^Open card Task/ }).length).toBe(3);
    await userEvent.click(screen.getByRole("button", { name: "+2 more" }));
    expect(await screen.findAllByRole("button", { name: /^Open card Task/ })).toHaveLength(8);
  });

  it("opens a Card", async () => {
    const onOpen = vi.fn();
    render(<CalendarView columns={columns} cards={[card({ title: "Open me", end_date: "2026-11-12" })]} onOpen={onOpen} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Open card Open me" })[0]);
    expect(onOpen).toHaveBeenCalled();
  });
});

describe("monthGrid", () => {
  it("always gives whole Monday-first weeks that cover the month exactly", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2000, max: 2040 }), fc.integer({ min: 0, max: 11 }), (year, month) => {
        const cells = monthGrid(year, month);
        expect(cells.length % 7).toBe(0);
        expect(new Date(`${cells[0].iso}T00:00:00`).getDay()).toBe(1); // Monday
        expect(new Date(`${cells[cells.length - 1].iso}T00:00:00`).getDay()).toBe(0); // Sunday
        expect(cells.filter((c) => c.inMonth)).toHaveLength(new Date(year, month + 1, 0).getDate());
      }),
    );
  });
});

describe("Archived view (VIEW-05 to VIEW-07)", () => {
  const board = { id: "b1", slug: "alpha", name: "Alpha", owner_id: null, archived_at: null, columns } as Board;
  const archived = [card({ id: "z1", title: "Old plan", column_id: null, archived_at: "2026-11-01T10:00:00Z" })];
  const wrap = (role: "manager" | "member", ui: React.ReactNode) =>
    render(<ShellContext.Provider value={shellValue({ session: { token: "t", userId: "u1", role, exp: 0 } })}>{ui}</ShellContext.Provider>);

  it("restores a Card without asking, says where it went, and removes the row", async () => {
    mocks.api.cards.restore.mockResolvedValue(card({ id: "z1", column_id: "c1" }));
    wrap("manager", <ArchivedView board={board} initialCards={archived} categories={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Restore Old plan" }));
    expect(mocks.api.cards.restore).toHaveBeenCalledWith("z1");
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Card restored to Todo")); // a Toast (TOAST-01)
    await waitFor(() => expect(screen.queryByText("Old plan")).not.toBeInTheDocument());
    expect(screen.getByText("No archived cards.")).toBeInTheDocument();
  });

  it("shows no Restore action to a Member", () => {
    wrap("member", <ArchivedView board={board} initialCards={archived} categories={[]} />);
    expect(screen.getByText("Old plan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Restore/ })).not.toBeInTheDocument();
  });

  it("keeps the row when the Card cannot be restored (the request raises the error Toast)", async () => {
    mocks.api.cards.restore.mockRejectedValue(new ApiError(409, "CARD_NOT_ARCHIVED", "The card is not archived"));
    wrap("manager", <ArchivedView board={board} initialCards={archived} categories={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Restore Old plan" }));
    await waitFor(() => expect(mocks.api.cards.restore).toHaveBeenCalled());
    expect(screen.getByText("Old plan")).toBeInTheDocument();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
