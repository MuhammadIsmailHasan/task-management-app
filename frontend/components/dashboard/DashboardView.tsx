"use client";

import { Gauge } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityLine } from "@/components/card/ActivityLine";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseCombobox } from "@/components/shared/BaseCombobox";
import { BaseDateField } from "@/components/shared/BaseDateField";
import { useShell } from "@/components/shell/ShellContext";
import { api } from "@/lib/api";
import { EMPTY_FILTERS, filtersFromParams, filtersToQuery, greeting, percentDone, type DashboardFilters } from "@/lib/dashboard";
import { boardByIdPath, routes } from "@/lib/routes";
import type { ActivityEntry, Analytics, DashboardData, Role } from "@/lib/types";
import { DashboardWidgets } from "./DashboardWidgets";
import { ThroughputChart } from "./ThroughputChart";

const ALL = "all";
const NO_NOTE = "Not limited by the date range";

/** A labelled filter: the label sits `--space-label` above its control (DASH-25, DS-04). */
function FilterField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-label">
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

interface DashboardViewProps {
  role: Role;
  /** The Boards this viewer may pick: the ones a Supervisor owns, or every Board for a Manager. */
  boards: { id: string; name: string }[];
}

/**
 * The Dashboard (Requirements 43 and 51): a greeting, the Board, Member, and date range filters, the overview, completed
 * per week, open work, the late and upcoming lists, and the Boards table or the recent activity. One endpoint feeds it,
 * and the filters live in the query string.
 */
export function DashboardView({ role, boards }: DashboardViewProps) {
  const manager = role === "manager" || role === "admin"; // both read every Board (DASH-23)
  const { user, toggleSidePanel } = useShell();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const filters = filtersFromParams((k) => params.get(k));
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hello, setHello] = useState("Hello");

  // the greeting uses the browser's local time, so it is written after mount: no hydration mismatch (DASH-10)
  useEffect(() => setHello(greeting(new Date(), user?.full_name)), [user?.full_name]);

  const boardValue = filters.board || (manager ? ALL : (boards[0]?.id ?? ""));
  const query = filtersToQuery(filters);

  useEffect(() => {
    if (boards.length === 0) return;
    let live = true;
    setData(null);
    setFailed(false);
    api.analytics
      .dashboard({ board: filters.board || (manager ? undefined : boards[0]?.id), member: filters.member || undefined, from: filters.from || undefined, to: filters.to || undefined, dueOn: filters.dueOn || undefined })
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // the query string is the whole filter state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, attempt, boards.length]);

  const change = useCallback(
    (patch: Partial<DashboardFilters>) => router.replace(`${pathname}${filtersToQuery({ ...filters, ...patch })}`),
    [filters, pathname, router],
  );

  if (boards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-page py-12 text-center">
        <span aria-hidden="true" className="inline-flex size-tile items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
          <Gauge className="size-icon-lg" />
        </span>
        <h1 className="font-heading text-xl">No boards to show yet.</h1>
        <p className="text-sm text-ink-muted">A board appears here when you own it or, for a manager, when it exists.</p>
        <Link href={routes.boards} className="text-sm font-semibold">
          Go to Home
        </Link>
      </div>
    );
  }

  const options = [...(manager ? [{ value: ALL, label: "All boards" }] : []), ...boards.map((b) => ({ value: b.id, label: b.name }))];
  const memberOptions = [{ value: "", label: "Anyone" }, ...(data?.members ?? []).map((m) => ({ value: m.id, label: m.full_name }))];
  const allBoards = boardValue === ALL;
  const title = allBoards ? "All boards" : (boards.find((b) => b.id === boardValue)?.name ?? "");
  const changed = !!(filters.board || filters.member || filters.from || filters.to || filters.dueOn);

  return (
    <div className="flex flex-col gap-section px-page pt-surface pb-surface">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-2 text-xs text-ink-muted uppercase">
            <i aria-hidden="true" className="size-dot rounded-full bg-accent" />
            Dashboard
          </span>
          <h1 className="font-heading text-xl">{hello}</h1>
        </div>
        <section aria-label="Filters" className="rounded-ui border border-line bg-surface-raised p-section shadow-card">
          <div className="grid grid-cols-1 items-end gap-field md:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Board" htmlFor="filter-board">
              <BaseCombobox label="Board" options={options} value={boardValue} searchable onChange={(v) => change({ board: v === ALL ? "" : v, member: "" })} />
            </FilterField>
            <FilterField label="Member" htmlFor="filter-member">
              <BaseCombobox label="Member" options={memberOptions} value={filters.member} searchable onChange={(v) => change({ member: v })} />
            </FilterField>
            <FilterField label="From" htmlFor="filter-from">
              <BaseDateField id="filter-from" label="From" value={data?.range.from ?? filters.from} max={filters.to || undefined} onChange={(v) => v && change({ from: v })} />
            </FilterField>
            <FilterField label="To" htmlFor="filter-to">
              <div className="flex items-center gap-field">
                <div className="min-w-0 flex-1">
                  <BaseDateField id="filter-to" label="To" value={data?.range.to ?? filters.to} min={filters.from || undefined} onChange={(v) => v && change({ to: v })} />
                </div>
                {changed && (
                  <BaseButton variant="ghost" size="sm" onClick={() => router.replace(pathname)}>
                    Reset filters
                  </BaseButton>
                )}
              </div>
            </FilterField>
          </div>
        </section>
      </div>

      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="font-heading text-page-title text-danger">Could not load the dashboard.</p>
          <BaseButton variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </BaseButton>
        </div>
      ) : !data ? (
        <div aria-busy="true" className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-modal-skeleton rounded-ui bg-surface-strong" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
            <section aria-label="Board overview" className="flex flex-col gap-4 rounded-ui border border-line bg-surface-raised p-surface shadow-card">
              <h2 className="font-heading text-page-title">{title}</h2>
              <div className="flex flex-col gap-2 rounded-ui bg-gradient-brand p-item text-on-brand shadow-popover">
                <span className="text-xs uppercase text-on-brand-muted">Board progress</span>
                <span className="font-heading text-xl">{percentDone(data.overview)}% Done</span>
                <span className="text-sm text-on-brand-muted">
                  {data.overview.done} of {data.overview.total} Cards done
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                <span className="text-sm text-ink-muted">Completed in this range</span>
                <span className="inline-flex items-center gap-2 font-heading text-page-title">
                  {data.throughput.total}
                  <BaseBadge tone="accent">done</BaseBadge>
                </span>
              </div>
              <p className="text-xs text-ink-muted">{NO_NOTE}</p>
            </section>

            <ThroughputChart weeks={data.throughput.weeks} />

            <section aria-label="Open work" className="flex flex-col gap-4 rounded-ui border border-line bg-surface-raised p-surface shadow-card">
              <h2 className="font-heading text-page-title">Open work</h2>
              <div>
                <div className="font-heading text-xl">{data.overview.total - data.overview.done}</div>
                <div className="text-sm text-ink-muted">Open Cards</div>
              </div>
              <dl className="m-0 flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-ui bg-surface px-4 py-3">
                  <dt className="inline-flex items-center gap-2 text-sm">
                    <i aria-hidden="true" className="size-dot-md rounded-full bg-tone-blue" />
                    In progress
                  </dt>
                  <dd className="m-0 font-semibold">{data.overview.in_progress}</dd>
                </div>
                <div className="flex items-center justify-between rounded-ui bg-surface px-4 py-3">
                  <dt className="inline-flex items-center gap-2 text-sm">
                    <i aria-hidden="true" className="size-dot-md rounded-full bg-tone-red" />
                    Overdue
                  </dt>
                  <dd className="m-0 font-semibold">{data.overview.overdue}</dd>
                </div>
              </dl>
            </section>
          </div>

          <DashboardWidgets data={data} dueOn={filters.dueOn} onDueOn={(v) => change({ dueOn: v })} />

          {manager && allBoards ? <BoardsTable /> : !allBoards && <RecentActivity boardId={boardValue} onViewAll={() => toggleSidePanel("activity")} />}
        </>
      )}
    </div>
  );
}

