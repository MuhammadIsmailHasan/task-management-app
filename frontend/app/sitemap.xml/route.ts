import { publicBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The sitemap lists the Landing_Page only; no `/app` URL (PATH-07). */
export async function GET() {
  const base = await publicBaseUrl();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url></urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
