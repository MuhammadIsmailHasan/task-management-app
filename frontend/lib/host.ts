/** Which host a request is for and what to do with it (Requirement 42, HOST-02 and HOST-03): a pure function, so it can be tested without a server. */
export type HostKind = "site" | "app";

export type RouteResult =
  | { kind: "next" }
  | { kind: "rewrite"; path: string }
  | { kind: "redirect"; status: 308; url: string }
  | { kind: "notFound" };

const HOSTNAME = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

/** The hostname of a Host header: lower case, without the port and a trailing dot; null when absent or malformed. */
export function hostnameOf(value: string | null | undefined): string | null {
  const first = value?.split(",")[0]?.trim().toLowerCase();
  if (!first) return null;
  const bare = first.startsWith("[") ? null : first.replace(/:\d+$/, "").replace(/\.$/, "");
  return bare && HOSTNAME.test(bare) ? bare : null;
}

/** The Site_Host only when the host matches `SITE_URL`; absent, malformed, or other hosts are the App_Host. */
export function resolveHost(headers: { host?: string | null; forwardedHost?: string | null }, siteUrl: string | null): HostKind {
  if (!siteUrl) return "app";
  const host = hostnameOf(headers.forwardedHost) ?? hostnameOf(headers.host);
  return host !== null && host === new URL(siteUrl).hostname ? "site" : "app";
}

const SITE_PASS = [/^\/robots\.txt$/, /^\/sitemap\.xml$/, /^\/favicon\.ico$/, /^\/brand\//, /^\/_next\//];

export interface RouteInput {
  host?: string | null;
  forwardedHost?: string | null;
  pathname: string;
  search: string;
}

export interface RouteConfig {
  siteUrl: string | null;
  appUrl: string | null;
  nodeEnv: string | undefined;
}

export function routeRequest(req: RouteInput, cfg: RouteConfig): RouteResult {
  const kind = resolveHost(req, cfg.siteUrl);
  const { pathname, search } = req;
  if (pathname === "/site") {
    // The internal path is public only for local preview while no Site_Host exists (HOST-05).
    return cfg.siteUrl === null && cfg.nodeEnv !== "production" ? { kind: "next" } : { kind: "notFound" };
  }
  if (kind === "site") {
    if (pathname === "/") return { kind: "rewrite", path: "/site" };
    if (SITE_PASS.some((re) => re.test(pathname))) return { kind: "next" };
    // Never copy the request host into a redirect: the target comes from APP_URL (HOST-03).
    return { kind: "redirect", status: 308, url: `${cfg.appUrl ?? ""}${pathname}${search}` };
  }
  return { kind: "next" };
}
