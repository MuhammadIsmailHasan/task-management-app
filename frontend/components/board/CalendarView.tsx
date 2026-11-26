"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BasePopover } from "@/components/shared/BasePopover";
import { monthGrid, monthLabel, toIso } from "@/lib/dates";
import { shortDate } from "@/lib/format";
import type { Card, Column } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DueBadge } from "./DueBadge";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHOWN = 3;

interface CalendarViewProps {
  columns: Column[];
  cards: Card[];
  onOpen: (card: Card) => void;
}

/**
 * A month grid, Monday first, with each Card on its `end_date` (VIEW-03). A Card without an `end_date` is not shown.
 * From 960 pixels a day lists its Cards (and "+N more" in a popover); below it a day shows a count dot and the
 * selected day's Cards list under the grid (VIEW-04). The grid opens on the browser's current month and marks today
 * (a known limit: near midnight the server's APP_TIMEZONE date can differ).
 */
export function CalendarView({ columns, cards, onOpen }: CalendarViewProps) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const todayIso = toIso(now);
  const [selected, setSelected] = useState(todayIso);
  const doneId = columns.find((c) => c.name === "Done")?.id;

  const byDay = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const c of cards) {
      if (!c.end_date) continue;
      map.set(c.end_date, [...(map.get(c.end_date) ?? []), c]);
    }
    return map;
  }, [cards]);

  const grid = monthGrid(cursor.year, cursor.month);
  const shift = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };
  const goToday = () => {
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(todayIso);
  };
  const dueOf = (c: Card) => (c.column_id === doneId ? null : (c.due_state ?? null));
  const selectedCards = byDay.get(selected) ?? [];
  const undated = cards.filter((c) => !c.end_date).length;

  const cardButton = (c: Card) => (
    <BaseButton key={c.id} variant="ghost" size="sm" onClick={() => onOpen(c)} aria-label={`Open card ${c.title}`} className="h-auto min-h-0 w-full min-w-0 justify-start gap-1 rounded-sm bg-surface-sunken px-2 py-1 text-left text-xs font-normal">
      <span className="truncate">{c.title}</span>
    </BaseButton>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-page pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-heading text-xl">{monthLabel(cursor.year, cursor.month)}</h2>
        <BaseButton variant="secondary" size="sm" aria-label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeft aria-hidden="true" />
        </BaseButton>
        <BaseButton variant="secondary" size="sm" onClick={goToday}>
          Today
        </BaseButton>
        <BaseButton variant="secondary" size="sm" aria-label="Next month" onClick={() => shift(1)}>
          <ChevronRight aria-hidden="true" />
        </BaseButton>
      </div>
      <div role="grid" aria-label={monthLabel(cursor.year, cursor.month)} className="grid grid-cols-7 gap-1 rounded-frame bg-surface p-2">
        {WEEKDAYS.map((d) => (
          <div key={d} role="columnheader" className="px-1 py-2 text-center text-2xs text-ink-muted uppercase">
            {d}
          </div>
        ))}
        {grid.map(({ iso, inMonth }) => {
          const day = byDay.get(iso) ?? [];
          const isToday = iso === todayIso;
          const extra = day.length - SHOWN;
          return (
            <div
              key={iso}
              role="gridcell"
              aria-selected={iso === selected}
              aria-current={isToday ? "date" : undefined}
              className={cn("flex min-h-touch flex-col gap-1 rounded-card p-1 lg:min-h-calendar-cell", inMonth ? "bg-surface-raised" : "bg-surface text-ink-muted", iso === selected && "bg-accent-tint lg:bg-surface-raised")}
            >
              <BaseButton variant="ghost" size="sm" onClick={() => setSelected(iso)} aria-label={`${shortDate(iso)}, ${day.length} ${day.length === 1 ? "card" : "cards"}`} className={cn("h-auto min-h-0 justify-between rounded-sm px-1 py-1 text-xs font-normal", isToday && "font-semibold text-accent")}>
                <span>{Number(iso.slice(8))}</span>
                {day.length > 0 && <span aria-hidden="true" className="size-dot rounded-full bg-accent lg:hidden" />}
              </BaseButton>
              <div className="hidden flex-col gap-1 lg:flex">
                {day.slice(0, SHOWN).map(cardButton)}
                {extra > 0 && (
                  <BasePopover label={`Cards on ${shortDate(iso)}`} trigger={<BaseButton variant="ghost" size="sm" className="h-auto min-h-0 justify-start px-2 py-1 text-xs">+{extra} more</BaseButton>}>
                    <div className="flex flex-col gap-1">{day.map(cardButton)}</div>
                  </BasePopover>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <section aria-label={`Cards on ${shortDate(selected)}`} className="flex flex-col gap-2 lg:hidden">
        <h3 className="text-sm font-semibold">{shortDate(selected)}</h3>
        {selectedCards.length === 0 && <p className="text-sm text-ink-muted">No cards</p>}
        {selectedCards.map((c) => (
          <BaseButton key={c.id} variant="ghost" onClick={() => onOpen(c)} aria-label={`Open card ${c.title}`} className="h-auto min-h-touch justify-start gap-2 rounded-card bg-surface-raised p-3 text-left text-sm font-normal whitespace-normal shadow-card hover:bg-surface-raised">
            <span className="min-w-0 flex-1 break-words">{c.title}</span>
            <DueBadge state={dueOf(c)} />
          </BaseButton>
        ))}
      </section>
      <p className="text-xs text-ink-muted">{undated === 0 ? "Every card has a due date." : `${undated} ${undated === 1 ? "card has" : "cards have"} no due date and ${undated === 1 ? "is" : "are"} not shown.`}</p>
    </div>
  );
}
