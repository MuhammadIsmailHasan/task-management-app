"use client";

import { Bell, Menu } from "lucide-react";
import Link from "next/link";
import { BaseButton } from "@/components/shared/BaseButton";
import { BrandLogo } from "@/components/shared/BrandLogo";
import type { Board } from "@/lib/types";
import { useShell } from "./ShellContext";
import { TopNav } from "./TopNav";
import { UserMenu } from "./UserMenu";

interface AppHeaderProps {
  /** The Board the page shows, if any: below 960 pixels its name stands where the wordmark would. */
  board: Board | null;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

/** The one header on every protected page, inside the app frame: logo, Top_Nav, bell, User_Menu (SHELL-09). */
export function AppHeader({ board, drawerOpen, onToggleDrawer }: AppHeaderProps) {
  const { session, user, inbox, toggleSidePanel } = useShell();

  return (
    <header className="z-header flex min-h-touch shrink-0 items-center gap-3 bg-surface-raised px-page py-2 lg:h-header">
      <BaseButton variant="ghost" size="sm" className="size-touch lg:hidden" aria-label="Open menu" aria-expanded={drawerOpen} onClick={onToggleDrawer}>
        <Menu aria-hidden="true" />
      </BaseButton>
      <div className="flex min-w-0 items-center lg:flex-none">
        {board ? (
          <h1 className="min-w-0 font-heading text-page-title break-words lg:hidden">{board.name}</h1>
        ) : null}
        <Link href="/boards" className={board ? "hidden lg:inline-flex" : "inline-flex"} aria-label="RevoBoard home">
          <BrandLogo variant="full" size="sm" decorative className="hidden lg:block" />
          <span className="inline-flex items-center gap-2 font-heading text-page-title text-ink lg:hidden">
            <BrandLogo variant="mark" size="sm" decorative />
            RevoBoard
          </span>
        </Link>
      </div>
      <div className="flex flex-1 justify-center">
        <TopNav />
      </div>
      {session && (
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <BaseButton variant="ghost" size="sm" className="relative size-control rounded-full px-0" aria-label="Notifications" onClick={() => toggleSidePanel("inbox")}>
            <Bell aria-hidden="true" />
            {!!inbox?.unread_count && <span aria-hidden="true" className="absolute top-2 right-2 size-alert-dot rounded-full border border-surface-raised bg-accent" />}
          </BaseButton>
          <UserMenu user={user} />
        </div>
      )}
    </header>
  );
}
