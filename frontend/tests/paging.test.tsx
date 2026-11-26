import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InboxView } from "@/components/shell/InboxView";
import { api } from "@/lib/api";
import { currentPageSize, pageSizeFor } from "@/lib/paging";
import type { Notification } from "@/lib/types";

const note = (i: number): Notification => ({ id: `n${i}`, type: "assigned", board_id: "b", board_slug: "b", board_name: "B", card_id: "c", card_title: null, actor_name: null, is_read: true, notify_date: "2026-11-19", created_at: "2026-11-19T10:00:00Z" });

vi.mock("@/lib/api", () => ({ api: { notifications: { inbox: vi.fn(), markRead: vi.fn(), readAll: vi.fn() } } }));
vi.mock("@/components/shell/ShellContext", () => ({
  useShell: () => ({ inbox: { items: [], unread_count: 0 }, refreshInbox: async () => undefined }),
}));

describe("pageSizeFor", () => {
  it("fills the viewport and stays within the API limits", () => {
    expect(pageSizeFor(0)).toBe(10);
    expect(pageSizeFor(900)).toBe(17);
    expect(pageSizeFor(100000)).toBe(100);
  });
});

describe("Inbox Load more", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the first page, loads older rows with `before`, and hides the button on the last page", async () => {
    const size = currentPageSize();
    const first = Array.from({ length: size }, (_, i) => note(i));
    const inbox = vi.mocked(api.notifications.inbox);
    inbox.mockResolvedValueOnce({ items: first, unread_count: 0 });
    inbox.mockResolvedValueOnce({ items: [note(size), note(size + 1)], unread_count: 0 });
    render(<InboxView />);
    const more = await screen.findByRole("button", { name: "Load more" });
    expect(inbox).toHaveBeenCalledWith({ limit: size });
    await userEvent.click(more);
    expect(inbox).toHaveBeenLastCalledWith({ limit: size, before: `n${size - 1}` });
    expect(await screen.findAllByText("A card was assigned to you")).toHaveLength(size + 2);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("has no Load more when the first page is short", async () => {
    vi.mocked(api.notifications.inbox).mockResolvedValueOnce({ items: [note(1)], unread_count: 0 });
    render(<InboxView />);
    expect(await screen.findByText("A card was assigned to you")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});
