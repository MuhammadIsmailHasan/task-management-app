import type { ReactNode } from "react";
import { BrandLogo } from "@/components/shared/BrandLogo";

/**
 * Server Component: one auth card on the canvas, built from the app's scale (round 5): the one radius, the surface
 * padding, h2 `page-title`, body `sm`. A brand panel beside the form from 960 pixels; a band above it below 960 pixels.
 */
export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-page">
      <div className="grid w-full max-w-site grid-cols-1 overflow-hidden rounded-ui bg-surface-raised shadow-card lg:grid-cols-2">
        <aside className="flex flex-col gap-label bg-gradient-brand p-surface text-on-brand lg:min-h-auth-card lg:justify-end">
          <h2 className="max-w-auth font-heading text-page-title">Work in flow, scale with clarity.</h2>
          <p className="max-w-auth text-sm text-on-brand-muted">Boards, cards, and comments in one calm place.</p>
        </aside>
        <section className="flex flex-col justify-center p-surface">
          {/* one column, left-aligned: the logo, the switch, the title, and the form share the same edge */}
          <div className="mx-auto flex w-full max-w-auth flex-col items-start gap-section">
            {/* The logo files are transparent and the wordmark is dark, so it sits on the white side, never on the brand panel (FIX-01). */}
            <BrandLogo variant="full" size="md" />
            <div className="flex w-full flex-col">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
