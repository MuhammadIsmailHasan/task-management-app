"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseTooltip } from "@/components/shared/BaseTooltip";
import { cn } from "@/lib/utils";
import { isActive, itemsFor, type NavItemDef } from "./navItems";
import { useShell } from "./ShellContext";

const circle = "relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-fast focus-ring [&_svg]:size-icon";

/** The white pill at the left of every page from 960 pixels: the Home circle, then one 40 pixel circle per item (SHELL-01, SHELL-02). */
export function IconRail() {
  const { session, boardId, panel, toggleSidePanel, inbox } = useShell();
  const ctx = { role: session?.role, boardId };
  const pathname = usePathname();
  const items = itemsFor("rail", ctx);

  function render(item: NavItemDef) {
    const Icon = item.icon;
    const active = isActive(item, ctx, pathname, panel);
    const href = item.href(ctx);
    const home = item.id === "home";
    const classes = cn(
      circle,
      home ? "size-touch bg-accent text-on-accent shadow-popover hover:bg-accent-strong" : "size-control",
      !home && (active ? "bg-accent text-on-accent" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"),
    );
    const unread = item.id === "inbox" && !!inbox?.unread_count;
    const inner = (
      <>
        <Icon aria-hidden="true" />
        {unread && <span aria-hidden="true" className="absolute top-2 right-2 size-alert-dot rounded-full bg-accent-tint" />}
      </>
    );
    const el = href ? (
      <Link href={href} aria-label={item.label} aria-current={active && !item.panel ? "page" : undefined} className={classes}>
        {inner}
      </Link>
    ) : (
      <BaseButton variant="ghost" aria-label={item.label} aria-pressed={active} className={cn(classes, "p-0")} onClick={() => item.panel && toggleSidePanel(item.panel)}>
        {inner}
      </BaseButton>
    );
    return (
      <BaseTooltip key={item.id} label={item.label} side="right">
        {el}
      </BaseTooltip>
    );
  }

  return (
    <nav aria-label="Rail" className="hidden w-rail shrink-0 flex-col items-center gap-2 rounded-full bg-surface-raised py-6 shadow-card lg:flex">
      {items.map(render)}
    </nav>
  );
}
