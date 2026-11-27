import type { CardInput } from "./api";
import type { Card } from "./types";

export type FieldKey = "title" | "description" | "priority" | "category_id" | "assignee_id" | "dates";

export interface Draft {
  title: string;
  description: string;
  priority: Card["priority"];
  start_date: string;
  end_date: string;
  category_id: string;
  assignee_id: string;
}

export const toDraft = (c: Card): Draft => ({
  title: c.title,
  description: c.description ?? "",
  priority: c.priority,
  start_date: c.start_date ?? "",
  end_date: c.end_date ?? "",
  category_id: c.category_id ?? "",
  assignee_id: c.assignee_id ?? "",
});

export function buildPatch(field: FieldKey, saved: Draft, draft: Draft): CardInput | null {
  switch (field) {
    case "title": {
      const title = draft.title.trim();
      return title && title !== saved.title ? { title } : null;
    }
    case "description":
      return draft.description !== saved.description ? { description: draft.description || null } : null;
    case "priority":
      return draft.priority !== saved.priority ? { priority: draft.priority } : null;
    case "category_id":
      return draft.category_id !== saved.category_id ? { category_id: draft.category_id || null } : null;
    case "assignee_id":
      return draft.assignee_id !== saved.assignee_id ? { assignee_id: draft.assignee_id || null } : null;
    case "dates":
      return draft.start_date !== saved.start_date || draft.end_date !== saved.end_date
        ? { start_date: draft.start_date || null, end_date: draft.end_date || null }
        : null;
  }
}

export function mergeSent(card: Card, saved: Card, sent: string[]): Card {
  const next: Card = { ...card };
  for (const key of sent) {
    if (key in saved) (next as unknown as Record<string, unknown>)[key] = (saved as unknown as Record<string, unknown>)[key];
  }
  if (sent.includes("assignee_id")) {
    next.assignee_name = saved.assignee_name;
    next.assignee_avatar_url = saved.assignee_avatar_url;
  }
  return next;
}
