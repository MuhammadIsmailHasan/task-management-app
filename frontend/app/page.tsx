import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { ClosingCta, Features, Hero, LandingFooter, Roles, Workflow } from "@/components/landing/sections";
import { SkipLink } from "@/components/shell/SkipLink";

export const dynamic = "force-dynamic";

const DESCRIPTION = "RevoBoard: kanban boards with drag and drop, subtasks, roles, private boards, and share links.";

export async function generateMetadata(): Promise<Metadata> {
  const base = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  return {
    title: { absolute: "RevoBoard" },
    description: DESCRIPTION,
    ...(base && { alternates: { canonical: `${base}/` } }),
    openGraph: { title: "RevoBoard", description: DESCRIPTION, type: "website", siteName: "RevoBoard", ...(base && { url: `${base}/` }) },
    robots: { index: true, follow: true },
  };
}

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
