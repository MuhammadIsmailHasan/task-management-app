import type { Metadata } from "next";
import { NotFound } from "@/components/shared/NotFound";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

/** Every unknown path and every `notFound()` call (Requirement 48): HTTP 404, noindex, one h1. */
export default function NotFoundPage() {
  return <NotFound />;
}
