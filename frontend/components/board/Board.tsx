"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BaseInput } from "@/components/shared/BaseField";
import { useFlip } from "@/hooks/useFlip";
import { dropIndex } from "@/lib/ordering";
import { columnTone, SOLID } from "@/lib/tones";
import type { Card, Category, Column, Member } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddColumn } from "./AddColumn";
import { CardTile } from "./CardTile";
import { ColumnHeader } from "./ColumnHeader";

interface BoardProps {
  columns: Column[];
  cards: Card[];
  categories: Category[];
  members: Member[];
  canMove: boolean;
  canCreate: boolean;
  onOpen: (card: Card) => void;
  onMove: (cardId: string, columnId: string, index: number) => Promise<void>;
  onCreate: (columnId: string, title: string) => Promise<void>;
  /** Column CRUD for the Board_Owner, a Manager, and an Admin (Requirement 49); omit `columnActions` to show none of it. */
  columnActions?: {
    onRename: (columnId: string, name: string) => Promise<void>;
    onMove: (columnId: string, delta: -1 | 1) => Promise<void>;
    onDelete: (columnId: string) => Promise<void>;
    onAdd: (name: string) => Promise<void>;
  };
}

interface Target {
  columnId: string;
  index: number;
}

/**
 * Columns scroll sideways inside the board and each scrolls vertically inside itself; "Add a card" stays pinned at the
 * column bottom. Drag-and-drop: placeholder at the drop target, FLIP for siblings, one move call per drop.
 */
export function Board({ columns, cards, categories, members, canMove, canCreate, onOpen, onMove, onCreate, columnActions }: BoardProps) {
  const root = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [asking, setAsking] = useState(false);
  useFlip(root);

  const ordered = [...columns].sort((a, b) => a.order - b.order);
  const doneColumnId = columns.find((c) => c.name === "Done")?.id;
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  function onDragOver(e: React.DragEvent<HTMLDivElement>, columnId: string) {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const centers = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-card-id]"))
      .filter((n) => n.dataset.cardId !== dragId)
      .map((n) => {
        const r = n.getBoundingClientRect();
        return r.top + r.height / 2;
      });
    const index = dropIndex(centers, e.clientY);
    setTarget((t) => (t && t.columnId === columnId && t.index === index ? t : { columnId, index }));
  }

  async function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const id = dragId;
    const t = target;
    setDragId(null);
    setTarget(null);
    if (id && t) await onMove(id, t.columnId, t.index);
  }

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim()) setAsking(true);
  }

  async function createCard(columnId: string) {
    await onCreate(columnId, title.trim());
    setTitle("");
    setAdding(null);
  }

  return (
    <div ref={root} className="flex min-h-0 flex-1 snap-x snap-proximity scroll-px-4 items-stretch gap-gutter overflow-x-auto overflow-y-hidden px-page pb-4 lg:scroll-px-6">
      {ordered.map((col, colIndex) => {
        const tone = columnTone(col.name, colIndex);
        const inColumn = cards.filter((c) => c.column_id === col.id).sort((a, b) => a.order - b.order);
        const visible = inColumn.filter((c) => c.id !== dragId);
        const items: React.ReactNode[] = visible.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            category={card.category_id ? categoryById.get(card.category_id) : undefined}
            assignee={
              card.assignee_name
                ? { full_name: card.assignee_name, avatar_url: card.assignee_avatar_url ?? null, inactive: card.assignee_is_active === false, unavailable: card.assignee_is_available === false }
                : card.assignee_id
                  ? memberById.get(card.assignee_id)
                  : undefined
            }
            dueState={col.id === doneColumnId ? null : (card.due_state ?? null)}
            done={col.id === doneColumnId}
            draggable={canMove}
            onOpen={() => onOpen(card)}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", card.id);
              setHeight((e.currentTarget as HTMLElement).offsetHeight);
              // hide the original after the browser has taken its drag image
              requestAnimationFrame(() => setDragId(card.id));
            }}
            onDragEnd={() => {
              setDragId(null);
              setTarget(null);
            }}
          />
        ));
        if (dragId && target?.columnId === col.id) {
          items.splice(
            target.index,
            0,
            <div key="placeholder" data-testid="drop-placeholder" aria-hidden="true" className="drop-placeholder shrink-0 rounded-card" style={{ height: height ?? undefined }} />,
          );
        }
        return (
          <section
            key={col.id}
            aria-label={col.name}
            className="flex max-h-full w-4/5 max-w-column shrink-0 snap-start flex-col gap-3 rounded-frame bg-surface p-3 lg:w-column"
          >
            <ColumnHeader
              column={col}
              tone={tone}
              count={inColumn.length}
              canManage={!!columnActions}
              isFirst={colIndex === 0}
              isLast={colIndex === ordered.length - 1}
              onRename={(name) => columnActions!.onRename(col.id, name)}
              onMove={(delta) => columnActions!.onMove(col.id, delta)}
              onDelete={() => columnActions!.onDelete(col.id)}
            />
            <div
              data-testid={`column-${col.name}`}
              className="flex min-h-column-min flex-1 flex-col gap-gutter overflow-y-auto"
              onDragOver={(e) => onDragOver(e, col.id)}
              onDrop={onDrop}
            >
              {items}
              {items.length === 0 && !dragId && <p className="px-1 text-xs text-ink-muted">No cards</p>}
            </div>
            {canCreate &&
              (adding === col.id ? (
                <form method="post" className="flex shrink-0 flex-col gap-2" onSubmit={submitNew}>
                  <BaseInput autoFocus placeholder="Card title" aria-label="Card title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <div className="flex items-center gap-2">
                    <BaseButton type="submit" size="sm" disabled={!title.trim()}>
                      Add card
                    </BaseButton>
                    <ConfirmDialog
                      open={asking}
                      onOpenChange={setAsking}
                      tone="primary"
                      confirmLabel="Create"
                      title={`Create card “${title.trim()}”?`}
                      message={`It is added to ${col.name}.`}
                      onConfirm={() => createCard(col.id)}
                    />
                    <BaseButton size="sm" variant="ghost" onClick={() => setAdding(null)}>
                      Cancel
                    </BaseButton>
                  </div>
                </form>
              ) : (
                <BaseButton variant="secondary" className="min-h-control shrink-0 rounded-card bg-surface-raised text-ink-muted" onClick={() => { setAdding(col.id); setTitle(""); }}>
                  <Plus aria-hidden="true" />
                  Add Card
                </BaseButton>
              ))}
          </section>
        );
      })}
      {columnActions && <AddColumn onCreate={columnActions.onAdd} />}
    </div>
  );
}
