"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseCombobox } from "@/components/shared/BaseCombobox";
import { BaseConfirm } from "@/components/shared/BaseConfirm";
import { BaseAlert, BaseInput } from "@/components/shared/BaseField";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { categoryTone, TONE_CYCLE } from "@/lib/tones";
import type { Category } from "@/lib/types";

const COLORS = TONE_CYCLE.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }));

/** Add, rename, recolor, and delete the categories of one board (the API enforces who may). */
export function CategoriesScreen({ boardId }: { boardId: string }) {
  const [items, setItems] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TONE_CYCLE[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api.categories.listForBoard(boardId).then((c) => live && setItems(c)).catch(() => live && setError("Could not load categories."));
    return () => {
      live = false;
    };
  }, [boardId]);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? (err.details?.name?.[0] ?? err.message) : "Something went wrong.");
    }
  }

  const replace = (c: Category) => setItems((cur) => (cur ?? []).map((x) => (x.id === c.id ? c : x)));

  return (
    <div className="flex w-full max-w-modal-wide flex-col gap-6 px-4 py-6 lg:px-8">
      <h1 className="font-heading text-title">Categories</h1>
      {error && <BaseAlert>{error}</BaseAlert>}
      <form
        method="post"
        className="flex flex-col gap-3 lg:flex-row lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void run(async () => {
            const created = await api.categories.create(boardId, { name: name.trim(), color });
            setItems((cur) => [...(cur ?? []), created]);
            setName("");
          });
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="category-name" className="text-xs font-medium text-ink-muted">
            New category
          </label>
          <BaseInput id="category-name" value={name} placeholder="Name" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 lg:w-popover">
          <span className="text-xs font-medium text-ink-muted">Color</span>
          <BaseCombobox label="Color" options={COLORS} value={color} onChange={setColor} />
        </div>
        <BaseButton type="submit" disabled={!name.trim()}>
          <Plus aria-hidden="true" />
          Add
        </BaseButton>
      </form>

      {!items ? (
        <p className="text-ink-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted">No categories yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 rounded-card border border-line p-3 lg:flex-row lg:items-center">
              <BaseBadge shape="tag" tone={categoryTone(c)} className="self-start lowercase lg:self-center">
                {c.name}
              </BaseBadge>
              <BaseInput
                className="min-w-0 flex-1"
                aria-label={`Rename ${c.name}`}
                defaultValue={c.name}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (!next || next === c.name) return void (e.target.value = c.name);
                  void run(async () => replace(await api.categories.update(c.id, { name: next })));
                }}
              />
              <div className="lg:w-popover">
                <BaseCombobox label={`Color of ${c.name}`} options={COLORS} value={categoryTone(c)} onChange={(v) => void run(async () => replace(await api.categories.update(c.id, { color: v })))} />
              </div>
              <BaseConfirm
                message={`Delete category "${c.name}"? Cards keep working without a label.`}
                onConfirm={() =>
                  run(async () => {
                    await api.categories.remove(c.id);
                    setItems((cur) => (cur ?? []).filter((x) => x.id !== c.id));
                  })
                }
                trigger={
                  <BaseButton variant="danger" size="sm" aria-label={`Delete ${c.name}`}>
                    <Trash2 aria-hidden="true" />
                    Delete
                  </BaseButton>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
