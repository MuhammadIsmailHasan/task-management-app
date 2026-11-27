"use client";

import { ArrowLeft, ArrowRight, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseInput } from "@/components/shared/BaseField";
import { BaseMenu } from "@/components/shared/BaseMenu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SOLID, type Tone } from "@/lib/tones";
import type { Column } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ColumnHeaderProps {
  column: Column;
  tone: Tone;
  count: number;
  canManage: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string) => Promise<void>;
  onMove: (delta: -1 | 1) => Promise<void>;
  onDelete: () => Promise<void>;
  grip?: { onDragStart: (e: React.DragEvent<HTMLElement>) => void; onDragEnd: () => void };
}

const LOCKED = "The Done column is locked";

export function ColumnHeader({ column, tone, count, canManage, isFirst, isLast, onRename, onMove, onDelete, grip }: ColumnHeaderProps) {
  const locked = column.name === "Done";
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(column.name);
  const [deleting, setDeleting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const menuClosing = useRef(false);

  async function save() {
    const next = value.trim();
    setRenaming(false);
    if (!next || next === column.name) return setValue(column.name);
    try {
      await onRename(next);
    } catch {
      setValue(column.name);
    }
  }

  return (
    <header className="flex shrink-0 items-center gap-2">
      {canManage && grip && (
        <span
          role="img"
          aria-label={`Reorder column ${column.name}`}
          draggable
          onDragStart={grip.onDragStart}
          onDragEnd={grip.onDragEnd}
          className="inline-flex shrink-0 cursor-grab touch-none items-center text-ink-muted select-none active:cursor-grabbing"
        >
          <GripVertical className="size-icon-sm" aria-hidden="true" />
        </span>
      )}
      <i aria-hidden="true" className={cn("inline-block size-dot-md shrink-0 rounded-full", SOLID[tone])} />
      {renaming ? (
        <BaseInput
          ref={input}
          autoFocus
          aria-label={`Rename column ${column.name}`}
          className="min-w-0 flex-1"
          value={value}
          maxLength={255}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => !menuClosing.current && void save()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") {
              setValue(column.name);
              setRenaming(false);
            }
          }}
        />
      ) : (
        <h3 className="min-w-0 truncate font-heading text-base font-semibold">{column.name}</h3>
      )}
      <BaseBadge tone="count">{count}</BaseBadge>
      {canManage && (
        <div className="ml-auto">
          <BaseMenu
            label={`Column ${column.name}`}
            onCloseAutoFocus={(e) => {
              menuClosing.current = false;
              if (input.current) {
                e.preventDefault();
                input.current.focus();
              }
            }}
            trigger={
              <BaseButton variant="ghost" size="sm" className="size-control-sm px-0" aria-label={`Column menu: ${column.name}`}>
                <MoreHorizontal aria-hidden="true" />
              </BaseButton>
            }
            items={[
              { label: "Rename", icon: Pencil, onSelect: () => ((menuClosing.current = true), setValue(column.name), setRenaming(true)), disabled: locked, hint: LOCKED },
              { label: "Move left", icon: ArrowLeft, onSelect: () => void onMove(-1), disabled: isFirst },
              { label: "Move right", icon: ArrowRight, onSelect: () => void onMove(1), disabled: isLast },
              { label: "Delete", icon: Trash2, onSelect: () => setDeleting(true), disabled: locked, hint: LOCKED },
            ]}
          />
          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            title={`Delete column “${column.name}”?`}
            message="The column is removed from this board."
            confirmLabel="Delete"
            onConfirm={onDelete}
          />
        </div>
      )}
    </header>
  );
}
