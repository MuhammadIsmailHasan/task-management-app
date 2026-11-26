"use client";

import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseInput } from "@/components/shared/BaseField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

/** The "Add column" tile at the end of the Column row, on the Column recipe (`--surface-sunken`; COL-11, COL-13). */
export function AddColumn({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [asking, setAsking] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) setAsking(true);
  }

  return (
    <section aria-label="Add column" className="flex h-fit w-4/5 max-w-column shrink-0 snap-start flex-col gap-3 rounded-frame bg-surface p-3 lg:w-column">
      {open ? (
        <form method="post" className="flex flex-col gap-2" onSubmit={submit}>
          <BaseInput autoFocus aria-label="Column name" placeholder="Column name" maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex items-center gap-2">
            <BaseButton type="submit" size="sm" disabled={!name.trim()}>
              Add column
            </BaseButton>
            <BaseButton size="sm" variant="ghost" onClick={() => (setOpen(false), setName(""))}>
              Cancel
            </BaseButton>
          </div>
          <ConfirmDialog
            open={asking}
            onOpenChange={setAsking}
            tone="primary"
            confirmLabel="Create"
            title={`Create column “${name.trim()}”?`}
            message="It is added at the end of the board."
            onConfirm={async () => {
              await onCreate(name.trim());
              setName("");
              setOpen(false);
            }}
          />
        </form>
      ) : (
        <BaseButton variant="secondary" className="min-h-control rounded-card bg-surface-raised text-ink-muted" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          Add column
        </BaseButton>
      )}
    </section>
  );
}
