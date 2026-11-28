import { ArrowRight } from "lucide-react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { describeActivity, formatWhen } from "@/lib/activity";
import type { ActivityEntry } from "@/lib/types";

interface ActivityLineProps {
  entry: ActivityEntry;
  names?: Record<string, string>;
  columns?: Record<string, string>;
  showContext?: boolean;
}

export function ActivityLine({ entry, names, columns, showContext = false }: ActivityLineProps) {
  const p = describeActivity(entry, { names, columns });
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm wrap-anywhere">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        <strong className="font-semibold">{p.actor}</strong>
        <span>{p.verb}</span>
        {p.object && <span className="font-medium">“{p.object}”</span>}
        {showContext && p.context && <span className="text-ink-muted">on “{p.context}”</span>}
        {p.details.map((d, i) =>
          d.kind === "move" ? (
            <span key={i} className="inline-flex items-center gap-1">
              <span>from</span>
              <BaseBadge>{d.from ?? "?"}</BaseBadge>
              <ArrowRight className="size-icon-sm text-ink-muted" aria-hidden="true" />
              <BaseBadge>{d.to ?? "?"}</BaseBadge>
            </span>
          ) : d.kind === "assign" ? (
            <span key={i} className="inline-flex items-center gap-1">
              <span>to</span>
              <strong className="font-semibold">{d.to ?? "someone"}</strong>
            </span>
          ) : null,
        )}
      </div>
      {p.details.some((d) => d.kind === "change") && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-ink-muted">
          {p.details.map((d, i) =>
            d.kind === "change" ? (
              <li key={i} className="flex flex-wrap items-center gap-1">
                <span className="font-medium text-ink">{d.field}</span>
                {d.from || d.to ? (
                  <>
                    <span>{d.from ?? "none"}</span>
                    <ArrowRight className="size-icon-sm" aria-hidden="true" />
                    <span>{d.to ?? "none"}</span>
                  </>
                ) : (
                  <span>changed</span>
                )}
              </li>
            ) : null,
          )}
        </ul>
      )}
      <time dateTime={entry.created_at ?? undefined} className="text-xs text-ink-muted">
        {formatWhen(entry.created_at)}
      </time>
    </div>
  );
}
