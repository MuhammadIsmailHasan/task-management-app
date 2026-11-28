import { ArrowRight, Check, History, ListChecks, LockKeyhole, Minus, RotateCcw, Tags, type LucideIcon } from "lucide-react";
import { CardTile } from "@/components/board/CardTile";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseLinkButton } from "@/components/shared/BaseLinkButton";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { RoleTag } from "@/components/shared/RoleTag";
import { asBadgeTone, columnTone, SOLID } from "@/lib/tones";
import type { Role } from "@/lib/types";
import { routes } from "@/lib/routes";
import { SAMPLE_CARDS, SAMPLE_CATEGORIES, SAMPLE_COLUMNS } from "@/lib/landing-sample";
import { ProductPreview } from "./ProductPreview";

const SECTION = "mx-auto flex max-w-site flex-col gap-section px-page py-surface";

function SectionHead({ eyebrow, title, line }: { eyebrow: string; title: string; line?: string }) {
  return (
    <div className="mx-auto flex max-w-copy flex-col items-center gap-label text-center">
      <span className="text-xs text-accent uppercase">{eyebrow}</span>
      <h2 className="font-heading text-page-title">{title}</h2>
      {line && <p className="text-sm text-ink-muted">{line}</p>}
    </div>
  );
}

export function Hero() {
  return (
    <section aria-label="Introduction" className={`${SECTION} items-center text-center`}>
      <h1 className="max-w-copy font-heading text-display">
        Your workflow, <span className="text-accent">organised.</span>
      </h1>
      <p className="max-w-copy text-sm text-ink-muted">Kanban boards with roles, subtasks, and private sharing.</p>
      <div className="flex flex-wrap justify-center gap-field">
        <BaseLinkButton href={routes.register}>
          Get started <ArrowRight aria-hidden="true" />
        </BaseLinkButton>
        <BaseLinkButton variant="secondary" href={routes.login}>
          Sign in
        </BaseLinkButton>
      </div>
      <div className="w-full">
        <ProductPreview />
      </div>
    </section>
  );
}

const FEATURES: { icon: LucideIcon; title: string; line: string }[] = [
  { icon: ListChecks, title: "Drag and drop", line: "Move cards between columns." },
  { icon: LockKeyhole, title: "Private boards", line: "Share by link or invite." },
  { icon: Tags, title: "Categories and search", line: "Find any card fast." },
  { icon: History, title: "Activity and reminders", line: "See every change; never miss a date." },
];

