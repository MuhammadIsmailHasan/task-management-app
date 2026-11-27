"use client";

import { Archive, Pencil, Search, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { NewBoardModal } from "@/components/shell/NewBoardModal";
import { cn } from "@/lib/utils";
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
  /** A Manager, an Admin, or the Board's owner may edit its name and description (the Backend's rename rule). */
  canEdit?: boolean;
}

/** Progress and Archived share the control look of the search field: one height, fill, radius, and shadow. */
const TOOL = "inline-flex min-h-control shrink-0 items-center rounded-ui bg-surface-raised px-4 text-sm whitespace-nowrap shadow-card";

/** The Board_Toolbar and the filter bar (SHELL-12, SHELL-16; reference `01-board-desktop.png`). Sharing is in the Top_Menu (SHR-01), not here.. */
export function BoardHeader({ board, cards, categories, categoryId, search, onSearch, onCategory, archivedCount = 0, canEdit = false }: BoardHeaderProps) {
  const [editing, setEditing] = useState(false);
  const doneId = board.columns?.find((c) => c.name === "Done")?.id;
  const done = doneId ? cards.filter((c) => c.column_id === doneId).length : 0;
  const percent = cards.length ? Math.round((done / cards.length) * 100) : 0;

  return (
    <header className="relative z-header flex shrink-0 flex-col gap-field px-page pt-surface pb-4">
      <div className="flex min-w-0 items-center gap-2">
        <BoardSwitcher board={board} />
        {canEdit && (
          <BaseButton variant="ghost" size="sm" className="size-control shrink-0 px-0" aria-label="Edit board" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
          </BaseButton>
        )}
      </div>
      {/* one row from 960 pixels: the category chips take the free width and scroll; progress, search, and Archived share one control look */}
      <section aria-label="Filters" className="flex flex-wrap items-center gap-field rounded-ui bg-surface p-item lg:flex-nowrap">
        <div className="w-full min-w-0 lg:w-auto lg:flex-1">
          <FilterRow categories={categories} categoryId={categoryId} onCategory={onCategory} />
        </div>
        {cards.length > 0 && (
          <div className={cn(TOOL, "gap-3")}>
            <TrendingUp aria-hidden="true" className="size-icon-sm text-accent" />
            <span>
              {done} of {cards.length} done <span className="text-accent">({percent}%)</span>
            </span>
          </div>
        )}
        <div className="relative w-full lg:w-select lg:shrink-0">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-icon -translate-y-1/2 text-ink-muted" />
          <BaseInput type="search" className="bg-surface-raised pl-10" placeholder="Search tasks" aria-label="Search cards" value={search} onChange={(e) => onSearch(e.target.value)} />
        </div>
        <Link href={boardViewPath(board.slug, "archived")} className={cn(TOOL, "gap-2 text-ink no-underline hover:bg-surface-sunken focus-ring-inset")}>
          <Archive aria-hidden="true" className="size-icon text-ink-muted" />
          Archived
          <span className="inline-flex min-h-chip items-center rounded-ui bg-surface-strong px-2 text-xs font-semibold">{archivedCount}</span>
        </Link>
      </section>
      {canEdit && <NewBoardModal board={board} open={editing} onClose={() => setEditing(false)} />}
    </header>
  );
}
