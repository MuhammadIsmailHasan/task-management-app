import { boardPath, boardByIdPath, cardPath, routes } from "./routes";
import type { Notification } from "./types";

/** Where a Notification leads (Requirement 28, criterion 5). */
export function hrefFor(n: Notification): string {
  // `board_slug` is the Board's current address; an id-only row falls back to the redirect-only route
  const board = n.board_slug ? boardPath(n.board_slug) : n.board_id ? boardByIdPath(n.board_id) : null;
  const card = n.board_slug && n.card_id ? cardPath(n.board_slug, n.card_id) : null;
  switch (n.type) {
    case "assigned":
    case "deadline":
    case "comment_on_assigned":
    case "due_today":
    case "due_tomorrow":
    case "subtask_on_assigned":
      return card ?? board ?? routes.boards;
    case "assigned_card_changed":
      // a moved Card opens; an archived or deleted one is not available, so the Board shows it with the usual message (NPF-08)
      return n.action === "moved" ? (card ?? board ?? routes.boards) : (board ?? routes.boards);
    case "board_join_requested":
      return n.board_slug ? boardPath(n.board_slug, { invite: "1" }) : (board ?? routes.boards);
    case "board_added":
      return board ?? routes.boards;
    default:
      return routes.boards; // board_join_rejected: the requester has no access to the Board
  }
}

/** One sentence naming the actor and the Board or Card (Requirement 28, criterion 11). Never an Email. */
export function sentenceFor(n: Notification): string {
  const board = n.board_name ?? "a board";
  const actor = n.actor_name ?? "Someone";
  switch (n.type) {
    case "assigned":
      return n.card_title ? `You were assigned “${n.card_title}”` : "A card was assigned to you";
    case "deadline":
    case "due_today":
      return n.card_title ? `“${n.card_title}” is due today` : "A card is due today";
    case "due_tomorrow":
      return n.card_title ? `“${n.card_title}” is due tomorrow` : "A card is due tomorrow";
    case "comment_on_assigned":
      return `${actor} commented on “${n.card_title ?? "a card"}”`;
    case "assigned_card_changed":
      return `${actor} ${n.action ?? "changed"} “${n.card_title ?? "a card"}”`;
    case "subtask_on_assigned":
      return `${actor} updated a subtask on “${n.card_title ?? "a card"}”`;
    case "board_join_requested":
      return `${actor} asked to join “${board}”`;
    case "board_added":
      return `You were added to “${board}”`;
    default:
      return `Your request to join “${board}” was declined`;
  }
}
