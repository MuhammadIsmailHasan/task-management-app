import { BaseLinkButton } from "@/components/shared/BaseLinkButton";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { routes } from "@/lib/routes";

export function NotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface p-6 text-center">
      <BrandLogo variant="full" size="md" />
      <div className="flex w-full max-w-modal flex-col items-center gap-6 rounded-ui bg-surface-raised p-surface shadow-card">
        <svg role="img" aria-label="Error 404" viewBox="0 0 240 96" className="w-full max-w-popover">
          <rect x="0" y="0" width="240" height="96" rx="24" className="fill-accent-tint" />
          <text x="120" y="68" textAnchor="middle" className="fill-brand font-heading text-display" fontWeight="800">
            404
          </text>
          <circle cx="36" cy="24" r="6" className="fill-accent" />
          <circle cx="204" cy="72" r="9" className="fill-brand" opacity="0.2" />
        </svg>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-xl">Page not found</h1>
          <p className="text-sm text-ink-muted">The page may have moved, or the link is old.</p>
        </div>
        <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <BaseLinkButton variant="dark" href={routes.boards} className="justify-center">
            Go to boards
          </BaseLinkButton>
          <BaseLinkButton variant="secondary" href={routes.landing} className="justify-center">
            Go home
          </BaseLinkButton>
        </div>
      </div>
    </main>
  );
}
