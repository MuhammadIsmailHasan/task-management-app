"use client";

import { createContext, useContext } from "react";
import type { Session } from "@/lib/session";
import type { Board, Inbox, User } from "@/lib/types";

export type PanelView = "inbox" | "activity" | "members" | "categories";

export interface ShellState {
  session: Session | null;
  user: User | null;
  /** The id of the open Board, from the slug in the URL, or null off a Board. */
  boardId: string | null;
  /** The open Board as the layout listed it. */
  board: Board | null;
  /** The Boards the viewer may see (the server layout loads them). */
  boards: Board[];
  inbox: Inbox | null;
  refreshInbox: () => Promise<void>;
  /** The one function the Top_Menu and the header bell call to open or close a Side_Panel view. */
  toggleSidePanel: (view: PanelView) => void;
  closeSidePanel: () => void;
  /** The view the Side_Panel shows, or null when it is closed. */
  panel: PanelView | null;
  /** Lower or raise the unread count at once, before the server answers. */
  adjustUnread: (delta: number) => void;
  /** The Share_Modal of the open Board (Requirement 55). */
  shareOpen: boolean;
  openShare: () => void;
  closeShare: () => void;
  /** Pending join requests of the open Board, for the badge on the Share item. */
  pendingRequests: number;
  setPendingRequests: (n: number) => void;
}

export const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside AppShell");
  return ctx;
}
