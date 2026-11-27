"use client";

import { createContext, useContext } from "react";
import type { Session } from "@/lib/session";
import type { Board, Inbox, User } from "@/lib/types";

export type PanelView = "inbox" | "activity" | "members" | "categories";

export interface ShellState {
  session: Session | null;
  user: User | null;
  boardId: string | null;
  board: Board | null;
  boards: Board[];
  inbox: Inbox | null;
  refreshInbox: () => Promise<void>;
  toggleSidePanel: (view: PanelView) => void;
  closeSidePanel: () => void;
  panel: PanelView | null;
  adjustUnread: (delta: number) => void;
  shareOpen: boolean;
  openShare: () => void;
  closeShare: () => void;
  pendingRequests: number;
  setPendingRequests: (n: number) => void;
}

export const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside AppShell");
  return ctx;
}
