import { Check, X } from "lucide-react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { CardTile } from "@/components/board/CardTile";
import { SAMPLE_CARDS, SAMPLE_CATEGORIES, SAMPLE_COLUMNS, sampleFigures } from "@/lib/landing-sample";

const SHOWN = ["In Progress", "Review"];

/** The product preview (LAND-06): the app's own Card tiles and the sample data, inert, with every figure computed. */
export function ProductPreview() {
  const f = sampleFigures();
  return (
    <figure className="m-0">
      <figcaption className="sr-only">Illustration of a RevoBoard board</figcaption>
      <div aria-hidden="true" inert className="rounded-frame border border-line bg-surface-raised p-6 text-left shadow-float">
        <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
          <span className="flex gap-2">
            <i className="size-dot-md rounded-full bg-tone-red" />
            <i className="size-dot-md rounded-full bg-tone-orange" />
            <i className="size-dot-md rounded-full bg-tone-green" />
          </span>
          <span className="font-heading text-page-title">Platform launch</span>
          <span className="ml-auto flex gap-2">
            <BaseBadge>Private board</BaseBadge>
            <BaseBadge tone="accent">Public link on</BaseBadge>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-gutter lg:grid-cols-4">
          <div className="flex flex-col gap-gutter">
            <div className="flex flex-col gap-2 rounded-card bg-brand p-4 text-on-brand">
              <span className="text-2xs uppercase text-on-brand-muted">Board completion</span>
              <span className="font-heading text-xl">{f.percent}% Done</span>
              <span className="text-meta text-on-brand-muted">
                {f.subtasksDone} of {f.subtasksTotal} subtasks done
              </span>
              <div className="h-progress-lg overflow-hidden rounded-full bg-on-brand-soft">
                <div className="h-full rounded-full bg-accent-tint" style={{ width: `${f.percent}%` }} />
              </div>
            </div>
            <div className="hidden rounded-card bg-surface p-4 lg:block">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                Join requests <BaseBadge tone="accent">1 new</BaseBadge>
              </div>
              <div className="flex items-center gap-2 rounded-field bg-surface-raised p-2 text-meta">
                <span className="min-w-0 flex-1">Marcus R. asked to join</span>
                <span className="inline-flex size-chip items-center justify-center rounded-full bg-accent-tint text-on-accent-tint"><Check className="size-icon-sm" /></span>
                <span className="inline-flex size-chip items-center justify-center rounded-full bg-danger-soft text-on-danger-soft"><X className="size-icon-sm" /></span>
              </div>
            </div>
          </div>
          {SAMPLE_COLUMNS.filter((c) => SHOWN.includes(c.name)).map((col, i) => (
            <div key={col.id} className={`flex flex-col gap-3 rounded-frame bg-surface p-3 ${i > 0 ? "hidden lg:flex" : ""}`}>
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-page-title">{col.name}</h3>
                <BaseBadge tone="count">{f.perColumn.find((p) => p.name === col.name)?.count}</BaseBadge>
              </div>
              {SAMPLE_CARDS.filter((s) => s.card.column_id === col.id).map((s) => (
                <CardTile key={s.card.id} card={s.card} category={SAMPLE_CATEGORIES.find((c) => c.id === s.card.category_id)} dueState={s.card.due_state ?? null} draggable={false} />
              ))}
            </div>
          ))}
          <div className="hidden flex-col gap-2 rounded-frame bg-surface p-4 lg:flex">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-heading text-page-title">Workflow columns</h3>
              <BaseBadge tone="accent">{SAMPLE_COLUMNS.length} stages</BaseBadge>
            </div>
            {f.perColumn.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-field bg-surface-raised px-3 py-2 text-meta">
                <span>{p.name}</span>
                <span className="text-ink-muted">
                  {p.count} {p.count === 1 ? "task" : "tasks"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
