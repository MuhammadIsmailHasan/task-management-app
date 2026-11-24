import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { ClosingCta, Faq, Features, Hero, LandingFooter, Roles, Teams, Workflow } from "@/components/landing/sections";
import { SkipLink } from "@/components/shell/SkipLink";
import { readOrigins } from "@/lib/origins";

export const dynamic = "force-dynamic";

const DESCRIPTION = "RevoBoard: kanban boards with drag and drop, subtasks, roles, private boards, and share links.";

export async function generateMetadata(): Promise<Metadata> {
  const { siteUrl } = readOrigins();
  return {
    title: { absolute: "RevoBoard" },
    description: DESCRIPTION,
    ...(siteUrl && { alternates: { canonical: `${siteUrl}/` } }),
    openGraph: { title: "RevoBoard", description: DESCRIPTION, type: "website", siteName: "RevoBoard", ...(siteUrl && { url: `${siteUrl}/` }) },
    robots: { index: true, follow: true },
  };
}

/** The landing page (Requirement 41): served at `/` on the Site_Host through a rewrite of `proxy.ts`. */
export default function LandingPage() {
  const { appUrl } = readOrigins();
  const app = appUrl ?? "";
  return (
    <>
      <SkipLink />
      <LandingHeader appUrl={app} />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <Hero appUrl={app} />
        <Features />
        <Workflow />
        <Teams />
        <Roles />
        <Faq />
        <ClosingCta appUrl={app} />
      </main>
      <LandingFooter appUrl={app} />
    </>
  );
}
