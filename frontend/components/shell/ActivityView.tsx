"use client";

import { useEffect, useState } from "react";
import { ActivityLine } from "@/components/card/ActivityLine";
import { BaseButton } from "@/components/shared/BaseButton";
import { usePagedList } from "@/hooks/usePagedList";
import { api } from "@/lib/api";
import { useShell } from "./ShellContext";

/** The board feed from GET /boards/{id}/activity, one page at a time. Renders only what the API returned. */
export function ActivityView() {
  const { boardId } = useShell();
  const [names, setNames] = useState<Record<string, string>>({});
  const [columns, setColumns] = useState<Record<string, string>>({});
  const list = usePagedList((page) => (boardId ? api.boards.activity(boardId, page) : Promise.resolve([])), [boardId]);

  useEffect(() => {
    if (!boardId) return;
    let live = true;
    Promise.all([api.boards.members(boardId).catch(() => []), api.boards.get(boardId).catch(() => null)]).then(([members, board]) => {
      if (!live) return;
      setNames(Object.fromEntries(members.map((m) => [m.id, m.full_name])));
      setColumns(Object.fromEntries((board?.columns ?? []).map((c) => [c.id, c.name])));
    });
    return () => {
      live = false;
    };
  }, [boardId]);

  if (!boardId) return <p className="text-sm text-ink-muted">Open a board to see its activity.</p>;
  if (list.error && !list.rows) return <p className="text-sm text-ink-muted">Activity is not available for this board.</p>;
  if (!list.rows) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (list.rows.length === 0) return <p className="text-sm text-ink-muted">No activity yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {list.rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 rounded-ui bg-surface p-item">
            <span aria-hidden="true" className="mt-2 size-dot shrink-0 rounded-full bg-accent" />
            <ActivityLine entry={r} names={names} columns={columns} showContext />
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