export function Features() {
  return (
    <section id="features" className={`scroll-mt-header ${SECTION}`}>
      <SectionHead eyebrow="Features" title="What you get" />
      <ul className="m-0 grid list-none grid-cols-1 gap-gutter p-0 md:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex flex-col gap-label rounded-ui bg-surface p-item">
            <span aria-hidden="true" className="inline-flex size-control items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
              <f.icon className="size-icon" />
            </span>
            <h3 className="font-heading text-base font-semibold">{f.title}</h3>
            <p className="text-sm text-ink-muted">{f.line}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STAGES: { name: string; line: string; who: string }[] = [
  { name: "Todo", line: "New cards wait here with a priority and a due date.", who: "Staff plan" },
  { name: "In Progress", line: "The assignee works through the subtasks.", who: "Assignee works" },
  { name: "Review", line: "Staff check the result.", who: "Staff check" },
  { name: "Revision", line: "Sent back with comments, then reviewed again.", who: "Assignee fixes" },
  { name: "Done", line: "Finished cards count toward on-time and cycle time.", who: "Counted in KPIs" },
];

export function Workflow() {
  return (
    <section id="workflow" className="scroll-mt-header bg-surface">
      <div className={SECTION}>
        <SectionHead eyebrow="Workflow" title="Five columns, one path" line="Drag a card from left to right. Reminders and the activity log follow it." />
        <div className="@container rounded-ui border border-line bg-surface-raised p-item shadow-float">
          <ol aria-label="Workflow steps" className="m-0 flex list-none snap-x snap-proximity gap-gutter overflow-x-auto p-0">
            {SAMPLE_COLUMNS.map((col, i) => {
              const stage = STAGES[i];
              const tone = columnTone(col.name, i);
              const cards = SAMPLE_CARDS.filter((s) => s.card.column_id === col.id);
              return (
                <li key={col.id} className="flex w-column shrink-0 snap-start flex-col gap-item rounded-ui bg-surface p-item xl:w-auto xl:min-w-0 xl:flex-1">
                  <header className="flex items-center gap-2">
                    <i aria-hidden="true" className={`inline-block size-dot-md shrink-0 rounded-full ${SOLID[tone]}`} />
                    <h3 className="min-w-0 truncate font-heading text-base font-semibold">{col.name}</h3>
                    <BaseBadge tone="count">{cards.length}</BaseBadge>
                  </header>
                  <p className="text-sm text-ink-muted">{stage.line}</p>
                  <BaseBadge tone={asBadgeTone(tone)} className="self-start">
                    {stage.who}
                  </BaseBadge>
                  <div aria-hidden="true" inert className="flex flex-col gap-gutter">
                    {cards.map((s) => (
                      <CardTile key={s.card.id} card={s.card} category={SAMPLE_CATEGORIES.find((c) => c.id === s.card.category_id)} dueState={s.card.due_state ?? null} done={col.name === "Done"} draggable={false} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="inline-flex items-center justify-center gap-2 text-center text-sm text-ink-muted">
          <RotateCcw aria-hidden="true" className="size-icon-sm shrink-0" />
          Revision loops back to Review until the work passes.
        </p>
      </div>
    </section>
  );
}

type Access = boolean | string;

const ABILITIES = ["Boards", "Move cards", "Comment", "Create boards", "Dashboard", "Users"] as const;

const ROLES: { role: Role | "guest"; title: string; access: Access[] }[] = [
  { role: "member", title: "Does the work", access: ["Joined", "Assigned", "Assigned", false, false, false] },
  { role: "supervisor", title: "Runs a board", access: ["Own", true, true, false, "Own", false] },
  { role: "manager", title: "Sees every board", access: ["All", true, true, true, true, false] },
  { role: "admin", title: "Runs the system", access: ["All", true, false, true, true, true] },
  { role: "guest", title: "Reads only", access: ["Public link", false, false, false, false, false] },
];

function AccessMark({ value }: { value: Access }) {
  if (typeof value === "string") return <BaseBadge>{value}</BaseBadge>;
  return value ? (
    <span className="inline-flex size-chip items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
      <Check aria-hidden="true" className="size-icon-sm" />
      <span className="sr-only">Yes</span>
    </span>
  ) : (
    <span className="inline-flex size-chip items-center justify-center text-ink-muted">
      <Minus aria-hidden="true" className="size-icon-sm" />
      <span className="sr-only">No</span>
    </span>
  );
}

export function Roles() {
  return (
    <section id="roles" className={`scroll-mt-header ${SECTION}`}>
      <SectionHead eyebrow="Roles" title="The right access for each person" line="Each person sees and changes only what their role allows." />
      <div className="flex flex-col gap-2">
        <div aria-hidden="true" className="hidden grid-cols-8 gap-3 px-item text-xs text-ink-muted uppercase lg:grid">
          <span className="col-span-2">Role</span>
          {ABILITIES.map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>
        <ul aria-label="Roles" className="m-0 flex list-none flex-col gap-2 p-0">
          {ROLES.map((r) => (
            <li key={r.role} className="grid grid-cols-2 items-center gap-3 rounded-ui bg-surface-raised p-item text-sm shadow-card lg:grid-cols-8">
              <span className="col-span-2 flex min-w-0 items-center gap-2">
                {r.role === "guest" ? (
                  <BaseBadge tone="slate" shape="tag" className="shrink-0">
                    Guest
                  </BaseBadge>
                ) : (
                  <RoleTag role={r.role} />
                )}
                <span className="font-semibold">{r.title}</span>
              </span>
              {r.access.map((value, i) => (
                <span key={ABILITIES[i]} className="flex items-center justify-between gap-2 lg:justify-start">
                  <span className="text-ink-muted lg:hidden">{ABILITIES[i]}</span>
                  <AccessMark value={value} />
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section aria-label="Get started" className={SECTION}>
      <div className="flex flex-wrap items-center justify-between gap-field rounded-ui bg-gradient-cta p-surface text-on-brand">
        <h2 className="font-heading text-page-title">Ready to organise your team?</h2>
        <BaseLinkButton variant="secondary" href={routes.register}>
          Get started
        </BaseLinkButton>
      </div>
    </section>
  );
}

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-surface">
      <div className="mx-auto flex max-w-site flex-wrap items-center justify-between gap-field px-page py-surface text-sm text-ink-muted">
        <BrandLogo variant="full" size="sm" />
        <nav aria-label="Account" className="flex gap-field">
          <a href={routes.login}>Sign in</a>
          <a href={routes.register}>Create account</a>
        </nav>
        <p>© {year} RevoBoard</p>
      </div>
    </footer>
  );
}
