import Link from "next/link";
import { CalendarClock, CircleAlert, ListOrdered } from "lucide-react";
import { BaseBadge, type BadgeTone } from "@/components/shared/BaseBadge";
import { BaseDateField } from "@/components/shared/BaseDateField";
import { DueBadge } from "@/components/board/DueBadge";
import { finishedShares } from "@/lib/dashboard";
import { shortDate } from "@/lib/format";
import { cardPath } from "@/lib/routes";
import type { DashboardData, Priority, TaskCard } from "@/lib/types";

const PRIORITY_TONE: Record<Priority, BadgeTone> = { high: "danger", medium: "accent", low: "neutral" };

function Row({ card }: { card: TaskCard }) {
  return (
    <li className="flex flex-col gap-1 rounded-ui bg-surface p-item text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={cardPath(card.board_slug, card.id)} className="min-w-0 font-semibold break-words">
          {card.title}
        </Link>
        <BaseBadge tone={PRIORITY_TONE[card.priority]}>{card.priority}</BaseBadge>
        <DueBadge state={card.due_state} />
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-ink-muted">
        <span>{card.board_name}</span>
        {card.assignee_name && <span>{card.assignee_name}</span>}
        {card.end_date && <span>{shortDate(card.end_date)}</span>}
      </div>
    </li>
  );
}

function Widget({ label, icon: Icon, count, note, aside, empty, cards, more }: { label: string; icon: typeof CircleAlert; count?: number; note?: string; aside?: React.ReactNode; empty: string; cards: TaskCard[]; more?: number }) {
  return (
    <section aria-label={label} className="flex flex-col gap-3 rounded-ui border border-line bg-surface-raised p-surface shadow-card">
      <header className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className="inline-flex size-control shrink-0 items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
          <Icon className="size-icon" />
        </span>
        <h2 className="min-w-0 flex-1 font-heading text-page-title">{label}</h2>
        {count !== undefined && <BaseBadge tone="count">{count}</BaseBadge>}
        {aside}
      </header>
      {note && <p className="text-xs text-ink-muted">{note}</p>}
      {cards.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">{cards.map((c) => <Row key={c.id} card={c} />)}</ul>
      )}
      {!!more && more > 0 && <p className="text-xs text-ink-muted">and {more} more</p>}
    </section>
  );
}

export function DashboardWidgets({ data, dueOn, onDueOn }: { data: DashboardData; dueOn: string; onDueOn: (value: string) => void }) {
  const shares = finishedShares(data.finished);
  const tomorrowTitle = data.due_tomorrow.due_on && dueOn ? `Due on ${shortDate(data.due_tomorrow.due_on)}` : "Due tomorrow";
  return (
    <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
      <Widget label="Overdue cards" icon={CircleAlert} count={data.overdue.count} empty="Nothing overdue" cards={data.overdue.cards} more={data.overdue.count - data.overdue.cards.length} />
      <Widget
        label={tomorrowTitle}
        icon={CalendarClock}
        count={data.due_tomorrow.count}
        empty="Nothing due tomorrow"
        cards={data.due_tomorrow.cards}
        more={data.due_tomorrow.count - data.due_tomorrow.cards.length}
        aside={
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Due on
            <BaseDateField label="Due on" size="sm" value={dueOn || data.due_tomorrow.due_on} onChange={(v) => v && onDueOn(v)} />
          </label>
        }
      />
      <Widget label="Top 5 priority cards" icon={ListOrdered} note="Not limited by the date range" empty="No cards to rank" cards={data.top_priority.cards} />
      <section aria-label="Finished on time" className="flex flex-col gap-3 rounded-ui border border-line bg-surface-raised p-surface shadow-card">
        <h2 className="font-heading text-page-title">Finished on time and overdue</h2>
        {!shares ? (
          <p className="text-sm text-ink-muted">No finished cards in this period</p>
        ) : (
          <>
            <div role="img" aria-label={`${data.finished.on_time} finished on time, ${data.finished.overdue} finished overdue`} className="flex h-progress-lg w-full overflow-hidden rounded-ui bg-surface-strong">
              <div className="h-full bg-accent" style={{ width: `${shares.onTime}%` }} />
              <div className="h-full bg-danger" style={{ width: `${shares.overdue}%` }} />
            </div>
            <p className="text-sm font-semibold">On time {shares.percent}%</p>
            <table className="sr-only">
              <caption>Cards finished in the range that have an end date</caption>
              <tbody>
                <tr>
                  <th scope="row">On time</th>
                  <td>{data.finished.on_time}</td>
                </tr>
                <tr>
                  <th scope="row">Overdue</th>
                  <td>{data.finished.overdue}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
        <dl className="m-0 grid grid-cols-2 gap-3">
          <div className="rounded-ui bg-surface p-item">
            <dt className="text-xs text-ink-muted">Finished on time</dt>
            <dd className="m-0 font-heading text-page-title">{data.finished.on_time}</dd>
          </div>
          <div className="rounded-ui bg-surface p-item">
            <dt className="text-xs text-ink-muted">Finished overdue</dt>
            <dd className="m-0 font-heading text-page-title">{data.finished.overdue}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
