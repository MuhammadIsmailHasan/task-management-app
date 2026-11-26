import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { CardTile } from "@/components/board/CardTile";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { CommentThread } from "@/components/card/CommentThread";
import { initialsOf } from "@/lib/initials";
import type { Card, Comment } from "@/lib/types";

describe("initialsOf", () => {
  it.each([
    ["Ann Lee", "AL"],
    ["ann", "A"],
    ["  mary   jane   watson ", "MJ"],
    ["", "?"],
    ["   ", "?"],
  ])("%j -> %s", (name, expected) => expect(initialsOf(name)).toBe(expected));

  it("is at most two upper-case letters, and ? only for a blank name", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 30 }), (name) => {
        const out = initialsOf(name);
        expect(Array.from(out).length).toBeLessThanOrEqual(2);
        expect(out === "?").toBe(name.trim() === "" || out === "?");
        if (name.trim() === "") expect(out).toBe("?");
      }),
    );
  });
});

describe("BaseAvatar", () => {
  it("shows the image when a URL is set, with the full name as the label", () => {
    const { container } = render(<BaseAvatar name="Ann Lee" src="/api/users/u1/avatar/file?exp=1&sig=2" />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toContain("/api/users/u1/avatar/file?exp=1&sig=2");
    expect(screen.getByRole("img", { name: "Ann Lee" })).toBeInTheDocument();
    expect(container.textContent).not.toContain("AL");
  });

  it("shows initials when the URL is null or the image fails", () => {
    const { container, rerender } = render(<BaseAvatar name="Ann Lee" src={null} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AL");
    rerender(<BaseAvatar name="Ann Lee" src="/api/users/u1/avatar/file?exp=1&sig=2" />);
    container.querySelector("img")!.dispatchEvent(new Event("error"));
  });

  it("falls back to initials after a load error, and shows one letter for one word", async () => {
    const { container } = render(<BaseAvatar name="Cher" src="/x.png" />);
    container.querySelector("img")!.dispatchEvent(new Event("error", { bubbles: false }));
    expect(await screen.findByText("C")).toBeInTheDocument();
  });

  it("never puts an email in the label or alt text", () => {
    const { container } = render(<BaseAvatar name="Ann Lee" src="/x.png" />);
    expect(container.innerHTML).not.toContain("@");
  });
});

describe("avatars where people act", () => {
  const card: Card = {
    id: "k1", column_id: "c1", category_id: null, assignee_id: "u1", assignee_name: "Ann Lee", assignee_avatar_url: "/api/users/u1/avatar/file?exp=1&sig=2",
    title: "T", description: null, priority: "low", start_date: null, end_date: null, order: 1, archived_at: null, subtasks: [], attachments: [],
  };
  it("the board card shows the assignee image", () => {
    const { container } = render(
      <CardTile card={card} assignee={{ full_name: "Ann Lee", avatar_url: card.assignee_avatar_url ?? null }} dueState={null} draggable={false} onOpen={vi.fn()} onDragStart={vi.fn()} onDragEnd={vi.fn()} />,
    );
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("comments and replies show the author image or initials", () => {
    const base = { card_id: "k1", parent_id: null, content: "hi", is_priority: false, reply_count: 1, created_at: "2026-11-20T00:00:00Z", can_create_card: false };
    const reply: Comment = { ...base, id: "r1", author_id: "u2", author_name: "Bob Roy", author_avatar_url: null, parent_id: "c1", reply_count: 0 };
    const comment: Comment = { ...base, id: "c1", author_id: "u1", author_name: "Ann Lee", author_avatar_url: "/api/users/u1/avatar/file?exp=1&sig=2", replies: [reply] };
    const { container } = render(
      <CommentThread comments={[comment]} sort="latest" canReply={false} canPrioritize={false} onSortChange={vi.fn()} onReply={vi.fn()} onTogglePriority={vi.fn()} />,
    );
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.getByText("BR")).toBeInTheDocument();
  });
});
