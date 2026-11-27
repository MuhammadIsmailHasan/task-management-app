"use client";

import { BaseBadge } from "@/components/shared/BaseBadge";
import { Search } from "lucide-react";
import { BaseLinkButton } from "@/components/shared/BaseLinkButton";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useMemo, useState } from "react";
import { CardTile } from "@/components/board/CardTile";
import { FilterRow } from "@/components/board/FilterRow";
import { BaseInput } from "@/components/shared/BaseField";
import { columnTone, SOLID } from "@/lib/tones";
import type { Category, SharedBoard as SharedBoardT, SharedCard } from "@/lib/types";
import { htmlToText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { SharedCardModal } from "./SharedCardModal";
import { routes } from "@/lib/routes";

interface SharedBoardProps {
  token: string;
  board: SharedBoardT;
  cards: SharedCard[];
  categories: Category[];
  signedIn?: boolean;
}

const noop = () => undefined;

export function SharedBoard({ token, board, cards, categories, signedIn = false }: SharedBoardProps) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const doneId = board.columns.find((c) => c.name === "Done")?.id;
  const byCategory = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const visible = cards.filter((c) => {
    const text = search.trim().toLowerCase();
    if (text && !`${c.title} ${htmlToText(c.description)}`.toLowerCase().includes(text)) return false;
    return !categoryId || c.category_id === categoryId;
  });
  const open = cards.find((c) => c.id === openId) ?? null;

  return (
    <div className="flex h-screen overflow-clip bg-surface lg:p-page">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-raised lg:rounded-ui lg:shadow-card">
        <header className="flex min-h-touch shrink-0 items-center justify-between gap-field border-b border-line px-page py-2 lg:h-header">
          <span className="inline-flex items-center gap-2 font-heading text-page-title">
            <BrandLogo variant="mark" size="sm" decorative />
            RevoBoard
          </span>
          <div role="status" className="flex items-center gap-field">
            <BaseBadge tone="neutral">Read only</BaseBadge>
            <BaseLinkButton variant="secondary" href={signedIn ? routes.boards : routes.login}>
              {signedIn ? "Go to Home" : "Sign in"}
            </BaseLinkButton>
          </div>
        </header>
        <div className="flex shrink-0 flex-col gap-field px-page pt-surface pb-4">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="inline-flex items-center gap-2 text-xs text-ink-muted uppercase">
              <i aria-hidden="true" className="size-dot rounded-full bg-accent" />
              Shared board
            </span>
            <h1 className="font-heading text-xl break-words">{board.name}</h1>
          </div>
          <section aria-label="Filters" className="flex flex-wrap items-center gap-field rounded-ui bg-surface p-item">
            <div className="w-full min-w-0 lg:w-auto lg:flex-1">
              <FilterRow categories={categories} categoryId={categoryId} onCategory={setCategoryId} />
            </div>
            <div className="relative w-full lg:w-search">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-icon -translate-y-1/2 text-ink-muted" />
              <BaseInput type="search" className="bg-surface-raised pl-12" placeholder="Search tasks..." aria-label="Search cards" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </section>
        </div>
        <div className="@container mx-page flex min-h-0 flex-1 snap-x snap-proximity overflow-x-auto overflow-y-hidden">
          <div className="flex w-max min-w-full items-stretch gap-gutter pb-item">
            {[...board.columns]
              .sort((a, b) => a.order - b.order)
              .map((col, i) => {
                const items = visible.filter((c) => c.column_id === col.id).sort((a, b) => a.order - b.order);
                return (
                  <section key={col.id} aria-label={col.name} className="flex max-h-full w-column shrink-0 grow snap-start flex-col gap-item rounded-ui bg-surface p-item">
                    <header className="flex shrink-0 items-center gap-2">
                      <i aria-hidden="true" className={cn("inline-block size-dot-md shrink-0 rounded-full", SOLID[columnTone(col.name, i)])} />
                      <h3 className="min-w-0 truncate font-heading text-base font-semibold">{col.name}</h3>
                      <BaseBadge tone="count">{items.length}</BaseBadge>
                    </header>
                    <div className="flex min-h-column-min flex-1 flex-col gap-gutter overflow-y-auto">
                      {items.map((card) => (
                        <CardTile
                          key={card.id}
                          card={card}
                          category={card.category_id ? byCategory.get(card.category_id) : undefined}
                          assignee={card.assignee_name ? { full_name: card.assignee_name, avatar_url: null } : undefined}
                          dueState={col.id === doneId ? null : (card.due_state ?? null)}
                          done={col.id === doneId}
                          draggable={false}
                          onOpen={() => setOpenId(card.id)}
                          onDragStart={noop}
                          onDragEnd={noop}
                        />
                      ))}
                      {items.length === 0 && <p className="text-sm text-ink-muted">No cards</p>}
                    </div>
                  </section>
                );
              })}
          </div>
        </div>
      </div>
      <SharedCardModal token={token} card={open} category={open?.category_id ? byCategory.get(open.category_id) : undefined} onClose={() => setOpenId(null)} />
    </div>
  );
}
