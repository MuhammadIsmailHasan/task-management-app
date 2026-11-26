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
    /** Drag and drop: move a Column to this 0-based position (COLD-03). */
    onReorder: (columnId: string, position: number) => Promise<void>;
    onDelete: (columnId: string) => Promise<void>;
    onAdd: (name: string) => Promise<void>;
  };
}

/** Sideways scrolling while a Column is dragged: the strip at each edge and the step per drag event. */
const EDGE = 64;
const SCROLL_STEP = 24;

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
  // a Column being dragged by its grip, and the index among the other Columns it would land at (COLD-02)
  const [colDragId, setColDragId] = useState<string | null>(null);
  const [colTarget, setColTarget] = useState<number | null>(null);
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

  /** Over the Column row while a Column is dragged: where it would land, and sideways scrolling near the edges. */
  function onRowDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!colDragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const row = e.currentTarget;
    const rect = row.getBoundingClientRect();
    if (e.clientX < rect.left + EDGE) row.scrollLeft -= SCROLL_STEP;
    else if (e.clientX > rect.right - EDGE) row.scrollLeft += SCROLL_STEP;
    const centers = Array.from(row.querySelectorAll<HTMLElement>("[data-column-id]"))
      .filter((n) => n.dataset.columnId !== colDragId)
      .map((n) => {
        const r = n.getBoundingClientRect();
        return r.left + r.width / 2;
      });
    const index = dropIndex(centers, e.clientX);
    setColTarget((t) => (t === index ? t : index));
  }

  async function onRowDrop(e: React.DragEvent<HTMLDivElement>) {
    if (!colDragId) return;
    e.preventDefault();
    const id = colDragId;
    const index = colTarget;
    setColDragId(null);
    setColTarget(null);
    if (index === null || !columnActions) return;
    const from = ordered.findIndex((c) => c.id === id);
    if (index !== from) await columnActions.onReorder(id, index); // a drop where it started sends nothing
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
    <div
      ref={root}
      className="@container mx-page flex min-h-0 flex-1 snap-x snap-proximity overflow-x-auto overflow-y-hidden"
      onDragOver={onRowDragOver}
      onDrop={(e) => void onRowDrop(e)}
    >
      {/* the padding sits on this inner row, so the last Column keeps the same gutter as the first when the row scrolls (DS-21) */}
      <div className="flex w-max min-w-full items-stretch gap-gutter pb-item">
      {ordered.flatMap((col, colIndex) => {
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
            <div key="placeholder" data-testid="drop-placeholder" aria-hidden="true" className="drop-placeholder shrink-0 rounded-ui" style={{ height: height ?? undefined }} />,
          );
        }
        // the drop indicator sits before the Column that the dragged one would take the place of
        const others = ordered.filter((c) => c.id !== colDragId);
        const showIndicator = colDragId !== null && col.id !== colDragId && colTarget !== null && others[colTarget]?.id === col.id;
        const indicator = <div key={`drop-${col.id}`} data-testid="column-drop-indicator" aria-hidden="true" className="w-1 shrink-0 self-stretch rounded-ui bg-accent" />;
        const section = (
          <section
            key={col.id}
            data-column-id={col.id}
            aria-label={col.name}
            className={cn("flex max-h-full w-column shrink-0 grow snap-start flex-col gap-item rounded-ui bg-surface p-item", col.id === colDragId && "opacity-muted")}
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
              grip={
                columnActions
                  ? {
                      onDragStart: (e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", col.id);
                        const sectionEl = (e.currentTarget as HTMLElement).closest("section");
                        if (sectionEl) e.dataTransfer.setDragImage(sectionEl, 16, 16);
                        setColDragId(col.id);
                      },
                      // Escape or a drop outside the row ends here without a drop: nothing moves (COLD-02)
                      onDragEnd: () => {
                        setColDragId(null);
                        setColTarget(null);
                      },
                    }
                  : undefined
              }
            />
            <div
              data-testid={`column-${col.name}`}
              className="flex min-h-column-min flex-1 flex-col gap-gutter overflow-y-auto"
              onDragOver={(e) => onDragOver(e, col.id)}
              onDrop={onDrop}
            >
              {items}
              {items.length === 0 && !dragId && <p className="text-sm text-ink-muted">No cards</p>}
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
                <BaseButton variant="secondary" className="min-h-control shrink-0 bg-surface-raised text-ink-muted" onClick={() => { setAdding(col.id); setTitle(""); }}>
                  <Plus aria-hidden="true" />
                  Add Card
                </BaseButton>
              ))}
          </section>
        );
        return showIndicator ? [indicator, section] : [section];
      })}
      {colDragId && colTarget !== null && colTarget >= ordered.length - 1 && ordered.length > 1 && ordered[ordered.length - 1].id !== colDragId && (
        <div data-testid="column-drop-indicator" aria-hidden="true" className="w-1 shrink-0 self-stretch rounded-ui bg-accent" />
      )}
      {columnActions && <AddColumn onCreate={columnActions.onAdd} />}
      </div>
    </div>
  );
}
