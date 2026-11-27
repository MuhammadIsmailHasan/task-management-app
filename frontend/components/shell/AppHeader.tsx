"use client";

import { ArrowLeft, Bell, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BrandLogo } from "@/components/shared/BrandLogo";
import type { Board } from "@/lib/types";
import { useShell } from "./ShellContext";
import { TopMenu } from "./TopMenu";
import { UserMenu } from "./UserMenu";
import { BOARDS_QUERY_KEY, homeFor, parentOf, routes } from "@/lib/routes";

interface AppHeaderProps {
  board: Board | null;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

export function AppHeader({ board, drawerOpen, onToggleDrawer }: AppHeaderProps) {
  const { session, user, inbox, toggleSidePanel } = useShell();
  const pathname = usePathname() ?? "";
  const parent = parentOf(pathname, session?.role);
  const [boardsQuery, setBoardsQuery] = useState("");
  useEffect(() => {
    try {
      setBoardsQuery(window.sessionStorage.getItem(BOARDS_QUERY_KEY) ?? "");
    } catch {
      setBoardsQuery("");
    }
  }, [pathname]);

  return (
    <header className="z-header flex min-h-touch shrink-0 items-center gap-3 border-b border-line bg-surface-raised px-page py-2 lg:h-header">
      <div className="flex min-w-0 flex-1 items-center lg:min-w-fit gap-3">
      <BaseButton variant="ghost" size="sm" className="size-touch lg:hidden" aria-label="Open menu" aria-expanded={drawerOpen} onClick={onToggleDrawer}>
        <Menu aria-hidden="true" />
      </BaseButton>
      {parent && (
        <Link href={`${parent.href}${parent.href === routes.boards ? boardsQuery : ""}`} aria-label={`Back to ${parent.label}`} className="inline-flex size-touch shrink-0 items-center justify-center rounded-ui text-ink-muted hover:bg-surface-sunken hover:text-ink focus-ring lg:size-control">
          <ArrowLeft className="size-icon" aria-hidden="true" />
        </Link>
      )}
      <div className="flex min-w-0 items-center lg:hidden">
        <Link href={homeFor(session?.role)} className="inline-flex items-center gap-2 font-heading text-page-title text-ink" aria-label="RevoBoard home">
          <BrandLogo variant="mark" size="sm" decorative />
          RevoBoard
        </Link>
      </div>
      </div>
      <div className="flex shrink-0 justify-center">
        <TopMenu />
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 lg:min-w-fit lg:flex-1">
      {session && (
        <>
          <BaseButton variant="ghost" size="sm" className="relative size-control rounded-ui px-0" aria-label="Notifications" onClick={() => toggleSidePanel("inbox")}>
            <Bell aria-hidden="true" />
            {!!inbox?.unread_count && <span aria-hidden="true" className="absolute top-2 right-2 size-alert-dot rounded-full border border-surface-raised bg-accent" />}
          </BaseButton>
          <UserMenu user={user} />
        </>
      )}
      </div>
    </header>
  );
}
