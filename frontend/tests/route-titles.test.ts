import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ serverGet: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/server", () => ({ serverGet: mocks.serverGet, serverToken: vi.fn() }));
vi.mock("@/lib/http", async (orig) => ({ ...(await orig<typeof import("@/lib/http")>()), request: mocks.request }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: vi.fn(), usePathname: vi.fn(), useSearchParams: vi.fn() }));

const render = (t: unknown) => {
  const title = (t as { title: string }).title;
  return `RevoBoard | ${title}`; // the root title.template
};

describe("one title per route (Requirement 32, TITLE-02)", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["app/(auth)/login", "Log in"],
    ["app/(auth)/register", "Register"],
    ["app/(shell)/profile", "Profile"],
    ["app/(shell)/users", "Users"],
    ["app/(shell)/invite/[token]", "Invitation"],
    ["app/(shell)/boards", "Home"],
  ])("%s", async (route, name) => {
    const mod = await import(`../app/${route}/page`);
    expect(render(mod.metadata)).toBe(`RevoBoard | ${name}`);
  });

  it("Board and Shared use the Board name and fall back when it cannot be read", async () => {
    const params = Promise.resolve({ slug: "alpha-board", token: "t" });
    mocks.serverGet.mockResolvedValue({ name: "Alpha Board" });
    mocks.request.mockResolvedValue({ name: "Alpha Board" });
    const board = await import("../app/app/(shell)/b/[slug]/page");
    const shared = await import("../app/app/shared/[token]/page");
    expect(render(await board.generateMetadata({ params }))).toBe("RevoBoard | Alpha Board");
    expect(render(await shared.generateMetadata({ params }))).toBe("RevoBoard | Shared · Alpha Board");
    mocks.serverGet.mockRejectedValue(new Error("x"));
    mocks.request.mockRejectedValue(new Error("x"));
    expect(render(await board.generateMetadata({ params }))).toBe("RevoBoard | Board");
    expect(mocks.serverGet).toHaveBeenCalledWith("/boards/slug/alpha-board");
    expect((await shared.generateMetadata({ params })).robots).toEqual({ index: false, follow: false });
  });
});
