import { headers } from "next/headers";

/** The public origin of the site: `PUBLIC_BASE_URL` when set, else the request's own host (never a path). */
export async function publicBaseUrl(): Promise<string> {
  const configured = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
