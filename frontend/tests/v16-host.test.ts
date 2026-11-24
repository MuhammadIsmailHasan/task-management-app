import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { hostnameOf, resolveHost, routeRequest, type RouteConfig } from "@/lib/host";
import { readOrigins } from "@/lib/origins";

const cfg: RouteConfig = { siteUrl: "https://revoboard.example", appUrl: "https://app.revoboard.example", nodeEnv: "production" };
const req = (host: string, pathname: string, search = "", forwardedHost?: string) => ({ host, forwardedHost, pathname, search });

describe("host routing (Requirement 42, Property 64)", () => {
  it("serves the landing page at / on the Site_Host through a rewrite", () => {
    expect(routeRequest(req("revoboard.example", "/"), cfg)).toEqual({ kind: "rewrite", path: "/site" });
  });

  it("lets the Site_Host serve its own assets and robots files", () => {
    for (const p of ["/robots.txt", "/sitemap.xml", "/favicon.ico", "/brand/logo-revo.svg", "/_next/static/x.js"]) expect(routeRequest(req("revoboard.example", p), cfg)).toEqual({ kind: "next" });
  });

  it("sends every other Site_Host path to the App_Host with the same path and query", () => {
    expect(routeRequest(req("revoboard.example", "/boards/abc", "?x=1"), cfg)).toEqual({ kind: "redirect", status: 308, url: "https://app.revoboard.example/boards/abc?x=1" });
    expect(routeRequest(req("revoboard.example", "/login"), cfg)).toMatchObject({ url: "https://app.revoboard.example/login" });
  });

  it("hides /site on both hosts when a Site_Host exists", () => {
    expect(routeRequest(req("revoboard.example", "/site"), cfg).kind).toBe("notFound");
    expect(routeRequest(req("app.revoboard.example", "/site"), cfg).kind).toBe("notFound");
  });

  it("treats every host as the App_Host while SITE_URL is unset, and allows /site only outside production", () => {
    const none: RouteConfig = { siteUrl: null, appUrl: null, nodeEnv: "production" };
    expect(routeRequest(req("203.0.113.5:8082", "/boards"), none)).toEqual({ kind: "next" });
    expect(routeRequest(req("localhost:3000", "/site"), none).kind).toBe("notFound");
    expect(routeRequest(req("localhost:3000", "/site"), { ...none, nodeEnv: "development" }).kind).toBe("next");
  });

  it("ignores the port, the case, and a trailing dot of the host", () => {
    expect(hostnameOf("Revoboard.Example.:8082")).toBe("revoboard.example");
    expect(resolveHost({ host: "REVOBOARD.EXAMPLE:443" }, cfg.siteUrl)).toBe("site");
  });

  it("prefers x-forwarded-host, takes the first of a list, and falls back on a malformed one", () => {
    expect(resolveHost({ host: "127.0.0.1:3000", forwardedHost: "revoboard.example" }, cfg.siteUrl)).toBe("site");
    expect(resolveHost({ host: "x", forwardedHost: "revoboard.example, other.test" }, cfg.siteUrl)).toBe("site");
    expect(resolveHost({ host: "revoboard.example", forwardedHost: "bad host!" }, cfg.siteUrl)).toBe("site"); // malformed forwarded value: the Host header decides
    expect(resolveHost({ host: "bad host!" }, cfg.siteUrl)).toBe("app");
  });

  it("never reaches the Site_Host rows with a malformed host and never copies the host into a redirect (Property 64)", () => {
    fc.assert(
      fc.property(fc.string(), fc.stringMatching(/^\/[a-z0-9/_-]{0,20}$/), fc.stringMatching(/^(\?[a-z0-9=&]{0,10})?$/), (host, path, search) => {
        const r = routeRequest(req(host, path, search), cfg);
        if (r.kind === "redirect") {
          expect(r.url.startsWith(cfg.appUrl!)).toBe(true);
          expect(hostnameOf(host)).toBe("revoboard.example");
        }
        if (hostnameOf(host) === null) expect(["next", "notFound"]).toContain(r.kind);
      }),
      { numRuns: 200 },
    );
  });
});

describe("SITE_URL and APP_URL (HOST-06)", () => {
  it("accepts both origins or neither, with or without a trailing slash", () => {
    expect(readOrigins({})).toEqual({ siteUrl: null, appUrl: null });
    expect(readOrigins({ SITE_URL: "https://a.test/", APP_URL: "https://app.a.test" })).toEqual({ siteUrl: "https://a.test", appUrl: "https://app.a.test" });
  });

  it("refuses one without the other, a path, and a value that is not an origin", () => {
    expect(() => readOrigins({ SITE_URL: "https://a.test" })).toThrow(/together/);
    expect(() => readOrigins({ SITE_URL: "https://a.test/x", APP_URL: "https://app.a.test" })).toThrow(/no path/);
    expect(() => readOrigins({ SITE_URL: "a.test", APP_URL: "https://app.a.test" })).toThrow(/absolute origin/);
  });
});

describe("proxy with a Site_Host (HOST-02, HOST-04)", () => {
  async function call(url: string, host: string) {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");
    return proxy(new NextRequest(url, { headers: { host } }));
  }

  it("rewrites / on the Site_Host, redirects other paths to the App_Host, and marks the App_Host noindex", async () => {
    process.env.SITE_URL = "https://revoboard.example";
    process.env.APP_URL = "https://app.revoboard.example";
    try {
      const home = await call("http://revoboard.example/", "revoboard.example");
      expect(home.headers.get("x-middleware-rewrite")).toContain("/site");
      expect(home.headers.get("x-robots-tag")).toBeNull();
      const other = await call("http://revoboard.example/boards/1?x=1", "revoboard.example");
      expect(other.status).toBe(308);
      expect(other.headers.get("location")).toBe("https://app.revoboard.example/boards/1?x=1");
      const login = await call("http://app.revoboard.example/login", "app.revoboard.example");
      expect(login.headers.get("x-robots-tag")).toBe("noindex");
      const guarded = await call("http://app.revoboard.example/boards", "app.revoboard.example");
      expect(guarded.status).toBe(307);
      expect(new URL(guarded.headers.get("location")!).pathname).toBe("/login");
    } finally {
      delete process.env.SITE_URL;
      delete process.env.APP_URL;
    }
  });
});
