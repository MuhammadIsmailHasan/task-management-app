import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/return-path";
import { boardByIdPath, boardPath, boardViewPath, cardPath, invitePath, isGuardedPath, legacyRedirect, loginPath, routes, sharedPath } from "@/lib/routes";
import { proxy } from "@/proxy";

const jwt = (claims: object) => `h.${btoa(JSON.stringify(claims))}.s`;
const valid = jwt({ sub: "u", role: "member", exp: 9_999_999_999 });
const call = (p: string, cookie?: string) => proxy(new NextRequest(`http://localhost:3000${p}`, cookie ? { headers: { cookie: `kanban_token=${cookie}` } } : undefined));

describe("lib/routes (PATH-10)", () => {
  it("builds every page path under /app, and the Landing_Page at /", () => {
    expect(routes.landing).toBe("/");
    expect(routes.boards).toBe("/app/boards");
    expect(boardPath("q3-plan")).toBe("/app/b/q3-plan");
    expect(boardPath("q3-plan", { card: "c1", empty: "" })).toBe("/app/b/q3-plan?card=c1");
    expect(boardViewPath("q3-plan", "calendar", { q: "a b" })).toBe("/app/b/q3-plan/calendar?q=a+b");
    expect(cardPath("q3-plan", "c1")).toBe("/app/b/q3-plan?card=c1");
    expect(boardByIdPath("b1")).toBe("/app/boards/b1");
    expect(invitePath("tok")).toBe("/app/invite/tok");
    expect(sharedPath("tok")).toBe("/app/shared/tok");
    expect(loginPath("/app/b/x")).toBe("/app/login?next=%2Fapp%2Fb%2Fx");
    expect(loginPath()).toBe("/app/login");
  });

  it("writes no page route by hand outside lib/routes.ts: no /app literal and no href to a path", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const f = path.join(dir, n);
        return statSync(f).isDirectory() ? files(f) : /\.(tsx?|ts)$/.test(f) ? [f] : [];
      });
    const sources = [...files(path.join(root, "components")), ...files(path.join(root, "app")), ...files(path.join(root, "hooks"))];
    const handWritten = /["'`]\/app(?:\/|["'`])|(?:href=|\.push\(|\.replace\(|redirect\(|\.assign\()\s*\{?\s*["'`]\/(?!["'`/])/;
    const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
    const bad = sources.filter((f) => handWritten.test(code(f))).map((f) => path.relative(root, f));
    expect(bad).toEqual([]);
  });
});

describe("legacy paths answer 308 with the query kept (PATH-08)", () => {
  it.each([
    ["/boards", "/app/boards"],
    ["/boards/b1", "/app/boards/b1"],
    ["/dashboard", "/app/dashboard"],
    ["/admin/users", "/app/users"],
    ["/profile", "/app/profile"],
    ["/login", "/app/login"],
    ["/register", "/app/register"],
    ["/invite/tok", "/app/invite/tok"],
    ["/shared/tok", "/app/shared/tok"],
    ["/session-expired", "/app/session-expired"],
  ])("%s goes to %s", (from, to) => {
    expect(legacyRedirect(from, "")).toBe(to);
    const r = call(`${from}?card=c1`);
    expect(r.status).toBe(308);
    const url = new URL(r.headers.get("location")!);
    expect(url.pathname).toBe(to);
    expect(url.search).toBe("?card=c1");
  });

  it("leaves new paths, the landing page, and unknown paths alone", () => {
    for (const p of ["/", "/app/boards", "/app/b/x/list", "/boardsx", "/admin", "/boards/b1/extra"]) expect(legacyRedirect(p, "")).toBeNull();
  });
});

describe("proxy guard and headers (PATH-05, PATH-07)", () => {
  it("guards boards, boards views, dashboard, my tasks, users, profile, and invites, and nothing else", () => {
    for (const p of ["/app/boards", "/app/boards/b1", "/app/b/x", "/app/b/x/list", "/app/dashboard", "/app/my-tasks", "/app/users", "/app/profile", "/app/invite/t"]) expect(isGuardedPath(p), p).toBe(true);
    for (const p of ["/app/login", "/app/register", "/app/verify", "/app/session-expired", "/app/shared/t", "/", "/app/boardsx"]) expect(isGuardedPath(p), p).toBe(false);
  });

  it("redirects a guarded path without a usable cookie to /app/login with a safe next, and removes a stale cookie", () => {
    const r = call("/app/b/alpha?card=c1");
    expect(r.status).toBe(307);
    const url = new URL(r.headers.get("location")!);
    expect(url.pathname).toBe("/app/login");
    expect(url.searchParams.get("next")).toBe("/app/b/alpha?card=c1");
    const stale = call("/app/profile", "bogus");
    expect(stale.headers.get("set-cookie")).toContain("kanban_token=;");
    expect(stale.headers.get("set-cookie")).toContain("Path=/app");
  });

  it("lets a usable cookie through and forwards the return path", () => {
    expect(call("/app/dashboard", valid).status).toBe(200);
  });

  it("does not guard the sign-in pages, the shared view, or the Landing_Page", () => {
    for (const p of ["/app/login", "/app/register", "/app/verify", "/app/shared/tok", "/"]) expect(call(p).status, p).toBe(200);
  });

  it("marks every /app response noindex and no other", () => {
    expect(call("/app/login").headers.get("x-robots-tag")).toBe("noindex");
    expect(call("/app/dashboard", valid).headers.get("x-robots-tag")).toBe("noindex");
    expect(call("/app/boards").headers.get("x-robots-tag")).toBe("noindex");
    expect(call("/").headers.get("x-robots-tag")).toBeNull();
  });

  it("returns only to guarded /app paths", () => {
    expect(safeReturnPath("/app/b/x?card=1")).toBe("/app/b/x?card=1");
    expect(safeReturnPath("/app/invite/abc")).toBe("/app/invite/abc");
    for (const bad of ["/", "/app/login", "/app/verify", "/boards", "//evil", "https://x.y", "/app/b", "/app/bx"]) expect(safeReturnPath(bad), bad).toBe("/app/boards");
  });
});
