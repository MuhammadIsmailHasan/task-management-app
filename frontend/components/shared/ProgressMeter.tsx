import { cn } from "@/lib/utils";

export function ProgressMeter({ done, total, label = "Subtasks", className, overdue = false }: { done: number; total: number; label?: string; className?: string; overdue?: boolean }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div role="progressbar" aria-label={`${label} progress`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-progress flex-1 overflow-hidden rounded-ui bg-surface-sunken">
        <div className={cn("h-full rounded-ui transition-all duration-base", overdue ? "bg-danger" : "bg-accent")} style={{ width: `${percent}%` }} />
      </div>
      <span className="shrink-0 text-xs text-ink-muted">
        {done} of {total}
      </span>
    </div>
  );
}
