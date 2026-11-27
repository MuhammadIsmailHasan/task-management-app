import { shortDate } from "./format";
import type { ActivityEntry } from "./types";

const VERBS: Record<string, string> = {
  "board.created": "created the board",
  "board.updated": "renamed the board",
  "board.archived": "archived the board",
  "board.unarchived": "unarchived the board",
  "board.deleted": "deleted the board",
  "board.owner_changed": "changed the board owner",
  "board.member_added": "added a member",
  "board.member_removed": "removed a member",
  "column.created": "added a column",
  "card.created": "created",
  "card.updated": "updated",
  "card.moved": "moved",
  "card.assigned": "assigned",
  "card.unassigned": "unassigned",
  "card.archived": "archived",
  "card.unarchived": "unarchived",
  "card.deleted": "deleted",
  "board.invite_enabled": "turned on the invite link",
  "board.invite_regenerated": "replaced the invite link",
  "board.invite_disabled": "turned off the invite link",
  "board.share_enabled": "turned on the public link",
  "board.share_regenerated": "replaced the public link",
  "board.share_disabled": "turned off the public link",
  "board.join_requested": "asked to join the board",
  "board.join_rejected": "declined a request to join the board",
  "card.subtask_added": "added subtask",
  "card.subtask_updated": "updated subtask",
  "card.subtask_removed": "removed subtask",
  "card.attachment_added": "added attachment",
  "card.attachment_removed": "removed attachment",
  "comment.deleted": "deleted a comment on",
  "subtask.added": "added subtask",
  "subtask.updated": "updated subtask",
  "subtask.deleted": "removed subtask",
  "attachment.added": "added attachment",
  "attachment.deleted": "removed attachment",
  "comment.added": "commented on",
  "comment.replied": "replied to a comment on",
  "comment.priority_toggled": "changed the priority flag of a comment on",
};

const NO_OBJECT: Record<string, string> = {
  "card.created": "created a card",
  "card.updated": "updated a card",
  "card.moved": "moved a card",
  "card.assigned": "assigned a card",
  "card.unassigned": "unassigned a card",
  "card.archived": "archived a card",
  "card.unarchived": "unarchived a card",
  "card.deleted": "deleted a card",
  "card.subtask_added": "added a subtask",
  "card.subtask_updated": "updated a subtask",
  "card.subtask_removed": "removed a subtask",
  "card.attachment_added": "added an attachment",
  "card.attachment_removed": "removed an attachment",
  "comment.deleted": "deleted a comment",
  "subtask.added": "added a subtask",
  "subtask.updated": "updated a subtask",
  "subtask.deleted": "removed a subtask",
  "attachment.added": "added an attachment",
  "attachment.deleted": "removed an attachment",
  "comment.added": "commented",
  "comment.replied": "replied to a comment",
  "comment.priority_toggled": "changed a comment's priority flag",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  priority: "Priority",
  start_date: "Start date",
  end_date: "End date",
  category: "Label",
  description: "Description",
};

export type ActivityDetail =
  | { kind: "move"; from?: string; to?: string }
  | { kind: "assign"; to?: string }
  | { kind: "change"; field: string; from?: string; to?: string };

export interface ActivityParts {
  actor: string;
  verb: string;
  object?: string;
  context?: string;
  details: ActivityDetail[];
}

interface Lookups {
  names?: Record<string, string>;
  columns?: Record<string, string>;
}

const text = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

function valueOf(field: string, v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (field === "start_date" || field === "end_date") return shortDate(String(v));
  return String(v);
}

export function describeActivity(entry: ActivityEntry, { names = {}, columns = {} }: Lookups = {}): ActivityParts {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const actor = entry.actor_name ?? names[entry.actor_id] ?? "Someone";
  const cardTitle = text(meta.card_title) ?? text(meta.title);
  let verb = VERBS[entry.action] ?? entry.action.replace(".", " ");
  let object: string | undefined;
  let context: string | undefined;
  const details: ActivityDetail[] = [];

  switch (entry.action) {
    case "card.moved":
      object = cardTitle;
      details.push({
        kind: "move",
        from: text(meta.from_column_name) ?? columns[String(meta.from_column_id)],
        to: text(meta.to_column_name) ?? columns[String(meta.to_column_id)],
      });
      break;
    case "card.assigned":
      object = cardTitle;
      details.push({ kind: "assign", to: text(meta.assignee_name) ?? names[String(meta.assignee_id)] });
      break;
    case "card.updated": {
      object = cardTitle;
      const changes = (meta.changes ?? {}) as Record<string, { from?: unknown; to?: unknown }>;
      for (const [field, c] of Object.entries(changes)) {
        details.push({ kind: "change", field: FIELD_LABELS[field] ?? field, from: valueOf(field, c?.from), to: valueOf(field, c?.to) });
      }
      break;
    }
    case "subtask.updated":
    case "card.subtask_updated":
      if (typeof meta.is_done === "boolean") verb = meta.is_done ? "completed subtask" : "reopened subtask";
      object = text(meta.title);
      context = text(meta.card_title);
      break;
    case "subtask.added":
    case "subtask.deleted":
    case "card.subtask_added":
    case "card.subtask_removed":
      object = text(meta.title);
      context = text(meta.card_title);
      break;
    case "attachment.added":
    case "attachment.deleted":
    case "card.attachment_added":
    case "card.attachment_removed":
      object = text(meta.name);
      context = text(meta.card_title);
      break;
    case "comment.added":
    case "comment.replied":
    case "comment.deleted":
      object = cardTitle;
      break;
    case "comment.priority_toggled":
      verb = meta.is_priority === false ? "removed the priority flag from a comment on" : "flagged a comment as priority on";
      object = cardTitle;
      break;
    default:
      object = cardTitle ?? text(meta.name) ?? text(meta.board_name);
  }
  if (!object) verb = NO_OBJECT[entry.action] ?? verb.replace(/ on$/, "");
  return { actor, verb, object, context, details };
}

export function activityText(p: ActivityParts): string {
  let out = `${p.actor} ${p.verb}`;
  if (p.object) out += ` “${p.object}”`;
  for (const d of p.details) {
    if (d.kind === "move") out += ` from ${d.from ?? "?"} to ${d.to ?? "?"}`;
    else if (d.kind === "assign") out += ` to ${d.to ?? "someone"}`;
    else out += `; ${d.field}${d.from || d.to ? `: ${d.from ?? "none"} to ${d.to ?? "none"}` : " changed"}`;
  }
  return out;
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
