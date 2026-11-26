"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseLinkButton } from "@/components/shared/BaseLinkButton";
import { BaseDrawer } from "@/components/shared/BaseDrawer";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { routes } from "@/lib/routes";

export const ANCHORS = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#teams", label: "Teams" },
  { href: "#faq", label: "FAQ" },
] as const;

/** The sticky landing header; below 960 pixels a menu button opens a drawer with the same anchors and buttons (LAND-03). */
export function LandingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-header flex h-header items-center gap-2 bg-surface-raised px-page shadow-card lg:gap-4">
      <BaseButton variant="ghost" size="sm" className="size-touch lg:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu aria-hidden="true" />
      </BaseButton>
      <Link href="/" aria-label="RevoBoard home" className="inline-flex min-w-0">
        <BrandLogo variant="full" size="sm" decorative className="max-w-full" />
      </Link>
      <nav aria-label="Sections" className="hidden items-center gap-6 lg:ml-6 lg:flex">
        {ANCHORS.map((a) => (
          <a key={a.href} href={a.href} className="text-sm font-medium text-ink-muted no-underline hover:text-ink">
            {a.label}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex min-w-0 items-center gap-4">
        <a href={routes.login} className="hidden text-sm font-medium text-ink-muted no-underline hover:text-ink lg:inline">
          Sign in
        </a>
        <BaseLinkButton variant="dark" href={routes.register}>
          Get started
        </BaseLinkButton>
      </div>
      <BaseDrawer open={open} onClose={() => setOpen(false)} title="Menu">
        <nav aria-label="Menu" className="flex flex-col gap-1">
          {ANCHORS.map((a) => (
            <a key={a.href} href={a.href} onClick={() => setOpen(false)} className="flex min-h-touch items-center rounded-card px-3 text-sm font-medium text-ink no-underline hover:bg-surface-sunken">
              {a.label}
            </a>
          ))}
          <a href={routes.login} className="flex min-h-touch items-center rounded-card px-3 text-sm font-medium text-ink no-underline hover:bg-surface-sunken">
            Sign in
          </a>
        </nav>
      </BaseDrawer>
    </header>
  );
}
