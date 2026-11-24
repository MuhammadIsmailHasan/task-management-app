import type { Analytics, Throughput, ThroughputWeek } from "./types";

export interface Totals {
  total: number;
  done: number;
  in_progress: number;
  overdue: number;
  done_delta: number;
}

/** Add up the figures of Requirement 10 across boards ("All boards"); nothing is computed from Card rows. */
export function sumAnalytics(rows: Analytics[]): Totals {
  const t: Totals = { total: 0, done: 0, in_progress: 0, overdue: 0, done_delta: 0 };
  for (const r of rows) {
    t.total += r.total;
    t.done += r.done;
    t.in_progress += r.in_progress;
    t.overdue += r.overdue;
    t.done_delta += r.done_delta;
  }
  return t;
}

/** The weekly series of several boards added week by week (every board lists the same weeks). */
export function sumThroughput(series: Throughput[]): ThroughputWeek[] {
  const first = series[0]?.weeks ?? [];
  return first.map((w, i) => ({ week_start: w.week_start, done: series.reduce((n, s) => n + (s.weeks[i]?.done ?? 0), 0) }));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-12" as "12 Oct". */
export function formatWeek(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Height of each bar as a share of the tallest one; a week with 0 has no height. */
export function barShares(weeks: ThroughputWeek[]): number[] {
  const max = Math.max(0, ...weeks.map((w) => w.done));
  return weeks.map((w) => (max === 0 ? 0 : Math.round((w.done / max) * 100)));
}

export const percentDone = (t: Pick<Totals, "total" | "done">) => (t.total ? Math.round((t.done / t.total) * 100) : 0);
