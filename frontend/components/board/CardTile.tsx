import { CalendarDays, CircleCheck, Flag, Paperclip, SquareCheck, TriangleAlert } from "lucide-react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { ProgressMeter } from "@/components/shared/ProgressMeter";
import { BaseBadge, type BadgeTone } from "@/components/shared/BaseBadge";
import { shortDate } from "@/lib/format";
import { categoryTone, DOT } from "@/lib/tones";
import type { Card, Category, Priority, Member } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_TONE: Record<Priority, BadgeTone> = { high: "danger", medium: "accent", low: "neutral" };

interface CardTileProps {
  card: Card;
  category?: Category;
  assignee?: Pick<Member, "full_name" | "avatar_url">;
  overdue: boolean;
  /** The Card sits in the Done Column. */
  done?: boolean;
  draggable: boolean;
  /** The handlers are optional so a static copy (the landing page preview) renders on the server. */
  onOpen?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}

/** The card face, Trello style: label chips, title, a row of small badges, and the assignee avatar. */
export function CardTile({ card, category, assignee, overdue, done = false, draggable, onOpen, onDragStart, onDragEnd }: CardTileProps) {
  const total = card.subtasks.length;
  const doneCount = card.subtasks.filter((s) => s.is_done).length;
  return (
    <div
      data-flip-id={card.id}
      data-card-id={card.id}
      role="button"
      tabIndex={0}
      draggable={draggable}
      aria-label={`Open card ${card.title}`}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen()) : undefined}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "flex flex-col gap-3 rounded-card bg-surface-raised p-4 shadow-card transition-all duration-base ease-out focus-ring",
        "hover:shadow-hover",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        {category && (
          <BaseBadge shape="tag" tone="neutral" className="uppercase">
            <i aria-hidden="true" className={cn("size-dot shrink-0 rounded-full", DOT[categoryTone(category)])} />
            {category.name}
          </BaseBadge>
        )}
        {done ? (
          <BaseBadge tone="accent">
            <CircleCheck className="size-icon-sm" aria-hidden="true" />
            Completed
          </BaseBadge>
        ) : (
          <BaseBadge tone={PRIORITY_TONE[card.priority]} className="ml-auto">
            <Flag className="size-icon-flag" aria-hidden="true" />
            {card.priority}
          </BaseBadge>
        )}
      </div>
      <div className={cn("text-card-title break-words", done && "text-ink-muted line-through")}>{card.title}</div>
      {card.description && <p className="line-clamp-2 text-card-meta text-ink-muted">{card.description}</p>}
      {total > 0 && <ProgressMeter done={doneCount} total={total} overdue={overdue} />}
      <div className="flex flex-wrap items-center gap-3 text-card-meta text-ink-muted">
        {card.end_date && (
          <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-danger")}>
            {overdue ? <TriangleAlert className="size-icon-sm" aria-hidden="true" /> : <CalendarDays className="size-icon-sm" aria-hidden="true" />}
            {overdue ? `Overdue · ${shortDate(card.end_date)}` : shortDate(card.end_date)}
          </span>
        )}
        {card.attachments.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="size-icon-sm" aria-hidden="true" />
            {card.attachments.length}
          </span>
        )}
        {assignee && <BaseAvatar name={assignee.full_name} src={assignee.avatar_url} className="ml-auto" />}
      </div>
    </div>
  );
}
