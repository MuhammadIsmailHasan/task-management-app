import { vi } from "vitest";
import type { ShellState } from "@/components/shell/ShellContext";

/** A complete ShellContext value for tests: every field has a harmless default, a test overrides what it reads. */
export function shellValue(over: Partial<ShellState> = {}): ShellState {
  return {
    session: null,
    user: null,
    boardId: null,
    board: null,
    boards: [],
    panel: null,
    inbox: null,
    refreshInbox: vi.fn().mockResolvedValue(undefined),
    toggleSidePanel: vi.fn(),
    closeSidePanel: vi.fn(),
    adjustUnread: vi.fn(),
    shareOpen: false,
    openShare: vi.fn(),
    closeShare: vi.fn(),
    pendingRequests: 0,
    setPendingRequests: vi.fn(),
    ...over,
  };
}
