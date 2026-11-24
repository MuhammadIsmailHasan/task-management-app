import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CardModal } from "@/components/card/CardModal";
import { ShellContext } from "@/components/shell/ShellContext";
import type { Board, Card, Member } from "@/lib/types";

const card: Card = {
  id: "c1",
  column_id: "col1",
  category_id: null,
  assignee_id: null,
  title: "Write the spec",
  description: "Details",
  priority: "medium",
  start_date: null,
  end_date: null,
  order: 1,
  archived_at: null,
  subtasks: [{ id: "s1", card_id: "c1", title: "Outline", is_done: false, order: 1 }],
  attachments: [{ id: "a1", card_id: "c1", name: "Brief", mime_type: null, url: "https://example.com", file_url: null, expires_at: null }],
  comments: [{ id: "m1", card_id: "c1", author_id: "u9", author_name: "Manager Name", parent_id: null, content: "Hello", is_priority: false, reply_count: 0, created_at: "2026-11-19T10:00:00Z", can_create_card: false, replies: [] }],
  activity: [{ id: "x1", actor_id: "u9", actor_name: "Manager Name", action: "card.moved", target_type: "card", target_id: "c1", metadata: null, created_at: "2026-11-19T10:00:00Z" }],
};
const members: Member[] = [{ id: "u1", full_name: "Member One", username: "memberone", email: "one@example.com", avatar_url: null }];

vi.mock("@/lib/api", () => ({
  api: {
    cards: { get: vi.fn(async () => card), update: vi.fn(async () => card) },
    boards: { members: vi.fn(async () => members) },
    comments: { list: vi.fn(async () => card.comments) },
    attachments: { addLink: vi.fn(), upload: vi.fn(), remove: vi.fn(), freshUrl: vi.fn() },
    subtasks: { create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  },
}));

const board = { id: "b1", name: "Board", owner_id: null, archived_at: null, columns: [{ id: "col1", name: "Todo", order: 0 }] } as unknown as Board;
const shell = {
  session: { token: "t", userId: "u9", role: "manager" as const, exp: 0 },
  user: null,
  boardId: "b1",
  boards: [],
  panel: null,
  inbox: null,
  refreshInbox: async () => undefined,
  toggleSidePanel: () => undefined,
  closeSidePanel: () => undefined,
  adjustUnread: () => undefined,
};

describe("CardModal", () => {
  it("shows the live title and the board name in the header", async () => {
    render(
      <ShellContext.Provider value={shell}>
        <CardModal cardId="c1" board={board} columns={board.columns ?? []} categories={[]} onClose={() => undefined} onChanged={() => undefined} onDeleted={() => undefined} />
      </ShellContext.Provider>,
    );
    const title = await screen.findByLabelText("Title");
    await userEvent.clear(title);
    expect(screen.getByRole("dialog", { name: /Untitled card \| Board/ })).toBeInTheDocument();
    await userEvent.type(title, "New name");
    expect(screen.getByRole("dialog", { name: /New name \| Board/ })).toBeInTheDocument();
  });

  it("puts attachments and subtasks in their own cards and shows real names, with a footer", async () => {
    render(
      <ShellContext.Provider value={shell}>
        <CardModal cardId="c1" board={board} columns={board.columns ?? []} categories={[]} onClose={() => undefined} onChanged={() => undefined} onDeleted={() => undefined} />
      </ShellContext.Provider>,
    );
    const attachments = await screen.findByRole("region", { name: "Attachments" });
    const subtasks = screen.getByRole("region", { name: "Subtasks" });
    expect(attachments).not.toBe(subtasks);
    expect(within(attachments).queryByText("Outline")).not.toBeInTheDocument();
    expect(within(subtasks).getByDisplayValue("Outline")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Comments" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Activity" })).toBeInTheDocument();
    expect(screen.getAllByText(/Manager Name/).length).toBeGreaterThan(1);
    expect(screen.queryByText(/Someone/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Move to column")).not.toBeInTheDocument();
    for (const name of ["Archive"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2); // the card, and the viewer's own comment
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: /Write the spec \| Board/ })).toBeInTheDocument();
  });
});
