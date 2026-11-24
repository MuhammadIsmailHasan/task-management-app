"use client";

import Link from "next/link";
import { useState } from "react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert } from "@/components/shared/BaseField";
import { usePagedList } from "@/hooks/usePagedList";
import { api } from "@/lib/api";
import { formatWhen } from "@/lib/activity";
import { hrefFor, sentenceFor } from "@/lib/inbox";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useShell } from "./ShellContext";

/** Lists notifications as the server returned them, one page at a time; nothing is computed client-side. */
export function InboxView() {
  const { inbox, refreshInbox, closeSidePanel, adjustUnread } = useShell();
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const list = usePagedList(async (page) => (await api.notifications.inbox(page)).items, [version]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await refreshInbox();
      setVersion((v) => v + 1);
    } catch {
      setError("Could not update notifications.");
    }
  }

  /** Open a row: mark it read without waiting, lower the count at once, and close the panel (Requirement 28, criterion 6). */
  function open(n: Notification) {
    closeSidePanel();
    if (n.is_read) return;
    adjustUnread(-1);
    api.notifications.markRead(n.id).catch(() => void refreshInbox());
  }

  if (list.error && !list.rows) return <p className="text-meta text-ink-muted">{list.error}</p>;
  if (!list.rows || !inbox) return <p className="text-ink-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <BaseBadge tone={inbox.unread_count ? "accent" : "neutral"}>{inbox.unread_count} unread</BaseBadge>
        <BaseButton size="sm" variant="secondary" disabled={!inbox.unread_count} onClick={() => run(() => api.notifications.readAll())}>
          Mark all read
        </BaseButton>
      </div>
      {error && <BaseAlert>{error}</BaseAlert>}
      {list.rows.length === 0 && <p className="text-meta text-ink-muted">No notifications.</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {list.rows.map((n) => (
          <li key={n.id}>
            <Link
              href={hrefFor(n)}
              onClick={() => open(n)}
              className={cn("flex items-start gap-3 rounded-card p-4 text-ink no-underline hover:bg-surface-sunken focus-ring", !n.is_read && "bg-surface")}
            >
              <span aria-hidden="true" className={cn("mt-1 size-dot shrink-0 rounded-full", n.is_read ? "bg-surface-strong" : "bg-accent")} />
              <span className="flex-1 text-sm">
                <span className="block">{sentenceFor(n)}</span>
                <span className="mt-1 block text-xs text-ink-muted">{formatWhen(n.created_at) || n.notify_date}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {list.hasMore && (
        <BaseButton variant="secondary" disabled={list.loadingMore} onClick={() => void list.loadMore()}>
          {list.loadingMore ? "Loading…" : "Load more"}
        </BaseButton>
      )}
    </div>
  );
}
