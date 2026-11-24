import { AlertTriangle, LayoutList, Users } from "lucide-react";
import Link from "next/link";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import type { Board, Member } from "@/lib/types";
import { cn } from "@/lib/utils";

const AVATARS = 3;

/** A board on Home: name, description, progress, counts, and a few members. */
export function BoardTile({ board, members }: { board: Board; members: Member[] }) {
  const cards = board.card_count ?? 0;
  const done = board.done_count ?? 0;
  const overdue = board.overdue_count ?? 0;
  const memberCount = board.member_count ?? members.length;
  const percent = cards ? Math.round((done / cards) * 100) : 0;
  const shown = members.slice(0, AVATARS);
  const extra = memberCount - shown.length;

  return (
    <Link
      href={`/boards/${board.id}`}
      className="flex h-full flex-col overflow-hidden rounded-frame border border-line bg-surface-raised text-ink no-underline shadow-card transition-all duration-base ease-out hover:-translate-y-lift hover:shadow-hover focus-ring"
    >
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 font-heading text-page-title break-words">{board.name}</h2>
        </div>
        {board.description && <p className="line-clamp-2 text-meta text-ink-muted">{board.description}</p>}
        <div className="mt-auto flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div role="progressbar" aria-label={`${board.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-progress flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-meta font-semibold text-accent">{percent}%</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1" title="Cards">
              <LayoutList className="size-icon-sm" aria-hidden="true" />
              {cards} cards
            </span>
            <span className={cn("inline-flex items-center gap-1", overdue > 0 && "font-medium text-danger")} title="Overdue">
              <AlertTriangle className="size-icon-sm" aria-hidden="true" />
              {overdue} overdue
            </span>
            <span className="ml-auto inline-flex items-center gap-1" title="Members">
              <Users className="size-icon-sm" aria-hidden="true" />
              {memberCount}
            </span>
          </div>
          {shown.length > 0 && (
            <div className="flex items-center">
              {shown.map((m, i) => (
                <BaseAvatar key={m.id} name={m.full_name} src={m.avatar_url} className={i > 0 ? "stack-overlap" : undefined} />
              ))}
              {extra > 0 && <BaseAvatar name={`${extra} more members`} label={`+${extra}`} className="stack-overlap bg-accent-tint text-on-accent-tint" />}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
