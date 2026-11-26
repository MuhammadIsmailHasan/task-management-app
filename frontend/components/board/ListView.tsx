import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseBadge, type BadgeTone } from "@/components/shared/BaseBadge";
import { shortDate } from "@/lib/format";
import { categoryTone } from "@/lib/tones";
import type { Card, Category, Column, DueState, Member, Priority } from "@/lib/types";
import { DueBadge } from "./DueBadge";

const PRIORITY_TONE: Record<Priority, BadgeTone> = { high: "danger", medium: "accent", low: "neutral" };

interface ListViewProps {
  columns: Column[];
  cards: Card[];
  categories: Category[];
  members: Member[];
  onOpen: (card: Card) => void;
}

/**
 * The Board's Cards grouped by Column, one table section per Column (VIEW-01). From 960 pixels a row is a table row;
 * below it the same fields stack as a card with a 44 pixel hit area (VIEW-02).
 */
export function ListView({ columns, cards, categories, members, onOpen }: ListViewProps) {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const doneId = columns.find((c) => c.name === "Done")?.id;
  const ordered = [...columns].sort((a, b) => a.order - b.order);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-page pb-6">
      {ordered.map((col) => {
        const rows = cards.filter((c) => c.column_id === col.id).sort((a, b) => a.order - b.order);
        const due = (c: Card): DueState => (col.id === doneId ? null : (c.due_state ?? null));
        return (
          <section key={col.id} aria-label={col.name} className="flex flex-col gap-2 rounded-frame bg-surface p-3">
            <h2 className="flex items-center gap-2 px-1 font-heading text-page-title">
              {col.name}
              <BaseBadge tone="count">{rows.length}</BaseBadge>
            </h2>
            {rows.length === 0 ? (
              <p className="px-1 text-sm text-ink-muted">No cards</p>
            ) : (
              <>
                <div aria-hidden="true" className="hidden grid-cols-6 gap-3 px-4 text-2xs text-ink-muted uppercase lg:grid">
                  <span className="col-span-2">Title</span>
                  <span>Assignee</span>
                  <span>Priority</span>
                  <span>Category</span>
                  <span>Due</span>
                </div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {rows.map((card) => {
                    const category = card.category_id ? categoryById.get(card.category_id) : undefined;
                    const assignee = card.assignee_name ? { full_name: card.assignee_name, avatar_url: card.assignee_avatar_url ?? null, inactive: card.assignee_is_active === false, unavailable: card.assignee_is_available === false } : card.assignee_id ? memberById.get(card.assignee_id) : undefined;
                    return (
                      <li key={card.id}>
                        <BaseButton
                          variant="ghost"
                          onClick={() => onOpen(card)}
                          aria-label={`Open card ${card.title}`}
                          className="grid h-auto min-h-touch w-full grid-cols-1 items-center justify-items-start gap-2 rounded-card bg-surface-raised p-4 text-left font-normal whitespace-normal shadow-card hover:bg-surface-raised hover:shadow-hover lg:grid-cols-6 lg:gap-3"
                        >
                          <span className="min-w-0 font-medium break-words lg:col-span-2">{card.title}</span>
                          <span className="flex min-w-0 items-center gap-2 text-sm">
                            {assignee ? (
                              <>
                                <BaseAvatar name={assignee.full_name} src={assignee.avatar_url} inactive={"inactive" in assignee ? assignee.inactive : false} unavailable={"unavailable" in assignee ? assignee.unavailable : false} />
                                <span className="truncate">{assignee.full_name}</span>
                              </>
                            ) : (
                              <span className="text-ink-muted">Unassigned</span>
                            )}
                          </span>
                          <span>
                            <BaseBadge tone={PRIORITY_TONE[card.priority]}>{card.priority}</BaseBadge>
                          </span>
                          <span>
                            {category ? (
                              <BaseBadge shape="tag" tone={categoryTone(category)} className="lowercase">
                                {category.name}
                              </BaseBadge>
                            ) : (
                              <span className="text-sm text-ink-muted">No category</span>
                            )}
                          </span>
                          <span className="flex flex-wrap items-center gap-2 text-sm">
                            {card.end_date ? shortDate(card.end_date) : <span className="text-ink-muted">No date</span>}
                            <DueBadge state={due(card)} />
                          </span>
                        </BaseButton>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
