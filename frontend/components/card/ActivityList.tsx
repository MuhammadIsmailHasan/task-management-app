import type { ActivityEntry } from "@/lib/types";
import { ActivityLine } from "./ActivityLine";

/** Plain rendering of a card's own activity log. */
export function ActivityList({ entries, names = {}, columns = {} }: { entries: ActivityEntry[]; names?: Record<string, string>; columns?: Record<string, string> }) {
  if (entries.length === 0) return <p className="text-ink-muted">No activity yet.</p>;
  return (
    <ol className="m-0 flex list-none flex-col gap-4 ml-2 border-l border-line p-0 pl-4">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute top-2 -left-4 size-dot-md -translate-x-1/2 rounded-full bg-brand" aria-hidden="true" />
          <ActivityLine entry={e} names={names} columns={columns} />
        </li>
      ))}
    </ol>
  );
}
