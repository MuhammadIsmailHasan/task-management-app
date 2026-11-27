"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { getSession, getStoredUser, storeUser, type Session } from "@/lib/session";
import { panelTitle } from "@/lib/titles";
import type { Board, Inbox, User } from "@/lib/types";
import { AppHeader } from "./AppHeader";
import { ShellContext, type PanelView } from "./ShellContext";
import { SidePanel } from "./SidePanel";
import { ShareModal } from "@/components/board/ShareModal";
import { Sidebar } from "./Sidebar";
import { NavDrawer } from "./NavDrawer";
import { SkipLink } from "./SkipLink";

export function AppShell({ boards, children }: { boards: Board[]; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const slug = /^\/app\/b\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const current = boards.find((b) => b.slug === slug) ?? null;
  const boardId = current?.id ?? null;
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [panel, setPanel] = useState<PanelView | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    setSession(getSession());
    setUser(getStoredUser());
  }, [pathname]);

  useEffect(() => {
    if (slug && !current) router.refresh();
  }, [slug, current, router]);

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

  useEffect(() => {
    if (!panel) return;
    const previous = document.title;
    document.title = panelTitle(panel, inbox?.unread_count ?? 0);
    return () => {
      document.title = previous;
    };
  }, [panel, inbox?.unread_count]);

  useEffect(() => {
    if (!boardId) setPanel((cur) => (cur && cur !== "inbox" ? null : cur));
    setShareOpen(false);
    setPendingRequests(0);
  }, [boardId]);

  const decides = session?.role === "manager" || session?.role === "admin";
  useEffect(() => {
    if (!boardId || !decides) return;
    let live = true;
    api.boards
      .joinRequests(boardId)
      .then((rows) => live && setPendingRequests(rows.length))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [boardId, decides]);

  useEffect(() => {
    if (boardId && new URLSearchParams(window.location.search).get("invite") === "1") setShareOpen(true);
  }, [boardId]);

  const toggleSidePanel = useCallback((view: PanelView) => setPanel((cur) => (cur === view ? null : view)), []);
  const closeSidePanel = useCallback(() => setPanel(null), []);
  const adjustUnread = useCallback(
    (delta: number) => setInbox((cur) => (cur ? { ...cur, unread_count: Math.max(0, cur.unread_count + delta) } : cur)),
    [],
  );
  const openShare = useCallback(() => setShareOpen(true), []);
  const closeShare = useCallback(() => {
    setShareOpen(false);
    if (new URLSearchParams(window.location.search).get("invite")) router.replace(pathname);
  }, [router, pathname]);
  const state = useMemo(
    () => ({ session, user, boardId, board: current, boards, panel, inbox, refreshInbox, toggleSidePanel, closeSidePanel, adjustUnread, shareOpen, openShare, closeShare, pendingRequests, setPendingRequests }),
    [session, user, boardId, current, boards, panel, inbox, refreshInbox, toggleSidePanel, closeSidePanel, adjustUnread, shareOpen, openShare, closeShare, pendingRequests],
  );

  return (
    <ShellContext.Provider value={state}>
      <div className="relative flex h-screen overflow-hidden bg-surface lg:gap-4 lg:p-page">
        <SkipLink />
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-raised lg:rounded-ui lg:shadow-card">
          <AppHeader board={current} drawerOpen={drawer} onToggleDrawer={() => setDrawer((d) => !d)} />
          <main id="main" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto focus:outline-none">
            {children}
          </main>
        </div>
        <NavDrawer open={drawer} onClose={() => setDrawer(false)} />
        <SidePanel view={panel} onClose={() => setPanel(null)} />
        {current && (
          <ShareModal
            boardId={current.id}
            boardName={current.name}
            open={shareOpen}
            onClose={closeShare}
            canPublicLink={decides}
            canDecide={decides}
            onPendingChange={setPendingRequests}
          />
        )}
      </div>
    </ShellContext.Provider>
  );
}
