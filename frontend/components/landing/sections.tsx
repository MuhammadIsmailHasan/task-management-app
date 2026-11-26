import { ArrowRight, History, LockKeyhole, ListChecks, Tags, type LucideIcon } from "lucide-react";
import { BaseLinkButton } from "@/components/shared/BaseLinkButton";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { routes } from "@/lib/routes";
import { ProductPreview } from "./ProductPreview";

/**
 * The landing page uses the app's own scale (DS-18, DS-19, DS-22, DS-24): one radius, the surface and item paddings,
 * h1 `display` for the hero only, h2 `page-title`, h3 `base`, body `sm`. Short copy: one line per idea (round 5).
 */
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

const STAGES = ["Todo", "In Progress", "Review", "Revision", "Done"] as const;

export function Workflow() {
  return (
    <section id="workflow" className="scroll-mt-header bg-surface">
      <div className={SECTION}>
        <SectionHead eyebrow="Workflow" title="Five columns, one path" />
        <ol className="m-0 flex list-none flex-wrap justify-center gap-label p-0">
          {STAGES.map((name, i) => (
            <li key={name} className="inline-flex min-h-control items-center gap-label rounded-ui bg-surface-raised px-4 text-sm shadow-card">
              <span className="text-xs text-ink-muted">{i + 1}</span>
              {name}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const ROLES = ["Member", "Supervisor", "Manager", "Admin", "Guest"] as const;

export function Roles() {
  return (
    <section id="roles" className={`scroll-mt-header ${SECTION}`}>
      <SectionHead eyebrow="Roles" title="The right access for each person" line="Guests read a board through a public link." />
      <ul className="m-0 flex list-none flex-wrap justify-center gap-label p-0">
        {ROLES.map((r) => (
          <li key={r} className="inline-flex min-h-control items-center rounded-ui bg-surface px-4 text-sm">
            {r}
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
