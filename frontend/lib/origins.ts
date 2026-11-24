/** The Site_Host and App_Host origins (Requirement 42, HOST-06 and HOST-07): read on every call, never inlined into the build. */
export interface Origins {
  siteUrl: string | null;
  appUrl: string | null;
}

function origin(name: string, value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be an absolute origin such as https://example.com (got "${raw}")`);
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== raw.replace(/\/+$/, "")) {
    throw new Error(`${name} must be an origin with a scheme, a host, and no path (got "${raw}")`);
  }
  return url.origin;
}

/** Both variables or neither: one without the other stops the Frontend with a clear message. */
export function readOrigins(env: Record<string, string | undefined> = process.env): Origins {
  const siteUrl = origin("SITE_URL", env.SITE_URL);
  const appUrl = origin("APP_URL", env.APP_URL);
  if ((siteUrl === null) !== (appUrl === null)) throw new Error("SITE_URL and APP_URL must be set together or not at all");
  return { siteUrl, appUrl };
}
