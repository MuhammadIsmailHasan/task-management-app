"use client";

import { ArchiveRestore } from "lucide-react";
import { useEffect, useState } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseBadge, type BadgeTone } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { useShell } from "@/components/shell/ShellContext";
import { api } from "@/lib/api";
import { CATEGORIES_CHANGED } from "@/lib/categories";
import { toast } from "@/lib/toast";
import { categoryTone } from "@/lib/tones";
import type { Board, Card, Category, Priority } from "@/lib/types";

const PRIORITY_TONE: Record<Priority, BadgeTone> = { high: "danger", medium: "accent", low: "neutral" };
const archivedOn = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "");

export function ArchivedView({ board, initialCards, categories: initialCategories }: { board: Board; initialCards: Card[]; categories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ boardId: string }>).detail?.boardId === board.id) api.categories.listForBoard(board.id).then(setCategories).catch(() => undefined);
    };
    window.addEventListener(CATEGORIES_CHANGED, onChanged);
    return () => window.removeEventListener(CATEGORIES_CHANGED, onChanged);
  }, [board.id]);
  const { session } = useShell();
  const [cards, setCards] = useState(initialCards);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const canRestore = !!session && (session.role === "manager" || session.role === "admin" || session.role === "supervisor");

  async function restore(card: Card) {
    try {
      const saved = await api.cards.restore(card.id);
      setCards((all) => all.filter((c) => c.id !== card.id));
      const column = board.columns?.find((c) => c.id === saved.column_id);
      toast.success(`Card restored to ${column?.name ?? "the first column"}`);
    } catch {
    }
  }


  return (
    <div className="flex min-h-0 flex-1 flex-col gap-section overflow-y-auto px-page pt-surface pb-surface">
      <h1 className="font-heading text-xl">Archived cards</h1>
      {cards.length === 0 ? (
        <p className="rounded-ui bg-surface p-surface text-sm text-ink-muted">No archived cards.</p>
      ) : (
        <ul aria-label="Archived cards" className="m-0 flex list-none flex-col gap-gutter p-0">
          {cards.map((card) => {
            const category = card.category_id ? categoryById.get(card.category_id) : undefined;
            return (
              <li key={card.id} className="flex flex-col gap-3 rounded-ui bg-surface-raised p-item shadow-card lg:flex-row lg:items-center">
                <span className="min-w-0 flex-1 font-heading text-base font-semibold break-words">{card.title}</span>
                <BaseBadge tone={PRIORITY_TONE[card.priority]}>{card.priority}</BaseBadge>
                {category && (
                  <BaseBadge shape="tag" tone={categoryTone(category)} className="lowercase">
                    {category.name}
                  </BaseBadge>
                )}
                {card.assignee_name && <BaseAvatar name={card.assignee_name} src={card.assignee_avatar_url ?? null} />}
                <span className="text-sm text-ink-muted">Archived {archivedOn(card.archived_at)}</span>
                {canRestore && (
                  <BaseButton variant="secondary" size="sm" aria-label={`Restore ${card.title}`} onClick={() => void restore(card)}>
                    <ArchiveRestore aria-hidden="true" />
                    Restore
                  </BaseButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
