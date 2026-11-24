import { headers } from "next/headers";
import { resolveHost } from "@/lib/host";
import { readOrigins } from "@/lib/origins";

export const dynamic = "force-dynamic";

/** The Site_Host lists `/` only; the App_Host has no sitemap (LAND-14). */
export async function GET() {
  const { siteUrl } = readOrigins();
  const h = await headers();
  const site = resolveHost({ host: h.get("host"), forwardedHost: h.get("x-forwarded-host") }, siteUrl) === "site";
  if (!site) return new Response("Not found", { status: 404 });
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}/</loc></url></urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
