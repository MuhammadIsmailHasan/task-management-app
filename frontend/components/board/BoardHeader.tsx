"use client";

import { Search, TrendingUp } from "lucide-react";
import { BaseInput } from "@/components/shared/BaseField";
import { useShell } from "@/components/shell/ShellContext";
import { BoardSwitcher } from "@/components/shell/BoardSwitcher";
import type { Board, Card, Category, Member } from "@/lib/types";
import { FilterRow } from "./FilterRow";
import { InviteButton } from "./InviteButton";
import { PublicLinkButton } from "./PublicLinkButton";

interface BoardHeaderProps {
  board: Board;
  cards: Card[];
  members: Member[];
  categories: Category[];
  categoryId: string | null;
  search: string;
  onSearch: (value: string) => void;
  onCategory: (id: string | null) => void;
}

/** The Board_Toolbar and the filter bar (SHELL-12, SHELL-16, SHELL-17; reference `01-board-desktop.png`). */
export function BoardHeader({ board, cards, categories, categoryId, search, onSearch, onCategory }: BoardHeaderProps) {
  const { session } = useShell();
  const isStaff = !!session && (session.role === "manager" || session.role === "admin");
  const canInvite = !!session && (isStaff || board.owner_id === session.userId);
  const doneId = board.columns?.find((c) => c.name === "Done")?.id;
  const done = doneId ? cards.filter((c) => c.column_id === doneId).length : 0;
  const percent = cards.length ? Math.round((done / cards.length) * 100) : 0;
  const columnCount = board.columns?.length ?? 0;

  return (
    <header className="relative z-header flex shrink-0 flex-col gap-4 px-page pt-2 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="inline-flex items-center gap-2 text-2xs text-ink-muted uppercase">
            <i aria-hidden="true" className="size-dot rounded-full bg-accent" />
            Active board
          </span>
          <BoardSwitcher board={board} />
          <p className="text-sm text-ink-muted">
            {columnCount} Columns · {cards.length} Total Tasks{board.description ? ` · ${board.description}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && <PublicLinkButton boardId={board.id} />}
          {canInvite && <InviteButton boardId={board.id} canDecide={isStaff} />}
        </div>
      </div>
      <section aria-label="Filters" className="flex flex-wrap items-center gap-3 rounded-frame bg-surface p-3">
        <div className="min-w-0 flex-1">
          <FilterRow categories={categories} categoryId={categoryId} onCategory={onCategory} />
        </div>
        {cards.length > 0 && (
          <div className="inline-flex items-center gap-3 rounded-full bg-surface-raised px-3 py-2 text-meta shadow-card">
            <TrendingUp aria-hidden="true" className="size-icon-sm text-accent" />
            <span>
              {done} of {cards.length} done <span className="text-accent">({percent}%)</span>
            </span>
            <div role="progressbar" aria-label="Board progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-progress-lg w-progress-meter overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-accent transition-all duration-base" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}
        <div className="relative w-full lg:w-search">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-icon -translate-y-1/2 text-ink-muted" />
          <BaseInput type="search" className="bg-surface-raised pl-12" placeholder="Search tasks..." aria-label="Search cards" value={search} onChange={(e) => onSearch(e.target.value)} />
        </div>
      </section>
    </header>
  );
}
