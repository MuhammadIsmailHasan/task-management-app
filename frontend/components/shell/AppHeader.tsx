"use client";

import { Bell, Menu } from "lucide-react";
import Link from "next/link";
import { InviteButton } from "@/components/board/InviteButton";
import { PublicLinkButton } from "@/components/board/PublicLinkButton";
import { BaseButton } from "@/components/shared/BaseButton";
import { BrandLogo } from "@/components/shared/BrandLogo";
import type { Board } from "@/lib/types";
import { useShell } from "./ShellContext";
import { UserMenu } from "./UserMenu";

interface AppHeaderProps {
  /** The Board the page shows, if any: the header's page-context slot. */
  board: Board | null;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

/** The one header on every protected page: menu (below 960px), brand or Board name, Invite, Public link, Inbox bell, and the User_Menu. */
export function AppHeader({ board, drawerOpen, onToggleDrawer }: AppHeaderProps) {
  const { session, user, inbox, toggleSidePanel } = useShell();
  const isStaff = !!session && (session.role === "manager" || session.role === "admin");
  const canPublicLink = !!board && isStaff;
  const canInvite = !!board && !!session && (isStaff || board.owner_id === session.userId);

  return (
    <header className="z-header flex min-h-touch shrink-0 items-center gap-3 border-b border-line bg-surface-raised px-2 py-1 lg:px-8">
      <BaseButton variant="secondary" size="sm" className="size-control-sm lg:hidden" aria-label="Open menu" aria-expanded={drawerOpen} onClick={onToggleDrawer}>
        <Menu aria-hidden="true" />
      </BaseButton>
      {board ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="min-w-0 text-page-title font-semibold break-words">{board.name}</h1>
          {canInvite && <InviteButton boardId={board.id} canDecide={isStaff} />}
          {canPublicLink && <PublicLinkButton boardId={board.id} />}
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <Link href="/boards" className="inline-flex items-center gap-2 text-page-title font-semibold text-ink no-underline">
            <BrandLogo variant="mark" size="sm" decorative className="lg:hidden" />
            RevoBoard
          </Link>
        </div>
      )}
      {session && (
        <div className="flex items-center gap-2">
          <BaseButton variant="ghost" size="sm" className="relative size-control px-0" aria-label="Notifications" onClick={() => toggleSidePanel("inbox")}>
            <Bell aria-hidden="true" />
            {!!inbox?.unread_count && <span aria-hidden="true" className="absolute top-2 right-2 size-alert-dot rounded-full border border-surface-raised bg-danger" />}
          </BaseButton>
          <UserMenu user={user} />
        </div>
      )}
    </header>
  );
}
