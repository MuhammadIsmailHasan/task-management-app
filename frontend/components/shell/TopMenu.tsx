"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseTooltip } from "@/components/shared/BaseTooltip";
import { cn } from "@/lib/utils";
import { isTopMenuActive, topMenuFor, type TopMenuItem } from "./navItems";
import { useShell } from "./ShellContext";

const pill = "relative inline-flex min-h-control-sm cursor-pointer items-center gap-2 rounded-ui px-3 text-sm no-underline transition-colors duration-fast focus-ring [&_svg]:size-icon-sm [&_svg]:shrink-0";

export function TopMenu() {
  const { session, board, panel, toggleSidePanel, shareOpen, openShare, pendingRequests } = useShell();
  const pathname = usePathname();
  if (!board) return null;
  const ctx = { role: session?.role, boardOpen: true, isOwner: !!session && board.owner_id === session.userId };
  const canDecide = session?.role === "manager" || session?.role === "admin";

  function render(item: TopMenuItem) {
    const Icon = item.icon;
    const active = isTopMenuActive(item, board!.slug, pathname, panel, shareOpen);
    const cls = cn(pill, active ? "bg-surface-sunken font-semibold text-ink" : "font-medium text-ink-muted hover:text-ink");
    const inner = (
      <>
        <Icon aria-hidden="true" />
        <span className="hidden xl:inline">{item.label}</span>
        {item.share && canDecide && pendingRequests > 0 && <BaseBadge tone="accent">{pendingRequests > 9 ? "9+" : pendingRequests}</BaseBadge>}
      </>
    );
    const name = item.share && canDecide && pendingRequests > 0 ? `${item.label}, ${pendingRequests} waiting` : item.label;
    let el;
    if (item.href) {
      el = (
        <Link href={item.href(board!.slug)} aria-label={name} aria-current={active ? "page" : undefined} className={cls}>
          {inner}
        </Link>
      );
    } else {
      el = (
        <BaseButton
          variant="ghost"
          aria-label={name}
          aria-pressed={item.panel ? active : undefined}
          aria-haspopup={item.share ? "dialog" : undefined}
          className={cn(cls, "py-0")}
          onClick={() => (item.panel ? toggleSidePanel(item.panel) : openShare())}
        >
          {inner}
        </BaseButton>
      );
    }
    return (
      <BaseTooltip key={item.id} label={item.label} side="bottom">
        {el}
      </BaseTooltip>
    );
  }

  return (
    <nav aria-label="Board" className="hidden min-h-control items-center gap-1 rounded-ui bg-surface p-1 lg:flex">
      {topMenuFor(ctx).map(render)}
    </nav>
  );
}
