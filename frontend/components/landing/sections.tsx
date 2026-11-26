import { ArrowRight, History, KeyRound, Link2, ListChecks, LockKeyhole, Rocket, Tags, UserCog, UsersRound, type LucideIcon } from "lucide-react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseLinkButton } from "@/components/shared/BaseLinkButton";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ProductPreview } from "./ProductPreview";

const eyebrow = "text-2xs text-accent uppercase";

function SectionHead({ eyebrowText, title, children }: { eyebrowText: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-copy flex-col items-center gap-3 text-center">
      <span className={eyebrow}>{eyebrowText}</span>
      <h2 className="font-heading text-xl">{title}</h2>
      {children && <p className="text-base text-ink-muted">{children}</p>}
    </div>
  );
}

/** Announcement bar, hero, and product preview (LAND-05, LAND-06). */
export function Hero() {
  return (
    <>
      <div className="flex min-h-control flex-wrap items-center justify-center gap-3 bg-brand px-page py-2 text-sm text-on-brand">
        <BaseBadge tone="accent">RevoBoard</BaseBadge>
        <span>Drag-and-drop boards with roles, share links, and join requests.</span>
        <a href={routes.register} className="inline-flex items-center gap-1 font-semibold text-accent-tint no-underline">
          Get started <ArrowRight className="size-icon-sm" aria-hidden="true" />
        </a>
      </div>
      <section aria-label="Introduction" className="mx-auto flex max-w-site flex-col items-center gap-8 px-page py-12 text-center">
        <h1 className="font-heading text-display">
          Your workflow, your way. <span className="block text-accent lg:inline">Master tasks effortlessly.</span>
        </h1>
        <BaseLinkButton variant="dark" size="lg" href={routes.register}>
          Get started <ArrowRight aria-hidden="true" />
        </BaseLinkButton>
        <div className="w-full">
          <ProductPreview />
        </div>
      </section>
    </>
  );
}

