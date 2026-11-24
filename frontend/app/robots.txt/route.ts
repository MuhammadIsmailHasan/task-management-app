import { headers } from "next/headers";
import { resolveHost } from "@/lib/host";
import { readOrigins } from "@/lib/origins";

export const dynamic = "force-dynamic";

/** The Site_Host allows everything and names the sitemap; the App_Host disallows everything (LAND-14). */
export async function GET() {
  const { siteUrl } = readOrigins();
  const h = await headers();
  const site = resolveHost({ host: h.get("host"), forwardedHost: h.get("x-forwarded-host") }, siteUrl) === "site";
  const body = site ? `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
