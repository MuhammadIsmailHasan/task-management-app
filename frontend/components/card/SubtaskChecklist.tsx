"use client";

import { useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { BaseCheckbox } from "@/components/shared/BaseCheckbox";
import { BaseButton } from "@/components/shared/BaseButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BaseAlert, BaseInput } from "@/components/shared/BaseField";
import { ProgressMeter } from "@/components/shared/ProgressMeter";
import { api } from "@/lib/api";
import { computeDropOrder, dropIndex } from "@/lib/ordering";
import type { Subtask } from "@/lib/types";

interface SubtaskChecklistProps {
  cardId: string;
  subtasks: Subtask[];
  canEdit: boolean;
  onChange: (subtasks: Subtask[]) => void;
}

/** Flat checkbox list: one-click toggle, inline-editable titles, drag handle to reorder. */
export function SubtaskChecklist({ cardId, subtasks, canEdit, onChange }: SubtaskChecklistProps) {
  const [title, setTitle] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sorted = [...subtasks].sort((a, b) => a.order - b.order);

  const replace = (s: Subtask) => onChange(subtasks.map((x) => (x.id === s.id ? s : x)));
  async function guard(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch {
      setError("Could not update the subtask.");
    }
  }

  async function drop(e: React.DragEvent<HTMLUListElement>) {
    e.preventDefault();
    if (!dragId) return;
    const others = sorted.filter((s) => s.id !== dragId);
    const centers = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-subtask-id]"))
      .filter((n) => n.dataset.subtaskId !== dragId)
      .map((n) => {
        const r = n.getBoundingClientRect();
        return r.top + r.height / 2;
      });
    const index = dropIndex(centers, e.clientY);
    const id = dragId;
    setDragId(null);
    const order = computeDropOrder(others.map((s) => s.order), index);
    const previous = subtasks;
    onChange(subtasks.map((s) => (s.id === id ? { ...s, order } : s)));
    try {
      const saved = await api.subtasks.update(id, { prev: others[index - 1]?.id ?? null, next: others[index]?.id ?? null });
      onChange(previous.map((s) => (s.id === id ? saved : s)));
    } catch {
      onChange(previous);
      setError("Could not reorder the subtask.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.length === 0 ? (
        <p className="text-ink-muted">No subtasks yet</p>
      ) : (
        <ProgressMeter done={sorted.filter((s) => s.is_done).length} total={sorted.length} />
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0" onDragOver={(e) => dragId && e.preventDefault()} onDrop={drop}>
        {sorted.map((s) => (
          <li
            key={s.id}
            data-subtask-id={s.id}
            className="flex items-center gap-2 rounded-ui border border-line bg-surface-raised px-2 py-1 transition-shadow hover:shadow-card"
          >
            {canEdit && s.can_edit !== false && (
              <span
                role="img"
                aria-label="Drag to reorder"
                draggable
                className="cursor-grab text-ink-muted select-none active:cursor-grabbing"
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", s.id);
                  setDragId(s.id);
                }}
                onDragEnd={() => setDragId(null)}
              >
                <GripVertical className="size-icon" aria-hidden="true" />
              </span>
            )}
            <BaseCheckbox
              aria-label={`Done: ${s.title}`}
              checked={s.is_done}
              disabled={!canEdit}
              onChange={(e) => guard(async () => replace(await api.subtasks.update(s.id, { is_done: e.target.checked })))}
            />
            <BaseInput
              className={s.is_done ? "min-h-control-sm flex-1 border-transparent text-ink-muted line-through" : "min-h-control-sm flex-1 border-transparent"}
              aria-label={`Subtask title: ${s.title}`}
              defaultValue={s.title}
              readOnly={!canEdit || s.can_edit === false}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (!canEdit || s.can_edit === false || !next || next === s.title) return void (e.target.value = s.title);
                void guard(async () => replace(await api.subtasks.update(s.id, { title: next })));
              }}
            />
            {canEdit && s.can_edit !== false && (
              <ConfirmDialog
                title={`Delete subtask “${s.title}”?`}
                message="This cannot be undone."
                onConfirm={() => guard(async () => { await api.subtasks.remove(s.id); onChange(subtasks.filter((x) => x.id !== s.id)); })}
                trigger={
                  <BaseButton size="sm" variant="ghost" className="size-control-sm px-0" aria-label={`Delete subtask ${s.title}`}>
                    <Trash2 aria-hidden="true" />
                  </BaseButton>
                }
              />
            )}
          </li>
        ))}
      </ul>
      {error && <BaseAlert>{error}</BaseAlert>}
      {canEdit && (
        <form method="post"
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            void guard(async () => {
              const created = await api.subtasks.create(cardId, title.trim());
              setTitle("");
              onChange([...subtasks, created]);
            });
          }}
        >
          <BaseInput placeholder="Add a subtask" aria-label="New subtask" value={title} onChange={(e) => setTitle(e.target.value)} />
          <BaseButton type="submit" disabled={!title.trim()}>
            Add
          </BaseButton>
        </form>
      )}
    </div>
  );
}
