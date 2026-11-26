import { publicBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * `/app` is not disallowed on purpose: a disallowed page is never fetched, so its `X-Robots-Tag: noindex` header
 * would never be read (Open Question 67). The sitemap lists `/` only.
 */
export async function GET() {
  const base = await publicBaseUrl();
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
