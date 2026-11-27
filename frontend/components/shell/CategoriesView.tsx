"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { ColorSwatchPicker } from "@/components/shared/ColorSwatchPicker";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BaseAlert, BaseInput } from "@/components/shared/BaseField";
import { api } from "@/lib/api";
import { useShell } from "./ShellContext";
import { ApiError } from "@/lib/http";
import { notifyCategoriesChanged } from "@/lib/categories";
import { categoryTone, PALETTE, TONE_CYCLE, type Tone } from "@/lib/tones";
import type { Category } from "@/lib/types";

export function CategoriesView() {
  const { boardId } = useShell();
  if (!boardId) return <p className="text-sm text-ink-muted">Open a board to see its categories.</p>;
  return <CategoriesList boardId={boardId} />;
}

function CategoriesList({ boardId }: { boardId: string }) {
  const [items, setItems] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<Tone>(TONE_CYCLE[0]);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

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
      notifyCategoriesChanged(boardId);
    } catch (err) {
      setError(err instanceof ApiError ? (err.details?.name?.[0] ?? err.message) : "Something went wrong.");
    }
  }

  const replace = (c: Category) => setItems((cur) => (cur ?? []).map((x) => (x.id === c.id ? c : x)));

  return (
    <div className="flex flex-col gap-section pt-4">
      {error && <BaseAlert>{error}</BaseAlert>}
      <form
        method="post"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) setAsking(true);
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-label">
          <label htmlFor="category-name" className="text-xs font-medium text-ink-muted">
            New category
          </label>
          <BaseInput id="category-name" value={name} placeholder="Name" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-label">
          <span className="text-xs font-medium text-ink-muted">Color</span>
          <ColorSwatchPicker label="Color" value={color} onChange={setColor} />
        </div>
        <BaseButton type="submit" disabled={!name.trim()}>
          <Plus aria-hidden="true" />
          Add
        </BaseButton>
      </form>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        tone="primary"
        confirmLabel="Create"
        title={`Create category “${name.trim()}”?`}
        message="Cards on this board can then use it as a label."
        onConfirm={() =>
          run(async () => {
            const created = await api.categories.create(boardId, { name: name.trim(), color });
            setItems((cur) => [...(cur ?? []), created]);
            setName("");
          })
        }
      />

      {!items ? (
        <p className="text-ink-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted">No categories yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 rounded-ui border border-line p-item">
              <BaseBadge shape="tag" tone={categoryTone(c)} className="self-start lowercase">
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
              <div>
                <ColorSwatchPicker label={`Color of ${c.name}`} value={categoryTone(c)} onChange={(v) => void run(async () => replace(await api.categories.update(c.id, { color: v })))} />
              </div>
              <ConfirmDialog
                title={`Delete category “${c.name}”?`}
                message="Cards keep working without a label."
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
