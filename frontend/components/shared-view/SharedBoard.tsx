"use client";

import { BaseBadge } from "@/components/shared/BaseBadge";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CardTile } from "@/components/board/CardTile";
import { FilterRow } from "@/components/board/FilterRow";
import { BaseInput } from "@/components/shared/BaseField";
import { columnTone, SOLID } from "@/lib/tones";
import type { Category, SharedBoard as SharedBoardT, SharedCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SharedCardModal } from "./SharedCardModal";
import { routes } from "@/lib/routes";

interface SharedBoardProps {
  token: string;
  board: SharedBoardT;
  cards: SharedCard[];
  categories: Category[];
  /** The viewer carries a Token but has no access to this Board: the banner links Home instead of sign-in. */
  signedIn?: boolean;
}

const noop = () => undefined;

/** The Shared_View: columns and cards with search and category chips only. No drag, add, edit, assign, comments, activity, or Inbox. */
export function SharedBoard({ token, board, cards, categories, signedIn = false }: SharedBoardProps) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const doneId = board.columns.find((c) => c.name === "Done")?.id;
  const byCategory = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const visible = cards.filter((c) => {
    const text = search.trim().toLowerCase();
    if (text && !`${c.title} ${c.description ?? ""}`.toLowerCase().includes(text)) return false;
    return !categoryId || c.category_id === categoryId;
  });
  const open = cards.find((c) => c.id === openId) ?? null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div role="status" className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-brand px-4 py-2 text-sm text-on-brand lg:px-8">
        <span>Shared view, read only</span>
        {signedIn ? (
          <Link href={routes.boards} className="font-semibold text-on-accent-tint underline">
            Go to Home
          </Link>
        ) : (
          <Link href={routes.login} className="font-semibold text-on-accent-tint underline">
            Sign in
          </Link>
        )}
      </div>
      <header className="flex shrink-0 flex-col gap-3 border-b border-line bg-surface-raised px-4 py-3 lg:px-8">
        <div>
          <h1 className="font-heading text-xl break-words">{board.name}</h1>
          {board.description && <p className="text-sm text-ink-muted">{board.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full lg:w-search">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-icon -translate-y-1/2 text-ink-muted" />
            <BaseInput type="search" className="bg-surface pl-12" placeholder="Search" aria-label="Search cards" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="min-w-0 flex-1">
            <FilterRow categories={categories} categoryId={categoryId} onCategory={setCategoryId} />
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 snap-x snap-proximity items-stretch gap-4 overflow-x-auto overflow-y-hidden p-4 lg:gap-6 lg:p-8">
        {[...board.columns]
          .sort((a, b) => a.order - b.order)
          .map((col, i) => {
            const items = visible.filter((c) => c.column_id === col.id).sort((a, b) => a.order - b.order);
            return (
              <section key={col.id} aria-label={col.name} className="flex max-h-full w-4/5 max-w-column shrink-0 snap-start flex-col gap-3 rounded-ui bg-surface p-item lg:w-column">
                <header className="flex shrink-0 items-center gap-2 px-1">
                  <i aria-hidden="true" className={cn("inline-block size-dot-md shrink-0 rounded-full", SOLID[columnTone(col.name, i)])} />
                  <h2 className="font-heading text-page-title">{col.name}</h2>
                  <BaseBadge tone="count">{items.length}</BaseBadge>
                </header>
                <div className="flex min-h-column-min flex-1 flex-col gap-2 overflow-y-auto">
                  {items.map((card) => (
                    <CardTile
                      key={card.id}
                      card={card}
                      category={card.category_id ? byCategory.get(card.category_id) : undefined}
                      assignee={card.assignee_name ? { full_name: card.assignee_name, avatar_url: null } : undefined}
                      dueState={col.id === doneId ? null : (card.due_state ?? null)}
                      draggable={false}
                      onOpen={() => setOpenId(card.id)}
                      onDragStart={noop}
                      onDragEnd={noop}
                    />
                  ))}
                  {items.length === 0 && <p className="px-1 text-xs text-ink-muted">No cards</p>}
                </div>
              </section>
            );
          })}
      </div>
      <SharedCardModal token={token} card={open} category={open?.category_id ? byCategory.get(open.category_id) : undefined} onClose={() => setOpenId(null)} />
    </div>
  );
}
