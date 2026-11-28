import { ArrowRight, Check, CircleCheck, Eye, History, LayoutDashboard, ListChecks, ListTodo, LockKeyhole, RotateCcw, SearchCheck, ShieldCheck, Tags, Timer, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseLinkButton } from "@/components/shared/BaseLinkButton";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { RoleTag } from "@/components/shared/RoleTag";
import { asBadgeTone, columnTone, SOLID } from "@/lib/tones";
import type { Role } from "@/lib/types";
import { routes } from "@/lib/routes";
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

const STAGES: { name: string; icon: LucideIcon; line: string; who: string }[] = [
  { name: "Todo", icon: ListTodo, line: "Every new card starts here, with a priority and a due date.", who: "Staff plan" },
  { name: "In Progress", icon: Timer, line: "The assignee picks it up and works through its subtasks.", who: "Assignee works" },
  { name: "Review", icon: SearchCheck, line: "Ready for a check by the board's staff.", who: "Staff check" },
  { name: "Revision", icon: RotateCcw, line: "Sent back with comments, then reviewed again.", who: "Assignee fixes" },
  { name: "Done", icon: CircleCheck, line: "Finished. The date counts toward on-time and cycle time.", who: "Counted in KPIs" },
];

export function Workflow() {
  return (
    <section id="workflow" className="scroll-mt-header bg-surface">
      <div className={SECTION}>
        <SectionHead eyebrow="Workflow" title="Five columns, one path" line="Drag a card from left to right. Reminders and the activity log follow it." />
        <ol aria-label="Workflow steps" className="m-0 grid list-none grid-cols-1 gap-gutter p-0 md:grid-cols-2 lg:grid-cols-5">
          {STAGES.map((s, i) => {
            const tone = columnTone(s.name, i);
            const last = i === STAGES.length - 1;
            return (
              <li key={s.name} className="flex flex-col gap-label overflow-hidden rounded-ui bg-surface-raised shadow-card">
                <i aria-hidden="true" className={`h-progress w-full ${SOLID[tone]}`} />
                <div className="flex flex-col gap-label px-item pb-item">
                  <div className="flex items-center justify-between gap-2">
                    <span aria-hidden="true" className="inline-flex size-control items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
                      <s.icon className="size-icon" />
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                      Step {i + 1}
                      {!last && <ArrowRight aria-hidden="true" className="size-icon-sm" />}
                    </span>
                  </div>
                  <h3 className="inline-flex items-center gap-2 font-heading text-base font-semibold">
                    <i aria-hidden="true" className={`size-dot-md shrink-0 rounded-full ${SOLID[tone]}`} />
                    {s.name}
                  </h3>
                  <p className="text-sm text-ink-muted">{s.line}</p>
                  <BaseBadge tone={asBadgeTone(tone)} className="self-start">
                    {s.who}
                  </BaseBadge>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="inline-flex items-center justify-center gap-2 text-center text-sm text-ink-muted">
          <RotateCcw aria-hidden="true" className="size-icon-sm shrink-0" />
          Revision loops back to Review until the work passes.
        </p>
      </div>
    </section>
  );
}

const ROLES: { role: Role | "guest"; icon: LucideIcon; title: string; can: string[] }[] = [
  { role: "member", icon: UserRound, title: "Does the work", can: ["Moves and updates the cards assigned to them", "Adds subtasks, files, and comments", "Sees My tasks and their own performance"] },
  { role: "supervisor", icon: UsersRound, title: "Runs a board", can: ["Owns boards and invites members", "Assigns cards, dates, and categories", "Reads the Dashboard of their boards"] },
  { role: "manager", icon: LayoutDashboard, title: "Sees every board", can: ["Creates boards and columns", "Manages any board and its people", "Compares team performance across boards"] },
  { role: "admin", icon: ShieldCheck, title: "Runs the system", can: ["Manages users, roles, and access", "Reads the Dashboard of every board", "Stays out of cards and comments"] },
  { role: "guest", icon: Eye, title: "Reads only", can: ["Opens a board through a public link", "Needs no account", "Cannot change anything"] },
];

export function Roles() {
  return (
    <section id="roles" className={`scroll-mt-header ${SECTION}`}>
      <SectionHead eyebrow="Roles" title="The right access for each person" line="Each person sees and changes only what their role allows." />
      <ul aria-label="Roles" className="m-0 grid list-none grid-cols-1 gap-gutter p-0 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ROLES.map((r) => (
          <li key={r.role} className="flex flex-col gap-label rounded-ui border border-line bg-surface-raised p-item shadow-card">
            <div className="flex items-center justify-between gap-2">
              <span aria-hidden="true" className="inline-flex size-control items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
                <r.icon className="size-icon" />
              </span>
              {r.role === "guest" ? (
                <BaseBadge tone="slate" shape="tag" className="shrink-0">
                  Guest
                </BaseBadge>
              ) : (
                <RoleTag role={r.role} />
              )}
            </div>
            <h3 className="font-heading text-base font-semibold">{r.title}</h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {r.can.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-ink-muted">
                  <Check aria-hidden="true" className="mt-half size-icon-sm shrink-0 text-accent" />
                  {line}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
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
