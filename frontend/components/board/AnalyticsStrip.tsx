import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { Analytics } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Totals across the boards a Supervisor owns or, for a Manager, every board. Only these roles may call the analytics API. */
export function AnalyticsStrip({ rows }: { rows: Analytics[] }) {
  const sum = (pick: (a: Analytics) => number) => rows.reduce((n, a) => n + pick(a), 0);
  const stats = [
    { label: "In progress", value: sum((a) => a.in_progress), icon: Loader2, tone: "text-tone-blue" },
    { label: "Done", value: sum((a) => a.done), icon: CheckCircle2, tone: "text-tone-green" },
    { label: "Overdue", value: sum((a) => a.overdue), icon: AlertTriangle, tone: "text-danger" },
  ];
  return (
    <section aria-label="Analytics" className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-4 rounded-ui border border-line bg-surface-raised p-surface shadow-card">
          <s.icon className={cn("size-icon", s.tone)} aria-hidden="true" />
          <div>
            <div className="font-heading text-xl">{s.value}</div>
            <div className="text-sm text-ink-muted">{s.label}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
