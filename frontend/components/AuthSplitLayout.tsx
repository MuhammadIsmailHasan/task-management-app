import type { ReactNode } from "react";
import { BrandLogo } from "@/components/shared/BrandLogo";

/** Server Component: one auth card on the canvas (the same canvas, surface, radius, and shadow as the app frame, FIX-02), a brand panel beside the form (a compact band below 960 pixels). SCR-04. */
export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4 lg:p-8">
      <div className="grid w-full max-w-site grid-cols-1 overflow-hidden rounded-frame bg-surface-raised shadow-card lg:grid-cols-2">
        <aside className="relative flex flex-col gap-6 bg-gradient-brand p-6 text-on-brand lg:min-h-auth-card lg:justify-center lg:gap-0 lg:p-12">
          <h2 className="max-w-auth font-heading text-display">Work in flow, scale with clarity.</h2>
          <p className="max-w-auth text-sm text-on-brand-muted lg:mt-auto lg:border-t lg:border-on-brand-soft lg:pt-6">Boards, cards, and comments in one calm place, from your phone to your desk.</p>
        </aside>
        <section className="flex flex-col justify-center p-6 lg:p-12">
          {/* The logo files are transparent and the wordmark is dark, so it sits on the white side, never on the brand panel (FIX-01). */}
          <BrandLogo variant="full" size="lg" className="mb-8" />
          {children}
        </section>
      </div>
    </main>
  );
}
