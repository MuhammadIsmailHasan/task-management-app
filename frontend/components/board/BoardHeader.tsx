"use client";

import { Archive, Search, TrendingUp } from "lucide-react";
import { BaseLinkButton } from "@/components/shared/BaseLinkButton";
import { boardViewPath } from "@/lib/routes";
import { BaseInput } from "@/components/shared/BaseField";
import { BoardSwitcher } from "@/components/shell/BoardSwitcher";
import type { Board, Card, Category, Member } from "@/lib/types";
import { FilterRow } from "./FilterRow";

interface BoardHeaderProps {
  board: Board;
  cards: Card[];
  members: Member[];
  categories: Category[];
  categoryId: string | null;
  search: string;
  onSearch: (value: string) => void;
  onCategory: (id: string | null) => void;
  /** The number of archived Cards; the toolbar links to the Archived page (VIEW-05). */
  archivedCount?: number;
}

/** The Board_Toolbar and the filter bar (SHELL-12, SHELL-16; reference `01-board-desktop.png`). Sharing is in the Top_Menu (SHR-01), not here.. */
export function BoardHeader({ board, cards, categories, categoryId, search, onSearch, onCategory, archivedCount = 0 }: BoardHeaderProps) {
  const doneId = board.columns?.find((c) => c.name === "Done")?.id;
  const done = doneId ? cards.filter((c) => c.column_id === doneId).length : 0;
  const percent = cards.length ? Math.round((done / cards.length) * 100) : 0;

  return (
    <header className="relative z-header flex shrink-0 flex-col gap-field px-page pt-surface pb-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="inline-flex items-center gap-2 text-xs text-ink-muted uppercase">
            <i aria-hidden="true" className="size-dot rounded-full bg-accent" />
            Active board
          </span>
          <BoardSwitcher board={board} />
        </div>
        <BaseLinkButton variant="secondary" className="min-h-control" href={boardViewPath(board.slug, "archived")}>
          <Archive aria-hidden="true" />
          Archived
          <span className="inline-flex min-h-chip items-center rounded-ui bg-surface-strong px-2 text-xs font-semibold">{archivedCount}</span>
        </BaseLinkButton>
      </div>
      <section aria-label="Filters" className="flex flex-wrap items-center gap-field rounded-ui bg-surface p-item">
        <div className="w-full min-w-0 lg:w-auto lg:flex-1">
          <FilterRow categories={categories} categoryId={categoryId} onCategory={onCategory} />
        </div>
        {cards.length > 0 && (
          <div className="inline-flex min-h-control items-center gap-3 rounded-ui bg-surface-raised px-4 text-sm shadow-card">
            <TrendingUp aria-hidden="true" className="size-icon-sm text-accent" />
            <span>
              {done} of {cards.length} done <span className="text-accent">({percent}%)</span>
            </span>
            <div role="progressbar" aria-label="Board progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-progress-lg w-progress-meter overflow-hidden rounded-ui bg-surface-sunken">
              <div className="h-full rounded-ui bg-accent transition-all duration-base" style={{ width: `${percent}%` }} />
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
