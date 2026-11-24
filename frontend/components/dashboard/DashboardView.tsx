"use client";

import { Gauge } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ActivityLine } from "@/components/card/ActivityLine";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseCombobox } from "@/components/shared/BaseCombobox";
import { useShell } from "@/components/shell/ShellContext";
import { api } from "@/lib/api";
import { percentDone, sumAnalytics, sumThroughput } from "@/lib/dashboard";
import type { ActivityEntry, Analytics, Role, Throughput } from "@/lib/types";
import { ThroughputChart } from "./ThroughputChart";

const ALL = "all";

interface DashboardViewProps {
  role: Role;
  analytics: Analytics[];
  throughput: Throughput[];
}

/** The Dashboard (Requirement 43): overview, completed per week, open work, then the Boards table or the recent activity. */
export function DashboardView({ role, analytics, throughput }: DashboardViewProps) {
  const manager = role === "manager";
  const { toggleSidePanel } = useShell();
  const [selected, setSelected] = useState(manager ? ALL : (analytics[0]?.board_id ?? ""));
  const all = selected === ALL;

  if (analytics.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-page py-12 text-center">
        <span aria-hidden="true" className="inline-flex size-tile items-center justify-center rounded-card bg-accent-tint text-on-accent-tint">
          <Gauge className="size-icon-lg" />
        </span>
        <h1 className="font-heading text-page-title">No boards to show yet.</h1>
        <p className="text-sm text-ink-muted">A board appears here when you own it or, for a manager, when it exists.</p>
        <Link href="/boards" className="text-sm font-semibold">
          Go to Home
        </Link>
      </div>
    );
  }

  const rows = all ? analytics : analytics.filter((a) => a.board_id === selected);
  const totals = sumAnalytics(rows);
  const weeks = sumThroughput(all ? throughput : throughput.filter((t) => t.board_id === selected));
  const percent = percentDone(totals);
  const title = all ? "All boards" : (rows[0]?.name ?? "");
  const options = [...(manager ? [{ value: ALL, label: "All boards" }] : []), ...analytics.map((a) => ({ value: a.board_id, label: a.name }))];

  return (
    <div className="flex flex-col gap-6 px-page pt-2 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-2 text-2xs text-ink-muted uppercase">
            <i aria-hidden="true" className="size-dot rounded-full bg-accent" />
            Analytics
          </span>
          <h1 className="font-heading text-xl">Dashboard</h1>
        </div>
        <div className="w-popover">
          <BaseCombobox label="Board" options={options} value={selected} onChange={setSelected} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        <section aria-label="Board overview" className="flex flex-col gap-4 rounded-frame border border-line bg-surface-raised p-6 shadow-card">
          <h2 className="font-heading text-page-title">{title}</h2>
          <div className="flex flex-col gap-2 rounded-card bg-gradient-brand p-4 text-on-brand shadow-popover">
            <span className="text-2xs uppercase text-on-brand-muted">Board progress</span>
            <span className="font-heading text-xl">{percent}% Done</span>
            <span className="text-meta text-on-brand-muted">
              {totals.done} of {totals.total} Cards done
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <span className="text-meta text-ink-muted">Completed in the last 7 days</span>
            <span className="inline-flex items-center gap-2 font-heading text-page-title">
              {totals.done_delta}
              <BaseBadge tone="accent">7d</BaseBadge>
            </span>
          </div>
        </section>

        <ThroughputChart weeks={weeks} />

        <section aria-label="Open work" className="flex flex-col gap-4 rounded-frame border border-line bg-surface-raised p-6 shadow-card">
          <h2 className="font-heading text-page-title">Open work</h2>
          <div>
            <div className="font-heading text-xl">{totals.total - totals.done}</div>
            <div className="text-meta text-ink-muted">Open Cards</div>
          </div>
          <dl className="m-0 flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-card bg-surface px-4 py-3">
              <dt className="inline-flex items-center gap-2 text-sm">
                <i aria-hidden="true" className="size-dot-md rounded-full bg-tone-blue" />
                In progress
              </dt>
              <dd className="m-0 font-semibold">{totals.in_progress}</dd>
            </div>
            <div className="flex items-center justify-between rounded-card bg-surface px-4 py-3">
              <dt className="inline-flex items-center gap-2 text-sm">
                <i aria-hidden="true" className="size-dot-md rounded-full bg-tone-red" />
                Overdue
              </dt>
              <dd className="m-0 font-semibold">{totals.overdue}</dd>
            </div>
          </dl>
        </section>
      </div>

      {manager && all ? <BoardsTable rows={analytics} /> : !all && <RecentActivity boardId={selected} onViewAll={() => toggleSidePanel("activity")} />}
    </div>
  );
}

function BoardsTable({ rows }: { rows: Analytics[] }) {
  return (
    <section aria-label="Boards" className="overflow-hidden rounded-frame border border-line bg-surface-raised shadow-card">
      <h2 className="px-6 pt-6 font-heading text-page-title">Boards</h2>
      <div className="overflow-x-auto p-6">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-2xs text-ink-muted uppercase">
              <th scope="col" className="pb-3 font-semibold">Board</th>
              <th scope="col" className="pb-3 font-semibold">Total</th>
              <th scope="col" className="pb-3 font-semibold">Done</th>
              <th scope="col" className="pb-3 font-semibold">Overdue</th>
              <th scope="col" className="pb-3 font-semibold">Last 7 days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.board_id} className="border-t border-line">
                <td className="py-3 pr-4">
                  <Link href={`/boards/${a.board_id}`} className="font-semibold">
                    {a.name}
                  </Link>
                </td>
                <td className="py-3 pr-4">{a.total}</td>
                <td className="py-3 pr-4">{percentDone(a)}%</td>
                <td className="py-3 pr-4">{a.overdue}</td>
                <td className="py-3">{a.done_delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <section aria-label="Recent activity" className="rounded-frame border border-line bg-surface-raised p-6 shadow-card">
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
        <div aria-hidden="true" className="h-chart rounded-card bg-surface-strong" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No activity yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((r) => (
            <li key={r.id} className="rounded-card bg-surface p-4">
              <ActivityLine entry={r} showContext />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
