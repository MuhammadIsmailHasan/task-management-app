import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { ClosingCta, Features, Hero, LandingFooter, Roles, Workflow } from "@/components/landing/sections";
import { SkipLink } from "@/components/shell/SkipLink";

export const dynamic = "force-dynamic";

const DESCRIPTION = "RevoBoard: kanban boards with drag and drop, subtasks, roles, private boards, and share links.";

export async function generateMetadata(): Promise<Metadata> {
  // The landing page reads no header, cookie, or storage (LAND-01): the canonical URL comes from the environment only.
  const base = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  return {
    title: { absolute: "RevoBoard" },
    description: DESCRIPTION,
    ...(base && { alternates: { canonical: `${base}/` } }),
    openGraph: { title: "RevoBoard", description: DESCRIPTION, type: "website", siteName: "RevoBoard", ...(base && { url: `${base}/` }) },
    robots: { index: true, follow: true },
  };
}

/** The landing page (Requirement 41): served at `/`, the same origin as the app under `/app`. */
export default function LandingPage() {
  return (
    <>
      <SkipLink />
      <LandingHeader />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <Features />
        <Workflow />
        <Roles />
        <ClosingCta />
      </main>
      <LandingFooter />
    </>
  );
}
