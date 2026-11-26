"use client";

import { ArchiveRestore } from "lucide-react";
import { useState } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseBadge, type BadgeTone } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert } from "@/components/shared/BaseField";
import { BaseLinkButton } from "@/components/shared/BaseLinkButton";
import { useShell } from "@/components/shell/ShellContext";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { boardPath } from "@/lib/routes";
import { categoryTone } from "@/lib/tones";
import type { Board, Card, Category, Priority } from "@/lib/types";

const PRIORITY_TONE: Record<Priority, BadgeTone> = { high: "danger", medium: "accent", low: "neutral" };
const archivedOn = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "");

/** The Board's archived Cards, newest first, with Restore for those who may archive (VIEW-05 to VIEW-07). Restore asks nothing: it is neither a create nor a delete. */
export function ArchivedView({ board, initialCards, categories }: { board: Board; initialCards: Card[]; categories: Category[] }) {
  const { session } = useShell();
  const [cards, setCards] = useState(initialCards);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const canRestore = !!session && (session.role === "manager" || session.role === "admin" || session.role === "supervisor");

  async function restore(card: Card) {
    setError(null);
    setMessage(null);
    try {
      const saved = await api.cards.restore(card.id);
      setCards((all) => all.filter((c) => c.id !== card.id));
      const column = board.columns?.find((c) => c.id === saved.column_id);
      setMessage(`Card restored to ${column?.name ?? "the first column"}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not restore the card.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-page pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl">Archived cards</h1>
        <BaseLinkButton variant="secondary" size="sm" href={boardPath(board.slug)}>
          Back to board
        </BaseLinkButton>
      </div>
      <div role="status" aria-live="polite">
        {message && <BaseAlert tone="info">{message}</BaseAlert>}
      </div>
      {error && <BaseAlert>{error}</BaseAlert>}
      {cards.length === 0 ? (
        <p className="rounded-frame bg-surface p-6 text-sm text-ink-muted">No archived cards.</p>
      ) : (
        <ul aria-label="Archived cards" className="m-0 flex list-none flex-col gap-2 p-0">
          {cards.map((card) => {
            const category = card.category_id ? categoryById.get(card.category_id) : undefined;
            return (
              <li key={card.id} className="flex flex-col gap-3 rounded-card bg-surface-raised p-4 shadow-card lg:flex-row lg:items-center">
                <span className="min-w-0 flex-1 font-medium break-words">{card.title}</span>
                <BaseBadge tone={PRIORITY_TONE[card.priority]}>{card.priority}</BaseBadge>
                {category && (
                  <BaseBadge shape="tag" tone={categoryTone(category)} className="lowercase">
                    {category.name}
                  </BaseBadge>
                )}
                {card.assignee_name && <BaseAvatar name={card.assignee_name} src={card.assignee_avatar_url ?? null} />}
                <span className="text-sm text-ink-muted">Archived {archivedOn(card.archived_at)}</span>
                {canRestore && (
                  <BaseButton variant="secondary" size="sm" className="min-h-touch lg:min-h-0" aria-label={`Restore ${card.title}`} onClick={() => void restore(card)}>
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
