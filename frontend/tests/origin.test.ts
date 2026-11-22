import fc from "fast-check";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load(publicUrl: string, internal?: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_URL", publicUrl);
  vi.stubEnv("INTERNAL_API_URL", internal ?? "");
  const fetch = vi.fn(async () => ({ status: 200, json: async () => ({ status: true, data: 1 }) }));
  vi.stubGlobal("fetch", fetch);
  return { fetch, http: await import("@/lib/http"), files: await import("@/lib/attachments") };
}
const called = (fetch: ReturnType<typeof vi.fn>) => String(fetch.mock.calls[0][0]);

describe("origin independence (Property 62)", () => {
  it("calls the API on whatever origin served the page", async () => {
    const { fetch, http } = await load("/api");
    await fc.assert(
      fc.asyncProperty(fc.webAuthority({ withPort: true }), fc.constantFrom("http", "https"), async (host, scheme) => {
        const origin = new URL(`${scheme}://${host}`).origin;
        vi.stubGlobal("window", { location: { origin } });
        fetch.mockClear();
        await http.request("GET", "/boards", { query: { search: "a b" } });
        expect(called(fetch)).toBe(`${origin}/api/boards?search=a+b`);
      }),
    );
  });

  it("uses INTERNAL_API_URL on the server", async () => {
    const { fetch, http } = await load("/api", "http://127.0.0.1:5001/api/");
    vi.stubGlobal("window", undefined);
    await http.request("GET", "/boards");
    expect(called(fetch)).toBe("http://127.0.0.1:5001/api/boards");
  });

  it("names the missing setting on the server", async () => {
    const { http } = await load("/api");
    vi.stubGlobal("window", undefined);
    await expect(http.request("GET", "/boards")).rejects.toThrow("INTERNAL_API_URL");
  });

  it("keeps an absolute API URL working for local development", async () => {
    const { fetch, http, files } = await load("http://localhost:5001/api");
    await http.request("GET", "/boards");
    expect(called(fetch)).toBe("http://localhost:5001/api/boards");
    expect(http.apiAsset("/api/a")).toBe("http://localhost:5001/api/a");
    expect(files.absoluteFileUrl("/api/f")).toBe("http://localhost:5001/api/f");
  });

  it("never puts the internal URL in an avatar or attachment link", async () => {
    const { http, files } = await load("/api", "http://127.0.0.1:5001/api");
    vi.stubGlobal("window", undefined);
    expect(http.apiAsset("/api/users/u/avatar/file?sig=x")).toBe("/api/users/u/avatar/file?sig=x");
    expect(files.absoluteFileUrl("/api/attachments/a/file?sig=x")).toBe("/api/attachments/a/file?sig=x");
  });

  it.each([
    ["", "/login"],
    ["?next=%2Fboards%2Fb1%3Fcard%3Dc1", "/login?next=%2Fboards%2Fb1%3Fcard%3Dc1"],
    ["?next=%2F%2Fevil.example", "/login"],
  ])("/session-expired%s redirects relatively and drops the cookie", async (query, location) => {
    const { GET } = await import("../app/session-expired/route");
    const res = GET(new NextRequest(`http://localhost:3000/session-expired${query}`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(location);
    expect(res.headers.get("set-cookie")).toContain("kanban_token=;");
  });
});
