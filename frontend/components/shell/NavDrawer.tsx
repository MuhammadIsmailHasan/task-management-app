"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseDrawer } from "@/components/shared/BaseDrawer";
import { boardPath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { isSidebarActive, isTopMenuActive, sidebarFor, topMenuFor } from "./navItems";
import { useShell } from "./ShellContext";

const row = "flex min-h-touch w-full cursor-pointer items-center gap-3 rounded-ui px-3 text-sm font-medium no-underline transition-colors duration-fast focus-ring [&_svg]:size-icon [&_svg]:shrink-0";

/**
 * Below 960 pixels the Sidebar and the Top_Menu become this drawer: the global items as 44 pixel rows, then, while a
 * Board is open, the group "This board", then the Boards (NAV-03). It closes on a route change through each link.
 */
export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, board, boardId, boards, panel, toggleSidePanel, shareOpen, openShare, pendingRequests } = useShell();
  const pathname = usePathname();
  const ctx = { role: session?.role, boardOpen: !!board, isOwner: !!board && !!session && board.owner_id === session.userId };
  const canDecide = session?.role === "manager" || session?.role === "admin";

  return (
    <BaseDrawer open={open} onClose={onClose} title="Menu">
      <nav aria-label="Menu" className="flex flex-col gap-1">
        {sidebarFor(ctx).map((item) => {
          const Icon = item.icon;
          const active = isSidebarActive(item, pathname);
          return (
            <Link key={item.id} href={item.href} onClick={onClose} aria-current={active ? "page" : undefined} className={cn(row, active ? "bg-surface-sunken text-ink" : "text-ink-muted hover:bg-surface-sunken hover:text-ink")}>
              <Icon aria-hidden="true" />
              <span className="flex-1 text-left">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {board && (
        <nav aria-label="This board" className="flex flex-col gap-1">
          <h3 className="px-3 text-xs text-ink-muted uppercase">This board</h3>
          {topMenuFor(ctx).map((item) => {
            const Icon = item.icon;
            const active = isTopMenuActive(item, board.slug, pathname, panel, shareOpen);
            const cls = cn(row, active ? "bg-surface-sunken text-ink" : "text-ink-muted hover:bg-surface-sunken hover:text-ink");
            const inner = (
              <>
                <Icon aria-hidden="true" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.share && canDecide && pendingRequests > 0 && <BaseBadge tone="accent">{pendingRequests > 9 ? "9+" : pendingRequests}</BaseBadge>}
              </>
            );
            return item.href ? (
              <Link key={item.id} href={item.href(board.slug)} onClick={onClose} aria-current={active ? "page" : undefined} className={cls}>
                {inner}
              </Link>
            ) : (
              <BaseButton
                key={item.id}
                variant="ghost"
                className={cn(cls, "justify-start")}
                onClick={() => {
                  if (item.panel) toggleSidePanel(item.panel);
                  else openShare();
                  onClose();
                }}
              >
                {inner}
              </BaseButton>
            );
          })}
        </nav>
      )}
      {boards.length > 0 && (
        <section aria-label="Boards" className="flex flex-col gap-1">
          <h3 className="px-3 text-xs text-ink-muted uppercase">Boards</h3>
          {boards.map((b) => (
            <Link key={b.id} href={boardPath(b.slug)} onClick={onClose} aria-current={b.id === boardId ? "page" : undefined} className={cn(row, "font-normal break-words", b.id === boardId ? "bg-surface-sunken text-ink" : "text-ink")}>
              <span className="min-w-0">{b.name}</span>
            </Link>
          ))}
        </section>
      )}
    </BaseDrawer>
  );
}
