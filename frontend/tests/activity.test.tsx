import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityLine } from "@/components/card/ActivityLine";
import { activityText, describeActivity } from "@/lib/activity";
import { iconFor } from "@/lib/attachments";
import type { ActivityEntry } from "@/lib/types";

const row = (action: string, metadata: Record<string, unknown> | null, extra: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: "r1",
  actor_id: "u1",
  actor_name: "Manager",
  action,
  target_type: "card",
  target_id: "c1",
  metadata,
  created_at: "2026-11-19T10:00:00Z",
  ...extra,
});

describe("describeActivity", () => {
  it("reads actor, action, object, and where a card moved", () => {
    const p = describeActivity(row("card.moved", { card_title: "Plan", from_column_name: "Todo", to_column_name: "In Progress" }));
    expect(activityText(p)).toBe("Manager moved “Plan” from Todo to In Progress");
  });

  it("resolves column names from ids for rows written before the names were stored", () => {
    const p = describeActivity(row("card.moved", { from_column_id: "a", to_column_id: "b" }), { columns: { a: "Todo", b: "Done" } });
    expect(p.details).toEqual([{ kind: "move", from: "Todo", to: "Done" }]);
    expect(p.object).toBeUndefined();
    expect(p.verb).toBe("moved a card");
  });

  it("lists each changed field with old and new values", () => {
    const p = describeActivity(row("card.updated", { card_title: "Plan", changes: { priority: { from: "medium", to: "high" }, end_date: { from: null, to: "2026-12-01" }, description: {} } }));
    expect(p.details).toHaveLength(3);
    expect(p.details[0]).toEqual({ kind: "change", field: "Priority", from: "medium", to: "high" });
    expect(p.details[1]).toMatchObject({ field: "End date", from: undefined });
    expect(p.details[2]).toEqual({ kind: "change", field: "Description", from: undefined, to: undefined });
  });

  it("names the assignee, the subtask, and the attachment", () => {
    expect(activityText(describeActivity(row("card.assigned", { card_title: "Plan", assignee_name: "Member One" })))).toBe("Manager assigned “Plan” to Member One");
    expect(activityText(describeActivity(row("subtask.updated", { title: "Outline", is_done: true })))).toBe("Manager completed subtask “Outline”");
    expect(activityText(describeActivity(row("attachment.deleted", { name: "Brief" })))).toBe("Manager removed attachment “Brief”");
  });

  it("falls back to the member map, then to Someone, for the actor of an old row", () => {
    expect(describeActivity(row("card.created", null, { actor_name: undefined }), { names: { u1: "Member One" } }).actor).toBe("Member One");
    expect(describeActivity(row("card.created", null, { actor_name: null })).actor).toBe("Someone");
  });
});

describe("ActivityLine", () => {
  it("lets a long attachment link wrap inside its box", () => {
    const link = `https://example.com/${"a".repeat(200)}`;
    const { container } = render(<ActivityLine entry={row("card.attachment_added", { name: link, card_title: "Plan" })} />);
    expect(container.firstElementChild).toHaveClass("min-w-0", "wrap-anywhere");
    expect(container).toHaveTextContent(link);
  });

  it("renders the actor in bold, the object quoted, and the columns as badges", () => {
    render(<ActivityLine entry={row("card.moved", { card_title: "Plan", from_column_name: "Todo", to_column_name: "In Progress" })} />);
    expect(screen.getByText("Manager").tagName).toBe("STRONG");
    expect(screen.getByText("“Plan”")).toBeInTheDocument();
    expect(screen.getByText("Todo")).toHaveAttribute("data-tone");
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });
});

describe("iconFor", () => {
  it("picks link, archive, or document", () => {
    expect(iconFor({ url: "https://x.y", name: "x", mime_type: null })).toBe("link");
    expect(iconFor({ url: null, name: "pack.RAR", mime_type: "application/vnd.rar" })).toBe("archive");
    expect(iconFor({ url: null, name: "brief.pdf", mime_type: "application/pdf" })).toBe("document");
  });
});