const FEATURES: { icon: LucideIcon; tile: string; title: string; copy: string; link: string }[] = [
  { icon: ListChecks, tile: "bg-accent-tint text-on-accent-tint", title: "Drag and drop", copy: "Move cards across five columns: Todo, In Progress, Review, Revision, and Done. The position is kept after a refresh.", link: "Five-column board" },
  { icon: LockKeyhole, tile: "bg-brand text-on-brand", title: "Private boards, shared on your terms", copy: "Every board is private. Share a read-only public link, or an invite link whose join requests you approve.", link: "Controlled access" },
  { icon: ListChecks, tile: "bg-surface-sunken text-ink", title: "Subtasks with automatic progress", copy: "A card's checklist sets its progress, so the bar always matches the work that is done.", link: "Derived progress" },
  { icon: UsersRound, tile: "bg-accent-tint text-on-accent-tint", title: "Roles, comments, and activity", copy: "Threaded comments, priority comments, and a log of every move, edit, and comment.", link: "Clear history" },
  { icon: Tags, tile: "bg-surface-sunken text-ink", title: "Categories and filters", copy: "Give each board its own categories and filter the cards by category or search.", link: "Find work fast" },
  { icon: History, tile: "bg-brand text-on-brand", title: "Assignment and deadline notifications", copy: "Assignees are told when a card is assigned and when its end date arrives.", link: "Nothing slips" },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-header mx-auto flex max-w-site flex-col gap-8 px-page py-12">
      <SectionHead eyebrowText="What you get" title="Everything a team needs to run a board">Boards, cards, and the controls around them, built for fast work with clear permissions.</SectionHead>
      <ul className="m-0 grid list-none grid-cols-1 gap-gutter p-0 lg:grid-cols-2 xl:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex flex-col gap-4 rounded-frame bg-surface p-6">
            <span aria-hidden="true" className={cn("inline-flex size-tile items-center justify-center rounded-card", f.tile)}>
              <f.icon className="size-icon-lg" />
            </span>
            <h3 className="font-heading text-page-title">{f.title}</h3>
            <p className="text-sm text-ink-muted">{f.copy}</p>
            <p className="mt-auto flex items-center gap-1 border-t border-line pt-3 text-meta text-accent">
              {f.link} <ArrowRight className="size-icon-sm" aria-hidden="true" />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STAGES = [
  ["Todo", "Planned work"],
  ["In Progress", "Being worked on"],
  ["Review", "Waiting for a check"],
  ["Revision", "Changes requested"],
  ["Done", "Finished"],
] as const;

export function Workflow() {
  return (
    <section id="workflow" className="scroll-mt-header bg-surface">
      <div className="mx-auto flex max-w-site flex-col gap-8 px-page py-12">
        <SectionHead eyebrowText="Workflow" title="Five columns, one clear path">Every board starts with the same five columns.</SectionHead>
        <ol className="m-0 grid list-none grid-cols-1 gap-gutter p-0 lg:grid-cols-5">
          {STAGES.map(([name, line], i) => (
            <li key={name} className="flex flex-col gap-2 rounded-card bg-surface-raised p-4 shadow-card">
              <span className="inline-flex size-control-sm items-center justify-center rounded-full bg-accent-tint text-xs text-on-accent-tint">{i + 1}</span>
              <h3 className="font-heading text-page-title">{name}</h3>
              <p className="text-sm text-ink-muted">{line}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Teams() {
  return (
    <section id="teams" className="scroll-mt-header mx-auto grid max-w-site grid-cols-1 items-center gap-8 px-page py-12 lg:grid-cols-2">
      <div aria-hidden="true" inert className="flex flex-col gap-3 rounded-frame bg-surface-raised p-6 shadow-card">
        <h3 className="font-heading text-page-title">Join requests</h3>
        {["Elena R.", "Devon K."].map((n) => (
          <div key={n} className="flex items-center gap-3 rounded-card bg-surface p-3 text-sm">
            <span className="inline-flex size-control-sm items-center justify-center rounded-full bg-brand text-2xs text-on-brand">{n.slice(0, 2).toUpperCase()}</span>
            <span className="flex-1">{n} asked to join</span>
            <BaseBadge tone="accent">Approve</BaseBadge>
            <BaseBadge tone="danger">Reject</BaseBadge>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <span className={eyebrow}>Secure team workflows</span>
        <h2 className="font-heading text-xl">Private by default. Share when you need to.</h2>
        <p className="text-base text-ink-muted">Every board is private to its owner and members. When someone else needs in, you choose how.</p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
          {[
            [Link2, "A public link shows the board read-only, without comments and activity."],
            [KeyRound, "An invite link sends a join request that the board's owner, a Manager, or an Admin approves or rejects."],
            [History, "Every card move, edit, and comment is recorded in an activity log."],
          ].map(([Icon, text]) => {
            const I = Icon as LucideIcon;
            return (
              <li key={text as string} className="flex items-start gap-3 rounded-card bg-surface p-4">
                <I className="mt-half size-icon shrink-0 text-accent" aria-hidden="true" />
                {text as string}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const ROLES = [
  { name: "Member", line: "Moves and edits cards and comments." },
  { name: "Supervisor", line: "Also creates, assigns, archives, and deletes cards, manages categories, and sees analytics for their board." },
  { name: "Manager", line: "Also sees analytics across all boards, creates boards, and flags priority comments." },
  { name: "Admin", line: "Manages user accounts." },
  { name: "Guest", line: "Reads a board through a public link." },
] as const;

export function Roles() {
  return (
    <section id="roles" className="scroll-mt-header bg-surface">
      <div className="mx-auto flex max-w-site flex-col gap-8 px-page py-12">
        <SectionHead eyebrowText="Roles" title="The right access for each person" />
        <ul className="m-0 grid list-none grid-cols-1 gap-gutter p-0 lg:grid-cols-5">
          {ROLES.map((r) => (
            <li key={r.name} className="flex flex-col gap-2 rounded-card bg-surface-raised p-4 shadow-card">
              <span className="inline-flex items-center gap-2 font-heading text-page-title">
                <UserCog className="size-icon text-accent" aria-hidden="true" />
                {r.name}
              </span>
              <p className="text-sm text-ink-muted">{r.line}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const QUESTIONS = [
  ["Which columns does a board have?", "Every board starts with five columns: Todo, In Progress, Review, Revision, and Done. Supervisors and managers can add more. Cards move between them by drag and drop."],
  ["How do private boards and join requests work?", "A board is private to its owner and its members. The owner, a Manager, or an Admin can create an invite link; a person who opens it sends a join request, which one of them approves or rejects."],
  ["How is a card's progress calculated?", "A card can hold subtasks. As subtasks are checked off, the card's progress is derived from how many are done, and the bar updates at once."],
  ["Which roles exist?", "Member, Supervisor, Manager, and Admin, plus read-only guests who open a public link. Each role adds to the one before it, except Admin, which manages user accounts."],
] as const;

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-header mx-auto flex max-w-site flex-col gap-8 px-page py-12">
      <SectionHead eyebrowText="Answers" title="Frequently asked questions" />
      <div className="mx-auto flex w-full max-w-copy flex-col gap-3">
        {QUESTIONS.map(([q, a]) => (
          <details key={q} className="group rounded-card border border-line bg-surface-raised p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
              {q}
              <ArrowRight className="size-icon shrink-0 transition-transform duration-fast group-open:rotate-90" aria-hidden="true" />
            </summary>
            <p className="mt-3 text-sm text-ink-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <>
      <section aria-label="Get started" className="mx-auto max-w-site px-page py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-gradient-cta p-8 text-on-brand shadow-popover">
          <h2 className="font-heading text-xl">Ready to organize your team?</h2>
          <a href={routes.register} className="inline-flex min-h-button items-center rounded-full bg-accent-tint px-6 py-2 text-sm font-medium text-on-accent-tint no-underline">
            Get started
          </a>
        </div>
      </section>
      <section aria-label="Start now" className="mx-auto flex max-w-site flex-col items-center gap-4 px-page py-12 text-center">
        <span aria-hidden="true" className="inline-flex size-logo-lg items-center justify-center rounded-full bg-accent-tint text-on-accent-tint">
          <Rocket className="size-icon-lg" />
        </span>
        <h2 className="font-heading text-xl">Ready to master your workflow?</h2>
        <p className="text-base text-ink-muted">Create an account and open your first board in a minute.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <BaseLinkButton variant="dark" size="lg" href={routes.register}>
            Get started
          </BaseLinkButton>
          <BaseLinkButton variant="secondary" size="lg" href={routes.login}>
            Sign in
          </BaseLinkButton>
        </div>
      </section>
    </>
  );
}

export function LandingFooter() {
  const year = new Date().getFullYear();
  const col = "m-0 flex list-none flex-col gap-2 p-0 text-sm";
  return (
    <footer className="bg-surface">
      <div className="mx-auto grid max-w-site grid-cols-1 gap-8 px-page py-12 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <BrandLogo variant="full" size="sm" />
          <p className="max-w-copy text-sm text-ink-muted">Kanban boards for teams that want clear roles and simple sharing.</p>
        </div>
        <nav aria-label="Product">
          <h3 className="mb-3 text-2xs text-ink-muted uppercase">Product</h3>
          <ul className={col}>
            <li><a href="#features">Features</a></li>
            <li><a href="#workflow">Workflow</a></li>
            <li><a href="#teams">Teams</a></li>
          </ul>
        </nav>
        <nav aria-label="Roles">
          <h3 className="mb-3 text-2xs text-ink-muted uppercase">Roles</h3>
          <ul className={col}>
            <li><a href="#roles">Member and Supervisor</a></li>
            <li><a href="#roles">Manager and Admin</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </nav>
        <nav aria-label="Account">
          <h3 className="mb-3 text-2xs text-ink-muted uppercase">Account</h3>
          <ul className={col}>
            <li><a href={routes.login}>Sign in</a></li>
            <li><a href={routes.register}>Create account</a></li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-site px-page pb-8 text-sm text-ink-muted">© {year} RevoBoard</p>
    </footer>
  );
}
