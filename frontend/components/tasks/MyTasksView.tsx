import Link from "next/link";
import { ListTodo } from "lucide-react";
import { DueBadge } from "@/components/board/DueBadge";
import { BaseBadge, type BadgeTone } from "@/components/shared/BaseBadge";
import { shortDate } from "@/lib/format";
import { routes, cardPath } from "@/lib/routes";
import type { MyCards, MyTaskGroupKey, Priority } from "@/lib/types";

const GROUP_LABEL: Record<MyTaskGroupKey, string> = { overdue: "Overdue", today: "Today", tomorrow: "Tomorrow", this_week: "This week", later: "Later", no_due: "No due date" };
const PRIORITY_TONE: Record<Priority, BadgeTone> = { high: "danger", medium: "accent", low: "neutral" };

/** The signed-in user's open Cards in the groups the Backend computed (Requirement 52): the page never groups by the browser date (TASK-05). */
export function MyTasksView({ data }: { data: MyCards }) {
  if (data.groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-page py-12 text-center">
        <span aria-hidden="true" className="inline-flex size-tile items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
          <ListTodo className="size-icon-lg" />
        </span>
        <h1 className="font-heading text-xl">Nothing assigned to you</h1>
        <p className="text-sm text-ink-muted">Cards assigned to you appear here, grouped by when they are due.</p>
        <Link href={routes.boards} className="text-sm font-semibold">
          Go to boards
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-section px-page pt-surface pb-surface">
      <h1 className="font-heading text-xl">My tasks</h1>
      {data.groups.map((g) => (
        <section key={g.key} aria-label={GROUP_LABEL[g.key]} className="flex flex-col gap-2 rounded-ui bg-surface p-item">
          <h2 className="flex items-center gap-2 px-1 font-heading text-page-title">
            {GROUP_LABEL[g.key]}
            <BaseBadge tone="count">{g.cards.length}</BaseBadge>
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {g.cards.map((c) => (
              <li key={c.id}>
                <Link
                  href={cardPath(c.board_slug, c.id)}
                  className="flex min-h-touch flex-col gap-1 rounded-ui bg-surface-raised p-item no-underline shadow-card transition-all duration-base ease-out hover:shadow-hover focus-ring lg:flex-row lg:items-center lg:gap-4"
                >
                  <span className="min-w-0 flex-1 font-medium break-words text-ink">{c.title}</span>
                  <span className="text-sm text-ink-muted">{c.board_name}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <BaseBadge tone={PRIORITY_TONE[c.priority]}>{c.priority}</BaseBadge>
                    {c.end_date && <span className="text-sm text-ink-muted">{shortDate(c.end_date)}</span>}
                    <DueBadge state={c.due_state} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