/** The Manager's table of every Board (DASH-05): the figures of Requirement 10, rows stack as cards below 960 pixels. */
function BoardsTable() {
  const [rows, setRows] = useState<Analytics[] | null>(null);
  useEffect(() => {
    let live = true;
    api.analytics.all().then((r) => live && setRows(r)).catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, []);
  if (!rows) return <div aria-hidden="true" className="h-chart rounded-ui bg-surface-strong" />;
  return (
    <section aria-label="Boards" className="rounded-ui border border-line bg-surface-raised p-surface shadow-card">
      <h2 className="mb-4 font-heading text-page-title">Boards</h2>
      <div aria-hidden="true" className="hidden grid-cols-5 gap-3 px-3 pb-2 text-xs text-ink-muted uppercase lg:grid">
        <span className="col-span-2">Board</span>
        <span>Total</span>
        <span>Done</span>
        <span>Overdue</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((a) => (
          <li key={a.board_id} className="grid grid-cols-2 items-center gap-3 rounded-ui bg-surface p-item text-sm lg:grid-cols-5">
            <Link href={boardByIdPath(a.board_id)} className="col-span-2 font-semibold break-words">
              {a.name}
            </Link>
            <span>
              <span className="text-ink-muted lg:hidden">Total </span>
              {a.total}
            </span>
            <span>
              <span className="text-ink-muted lg:hidden">Done </span>
              {percentDone(a)}%
            </span>
            <span>
              <span className="text-ink-muted lg:hidden">Overdue </span>
              {a.overdue}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentActivity({ boardId, onViewAll }: { boardId: string; onViewAll: () => void }) {
  const [rows, setRows] = useState<ActivityEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setRows(null);
    setFailed(false);
    api.boards
      .activity(boardId, { limit: 5 })
      .then((r) => live && setRows(r))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [boardId, attempt]);

  return (
    <section aria-label="Recent activity" className="rounded-ui border border-line bg-surface-raised p-surface shadow-card">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-heading text-page-title">Recent activity</h2>
        <BaseButton variant="secondary" size="sm" onClick={onViewAll}>
          View all
        </BaseButton>
      </header>
      {failed ? (
        <div className="flex items-center gap-3 text-sm text-danger">
          Could not load activity.
          <BaseButton variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </BaseButton>
        </div>
      ) : !rows ? (
        <div aria-hidden="true" className="h-chart rounded-ui bg-surface-strong" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No activity yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((r) => (
            <li key={r.id} className="rounded-ui bg-surface p-item">
              <ActivityLine entry={r} showContext />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
