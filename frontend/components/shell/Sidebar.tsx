"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseTooltip } from "@/components/shared/BaseTooltip";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";
import { isSidebarActive, sidebarFor } from "./navItems";
import { useShell } from "./ShellContext";

const row = "relative flex shrink-0 cursor-pointer items-center rounded-full no-underline transition-colors duration-fast focus-ring [&_svg]:size-icon [&_svg]:shrink-0";

/**
 * The left Sidebar from 960 pixels: the global places only (Dashboard, My Tasks, Boards, Users). Expanded it shows
 * each label; collapsed it shows icons with tooltips. The board's own places are in the Top_Menu (NAV-01, NAV-02, NAV-09).
 */
export function Sidebar() {
  const { session, board } = useShell();
  const pathname = usePathname();
  const { expanded, toggle } = useSidebarState();
  const ctx = { role: session?.role, boardOpen: !!board, isOwner: !!board && !!session && board.owner_id === session.userId };

  return (
    <nav
      aria-label="Sidebar"
      className={cn(
        "hidden shrink-0 flex-col gap-2 rounded-frame bg-surface-raised p-3 shadow-card transition-all duration-base lg:flex",
        expanded ? "w-sidebar" : "w-sidebar-collapsed",
      )}
    >
      <BaseButton
        variant="ghost"
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        aria-expanded={expanded}
        className={cn(row, "size-touch self-end px-0 text-ink-muted hover:bg-surface-sunken hover:text-ink", !expanded && "self-center")}
        onClick={toggle}
      >
        {expanded ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
      </BaseButton>
      {sidebarFor(ctx).map((item) => {
        const Icon = item.icon;
        const active = isSidebarActive(item, pathname);
        const link = (
          <Link
            href={item.href}
            aria-label={expanded ? undefined : item.label}
            aria-current={active ? "page" : undefined}
            className={cn(row, expanded ? "min-h-touch gap-3 px-3 text-sm font-medium" : "size-touch justify-center self-center", active ? "bg-accent text-on-accent" : "text-ink-muted hover:bg-surface-sunken hover:text-ink")}
          >
            <Icon aria-hidden="true" />
            {expanded && <span className="min-w-0 truncate">{item.label}</span>}
          </Link>
        );
        // a tooltip only while collapsed: expanded rows already show their label
        return expanded ? (
          <div key={item.id} className="contents">
            {link}
          </div>
        ) : (
          <BaseTooltip key={item.id} label={item.label} side="right">
            {link}
          </BaseTooltip>
        );
      })}
    </nav>
  );
}
