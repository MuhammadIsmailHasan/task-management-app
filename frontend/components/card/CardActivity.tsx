"use client";

import { useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { api } from "@/lib/api";
import type { ActivityEntry } from "@/lib/types";
import { ActivityList } from "./ActivityList";

interface CardActivityProps {
  cardId: string;
  initial: ActivityEntry[];
  names: Record<string, string>;
  columns: Record<string, string>;
}

export function CardActivity({ cardId, initial, names, columns }: CardActivityProps) {
  const [extra, setExtra] = useState<ActivityEntry[]>([]);
  const [shown, setShown] = useState(PAGE);
  const [exhausted, setExhausted] = useState(initial.length < EMBEDDED_PAGE);
  const [busy, setBusy] = useState(false);
  const all = [...initial, ...extra];
  const rows = all.slice(0, shown);
  const hasMore = all.length > shown || !exhausted;

  async function loadMore() {
    if (all.length >= shown + PAGE || exhausted) return setShown((n) => n + PAGE);
    const last = all[all.length - 1];
    if (!last) return;
    setBusy(true);
    try {
      const page = await api.cards.activity(cardId, { limit: EMBEDDED_PAGE, before: last.id });
      setExtra((cur) => [...cur, ...page]);
      setExhausted(page.length < EMBEDDED_PAGE);
      setShown((n) => n + PAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ActivityList entries={rows} names={names} columns={columns} />
      {hasMore && (
        <BaseButton variant="secondary" disabled={busy} onClick={() => void loadMore()}>
          {busy ? "Loading…" : "Load more activity"}
        </BaseButton>
      )}
    </div>
  );
}

const PAGE = 5;

const EMBEDDED_PAGE = 20;
