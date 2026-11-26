import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InboxView } from "@/components/shell/InboxView";
import { ShellContext } from "@/components/shell/ShellContext";
import { hrefFor, sentenceFor } from "@/lib/inbox";
import type { Notification } from "@/lib/types";
import { shellValue } from "./support/shell";

const mocks = vi.hoisted(() => ({ api: { notifications: { inbox: vi.fn(), markRead: vi.fn(), readAll: vi.fn() } } }));
vi.mock("@/lib/api", () => ({ api: mocks.api }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const note = (over: Partial<Notification> = {}): Notification => ({
  id: "n1", type: "assigned", board_id: "b1", board_slug: "alpha", board_name: "Alpha", card_id: "c1", card_title: "Plan", actor_name: "Ada", action: null,
  is_read: false, notify_date: "2026-11-26", created_at: "2026-11-26T10:00:00Z", ...over,
});

const ui = (inbox = { items: [], unread_count: 2 }) => (
  <ShellContext.Provider value={shellValue({ inbox })}>
    <InboxView />
  </ShellContext.Provider>
);

beforeEach(() => vi.clearAllMocks());

describe("Inbox All and Unread switch (NAV-13)", () => {
  it("defaults to All, loads Unread through the filter, and says so when there is none", async () => {
    mocks.api.notifications.inbox.mockResolvedValueOnce({ items: [note(), note({ id: "n2", is_read: true })], unread_count: 1 });
    render(ui());
    expect(await screen.findAllByRole("link")).toHaveLength(2);
    const group = screen.getByRole("radiogroup", { name: "Show notifications" });
    expect(group.querySelector("[aria-checked='true']")).toHaveTextContent("All");
    mocks.api.notifications.inbox.mockResolvedValueOnce({ items: [], unread_count: 1 });
    await userEvent.click(screen.getByRole("radio", { name: "Unread" }));
    expect(await screen.findByText("No unread notifications")).toBeInTheDocument();
    expect(mocks.api.notifications.inbox).toHaveBeenLastCalledWith(expect.objectContaining({ unread: true }));
  });

  it("moves between the two options with the arrow keys", async () => {
    mocks.api.notifications.inbox.mockResolvedValue({ items: [], unread_count: 0 });
    render(ui());
    await screen.findByText("No notifications.");
    screen.getByRole("radio", { name: "All" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Unread" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Unread" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute("aria-checked", "true");
  });

  it("keeps a row it just opened in the Unread list until the next load (the list does not jump)", async () => {
    mocks.api.notifications.inbox.mockResolvedValueOnce({ items: [], unread_count: 1 });
    mocks.api.notifications.markRead.mockResolvedValue({});
    render(ui({ items: [], unread_count: 1 }));
    await screen.findByText("No notifications.");
    mocks.api.notifications.inbox.mockResolvedValueOnce({ items: [note()], unread_count: 1 });
    await userEvent.click(screen.getByRole("radio", { name: "Unread" }));
    const row = await screen.findByRole("link");
    await userEvent.click(row);
    expect(mocks.api.notifications.markRead).toHaveBeenCalledWith("n1");
    expect(screen.getByRole("link")).toBeInTheDocument();
  });
});

describe("the five new types (NPF-08)", () => {
  it("writes their sentences with the actor, the Card, and the action", () => {
    expect(sentenceFor(note({ type: "comment_on_assigned" }))).toBe("Ada commented on “Plan”");
    expect(sentenceFor(note({ type: "due_today" }))).toBe("“Plan” is due today");
    expect(sentenceFor(note({ type: "due_tomorrow" }))).toBe("“Plan” is due tomorrow");
    expect(sentenceFor(note({ type: "assigned_card_changed", action: "moved" }))).toBe("Ada moved “Plan”");
    expect(sentenceFor(note({ type: "assigned_card_changed", action: "archived" }))).toBe("Ada archived “Plan”");
    expect(sentenceFor(note({ type: "assigned_card_changed", action: "deleted" }))).toBe("Ada deleted “Plan”");
    expect(sentenceFor(note({ type: "subtask_on_assigned" }))).toBe("Ada updated a subtask on “Plan”");
  });

  it("opens the Card, except an archived or deleted one, which opens its Board", () => {
    for (const type of ["comment_on_assigned", "due_today", "due_tomorrow", "subtask_on_assigned"] as const) expect(hrefFor(note({ type }))).toBe("/app/b/alpha?card=c1");
    expect(hrefFor(note({ type: "assigned_card_changed", action: "moved" }))).toBe("/app/b/alpha?card=c1");
    expect(hrefFor(note({ type: "assigned_card_changed", action: "archived" }))).toBe("/app/b/alpha");
    expect(hrefFor(note({ type: "assigned_card_changed", action: "deleted" }))).toBe("/app/b/alpha");
  });

  it("never shows an Email in a sentence", () => {
    expect(sentenceFor(note({ type: "comment_on_assigned", actor_name: null }))).not.toMatch(/@/);
  });
});
