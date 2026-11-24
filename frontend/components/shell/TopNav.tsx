"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { cn } from "@/lib/utils";
import { isActive, itemsFor } from "./navItems";
import { useShell } from "./ShellContext";

const pill = "inline-flex min-h-control-sm cursor-pointer items-center gap-2 rounded-full px-4 text-sm no-underline transition-colors duration-fast focus-ring";

/** The labelled pill group in the App_Header from 960 pixels (SHELL-03). */
export function TopNav() {
  const { session, boardId, panel, toggleSidePanel, inbox } = useShell();
  const ctx = { role: session?.role, boardId };
  const pathname = usePathname();
  const unread = inbox?.unread_count ?? 0;

  return (
    <nav aria-label="Main" className="hidden min-h-control items-center gap-1 rounded-full bg-surface p-1 lg:flex">
      {itemsFor("top", ctx).map((item) => {
        const active = isActive(item, ctx, pathname, panel);
        const href = item.href(ctx);
        const cls = cn(pill, active ? "bg-surface-sunken font-semibold text-ink" : "font-medium text-ink-muted hover:text-ink");
        const badge = item.id === "inbox" && unread > 0 && <BaseBadge tone="accent">{unread > 9 ? "9+" : unread}</BaseBadge>;
        return href ? (
          <Link key={item.id} href={href} aria-current={active && !item.panel ? "page" : undefined} className={cls}>
            {item.label}
          </Link>
        ) : (
          <BaseButton key={item.id} variant="ghost" aria-pressed={active} className={cn(cls, "px-4 py-0")} onClick={() => item.panel && toggleSidePanel(item.panel)}>
            {item.label}
            {badge}
          </BaseButton>
        );
      })}
    </nav>
  );
}
