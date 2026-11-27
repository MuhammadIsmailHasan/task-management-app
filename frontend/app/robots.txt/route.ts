import { publicBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = await publicBaseUrl();
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
