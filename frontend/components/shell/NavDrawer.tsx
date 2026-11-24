"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseDrawer } from "@/components/shared/BaseDrawer";
import { cn } from "@/lib/utils";
import { isActive, itemsFor } from "./navItems";
import { useShell } from "./ShellContext";

const row = "flex min-h-touch w-full cursor-pointer items-center gap-3 rounded-card px-3 text-sm font-medium no-underline transition-colors duration-fast focus-ring [&_svg]:size-icon [&_svg]:shrink-0";

/** Below 960 pixels the rail and the Top_Nav become this drawer: the same items as 44 pixel rows, then the Boards (SHELL-04). */
export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, boardId, boards, panel, toggleSidePanel, inbox } = useShell();
  const ctx = { role: session?.role, boardId };
  const pathname = usePathname();
  const unread = inbox?.unread_count ?? 0;

  // A route change closes the drawer through the link's own click; panel items close it here.
  return (
    <BaseDrawer open={open} onClose={onClose} title="Menu">
      <nav aria-label="Menu" className="flex flex-col gap-1">
        {itemsFor("drawer", ctx).map((item) => {
          const Icon = item.icon;
          const active = isActive(item, ctx, pathname, panel);
          const href = item.href(ctx);
          const cls = cn(row, active ? "bg-surface-sunken text-ink" : "text-ink-muted hover:bg-surface-sunken hover:text-ink");
          const inner = (
            <>
              <Icon aria-hidden="true" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "inbox" && unread > 0 && <BaseBadge tone="accent">{unread > 9 ? "9+" : unread}</BaseBadge>}
            </>
          );
          return href ? (
            <Link key={item.id} href={href} onClick={onClose} aria-current={active && !item.panel ? "page" : undefined} className={cls}>
              {inner}
            </Link>
          ) : (
            <BaseButton
              key={item.id}
              variant="ghost"
              className={cn(cls, "justify-start")}
              onClick={() => {
                if (item.panel) toggleSidePanel(item.panel);
                onClose();
              }}
            >
              {inner}
            </BaseButton>
          );
        })}
      </nav>
      {boards.length > 0 && (
        <section aria-label="Boards" className="flex flex-col gap-1">
          <h3 className="px-3 text-2xs text-ink-muted uppercase">Boards</h3>
          {boards.map((b) => (
            <Link key={b.id} href={`/boards/${b.id}`} onClick={onClose} aria-current={b.id === boardId ? "page" : undefined} className={cn(row, "font-normal break-words", b.id === boardId ? "bg-surface-sunken text-ink" : "text-ink")}>
              <span className="min-w-0">{b.name}</span>
            </Link>
          ))}
        </section>
      )}
    </BaseDrawer>
  );
}
