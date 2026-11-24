"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { getSession, getStoredUser, storeUser, type Session } from "@/lib/session";
import { panelTitle } from "@/lib/titles";
import type { Board, Inbox, User } from "@/lib/types";
import { AppHeader } from "./AppHeader";
import { ShellContext, type PanelView } from "./ShellContext";
import { SidePanel } from "./SidePanel";
import { IconRail } from "./IconRail";
import { NavDrawer } from "./NavDrawer";
import { SkipLink } from "./SkipLink";

/** Client shell: the canvas, the Icon_Rail, and one app frame holding the header and the page; the nav drawer and the side panel host (Requirement 39). */
export function AppShell({ boards, children }: { boards: Board[]; children: ReactNode }) {
  const pathname = usePathname();
  const boardId = /^\/boards\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [panel, setPanel] = useState<PanelView | null>(null);

  useEffect(() => {
    setSession(getSession());
    setUser(getStoredUser());
  }, [pathname]);

  const refreshInbox = useCallback(async () => {
    if (!getSession()) return;
    try {
      setInbox(await api.notifications.inbox());
    } catch {
      setInbox(null);
    }
  }, []);

  useEffect(() => {
    if (session) void refreshInbox();
  }, [session, refreshInbox]);

  // The stored user can be stale (a signed avatar URL lives 15 minutes), so load it fresh once per session.
  useEffect(() => {
    if (!session) return;
    let live = true;
    api.auth
      .me()
      .then((fresh) => {
        if (!live) return;
        storeUser(fresh);
        setUser(fresh);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [session]);

  // An open Inbox or Activity panel names the tab; closing it restores the page title (Requirement 32, criterion 4).
  useEffect(() => {
    if (!panel) return;
    const previous = document.title;
    document.title = panelTitle(panel, inbox?.unread_count ?? 0);
    return () => {
      document.title = previous;
    };
  }, [panel, inbox?.unread_count]);

  const toggleSidePanel = useCallback((view: PanelView) => setPanel((cur) => (cur === view ? null : view)), []);
  const closeSidePanel = useCallback(() => setPanel(null), []);
  const adjustUnread = useCallback(
    (delta: number) => setInbox((cur) => (cur ? { ...cur, unread_count: Math.max(0, cur.unread_count + delta) } : cur)),
    [],
  );
  const state = useMemo(
    () => ({ session, user, boardId, boards, panel, inbox, refreshInbox, toggleSidePanel, closeSidePanel, adjustUnread }),
    [session, user, boardId, boards, panel, inbox, refreshInbox, toggleSidePanel, closeSidePanel, adjustUnread],
  );
  const current = boards.find((b) => b.id === boardId);

  return (
    <ShellContext.Provider value={state}>
      <div className="relative flex h-screen overflow-hidden bg-surface lg:gap-4 lg:p-page">
        <SkipLink />
        <IconRail />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-raised lg:rounded-frame lg:shadow-card">
          <AppHeader board={current ?? null} drawerOpen={drawer} onToggleDrawer={() => setDrawer((d) => !d)} />
          <main id="main" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto focus:outline-none">
            {children}
          </main>
        </div>
        <NavDrawer open={drawer} onClose={() => setDrawer(false)} />
        <SidePanel view={panel} onClose={() => setPanel(null)} />
      </div>
    </ShellContext.Provider>
  );
}
