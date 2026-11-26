import { BarChart3 } from "lucide-react";
import { barShares, formatWeek } from "@/lib/dashboard";
import type { ThroughputWeek } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Cards completed per week as pill bars: token colours, no chart library, a hidden table for assistive technology (DASH-04). */
export function ThroughputChart({ weeks }: { weeks: ThroughputWeek[] }) {
  const shares = barShares(weeks);
  const total = weeks.reduce((n, w) => n + w.done, 0);
  const last = weeks.length - 1;
  return (
    <section aria-label="Completed per week" className="flex flex-col gap-4 rounded-ui border border-line bg-surface-raised p-surface shadow-card">
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex size-control shrink-0 items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
          <BarChart3 className="size-icon" />
        </span>
        <h2 className="font-heading text-page-title">Completed per week</h2>
      </header>
      <div role="img" aria-label={`Cards completed per week over the last ${weeks.length} weeks: ${total} in total`} className="flex h-chart items-end gap-3">
        {weeks.map((w, i) => (
          <div key={w.week_start} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className={cn("rounded-ui bg-ink px-2 py-half text-xs text-surface-raised", i === last ? "visible" : "invisible group-hover:visible")}>{w.done}</span>
            <div className="flex w-full max-w-tile flex-1 items-end overflow-hidden rounded-ui bg-surface-strong">
              <div className={cn("w-full rounded-ui", i === last ? "bg-accent" : "bg-accent-tint")} style={{ height: `${shares[i]}%` }} />
            </div>
            <span className={cn("text-xs uppercase", i === last ? "text-ink" : "text-ink-muted")}>{formatWeek(w.week_start)}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Cards completed per week</caption>
        <thead>
          <tr>
            <th scope="col">Week starting</th>
            <th scope="col">Completed</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.week_start}>
              <th scope="row">{formatWeek(w.week_start)}</th>
              <td>{w.done}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
