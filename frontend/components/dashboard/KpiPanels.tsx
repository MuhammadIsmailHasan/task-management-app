"use client";

import { useEffect, useState } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { api } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { days, onTimeTone, overdueNote, percent } from "@/lib/kpi";
import type { KpiFigures, KpiReport, MyKpi } from "@/lib/types";

const SECTION = "flex flex-col gap-4 rounded-ui border border-line bg-surface-raised p-surface shadow-card";
const COLUMNS = ["Finished", "On-time", "Throughput", "Overdue", "Cycle", "Rework", "Open"] as const;

function Tile({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-ui bg-surface p-item">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="m-0 font-heading text-page-title">{value}</dd>
      <dd className="m-0 text-xs text-ink-muted">{note}</dd>
    </div>
  );
}

export function KpiTiles({ figures }: { figures: KpiFigures }) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile label="On-time rate" value={<BaseBadge tone={onTimeTone(figures.on_time_rate)}>{percent(figures.on_time_rate)}</BaseBadge>} note={`of ${figures.finished} finished`} />
      <Tile label="Throughput" value={figures.throughput} note="cards per week" />
      <Tile label="Overdue now" value={figures.overdue_now} note={overdueNote(figures)} />
      <Tile label="Cycle time" value={days(figures.cycle_days)} note="Todo to Done" />
      <Tile label="Rework rate" value={percent(figures.rework_rate)} note="sent to Revision" />
      <Tile label="Open workload" value={figures.open} note="open cards now" />
    </dl>
  );
}

function useLoad<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setData(null);
    setFailed(false);
    load()
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [key, attempt]);
  return { data, failed, retry: () => setAttempt((n) => n + 1) };
}

function Status({ failed, retry, label }: { failed: boolean; retry: () => void; label: string }) {
  if (!failed) return <div aria-hidden="true" className="h-chart rounded-ui bg-surface-strong" />;
  return (
    <div className="flex items-center gap-3 text-sm text-danger">
      Could not load {label}.
      <BaseButton variant="secondary" size="sm" onClick={retry}>
        Retry
      </BaseButton>
    </div>
  );
}

const range = (r: { from: string; to: string }) => `${shortDate(r.from)} to ${shortDate(r.to)}`;

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span>
      <span className="text-ink-muted lg:hidden">{label} </span>
      {children}
    </span>
  );
}

export function TeamPerformance({ board, from, to }: { board?: string; from?: string; to?: string }) {
  const { data, failed, retry } = useLoad<KpiReport>(() => api.analytics.kpi({ board, from, to }), `${board}|${from}|${to}`);
  return (
    <section aria-label="Team performance" className={SECTION}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-page-title">Team performance</h2>
        {data && <span className="text-xs text-ink-muted">{range(data.range)}</span>}
      </header>
      {!data ? (
        <Status failed={failed} retry={retry} label="team performance" />
      ) : (
        <>
          <KpiTiles figures={data.team} />
          {data.people.length === 0 ? (
            <p className="text-sm text-ink-muted">No people on these boards yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div aria-hidden="true" className="hidden grid-cols-9 gap-3 px-3 text-xs text-ink-muted uppercase lg:grid">
                <span className="col-span-2">Person</span>
                {COLUMNS.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <ul aria-label="People" className="m-0 flex list-none flex-col gap-2 p-0">
                {data.people.map((p) => (
                  <li key={p.id} className="grid grid-cols-2 items-center gap-3 rounded-ui bg-surface p-item text-sm lg:grid-cols-9">
                    <span className="col-span-2 flex min-w-0 items-center gap-2 font-semibold">
                      <BaseAvatar name={p.full_name} src={p.avatar_url} />
                      <span className="break-words">{p.full_name}</span>
                    </span>
                    <Cell label="Finished">{p.finished}</Cell>
                    <Cell label="On-time">
                      <BaseBadge tone={onTimeTone(p.on_time_rate)}>{percent(p.on_time_rate)}</BaseBadge>
                    </Cell>
                    <Cell label="Throughput">{p.throughput}/wk</Cell>
                    <Cell label="Overdue">{p.overdue_now}</Cell>
                    <Cell label="Cycle">{days(p.cycle_days)}</Cell>
                    <Cell label="Rework">{percent(p.rework_rate)}</Cell>
                    <Cell label="Open">{p.open}</Cell>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-ink-muted">A rate shows – until 3 cards count toward it. Overdue and open are today, not limited by the range.</p>
        </>
      )}
    </section>
  );
}

export function MyPerformance() {
  const { data, failed, retry } = useLoad<MyKpi>(() => api.me.kpi(), "me");
  return (
    <section aria-label="My performance" className={SECTION}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-page-title">My performance</h2>
        {data && <span className="text-xs text-ink-muted">{range(data.range)}</span>}
      </header>
      {data ? <KpiTiles figures={data} /> : <Status failed={failed} retry={retry} label="your performance" />}
    </section>
  );
}
