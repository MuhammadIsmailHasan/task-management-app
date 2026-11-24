"use client";

import { createContext, useContext } from "react";
import type { Session } from "@/lib/session";
import type { Board, Inbox, User } from "@/lib/types";

export type PanelView = "inbox" | "activity" | "team";

export interface ShellState {
  session: Session | null;
  user: User | null;
  boardId: string | null;
  /** The Boards the viewer may see (the server layout loads them). */
  boards: Board[];
  inbox: Inbox | null;
  refreshInbox: () => Promise<void>;
  /** The one function the rail, the Top_Nav, and the header bell all call. */
  toggleSidePanel: (view: PanelView) => void;
  closeSidePanel: () => void;
  /** The view the Side_Panel shows, or null when it is closed. */
  panel: PanelView | null;
  /** Lower or raise the unread count at once, before the server answers. */
  adjustUnread: (delta: number) => void;
}

export const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside AppShell");
  return ctx;
}
