import type { ReactNode } from "react";
import { BrandLogo } from "@/components/shared/BrandLogo";

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-page">
      <div className="grid w-full max-w-site grid-cols-1 overflow-hidden rounded-ui bg-surface-raised shadow-card lg:grid-cols-2">
        <aside className="flex flex-col gap-label bg-gradient-brand p-surface text-on-brand lg:min-h-auth-card lg:justify-end">
          <h2 className="max-w-auth font-heading text-page-title">Work in flow, scale with clarity.</h2>
          <p className="max-w-auth text-sm text-on-brand-muted">Boards, cards, and comments in one calm place.</p>
        </aside>
        <section className="flex flex-col justify-center p-surface">
          <div className="mx-auto flex w-full max-w-auth flex-col items-start gap-section">
            <BrandLogo variant="full" size="md" />
            <div className="flex w-full flex-col">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
