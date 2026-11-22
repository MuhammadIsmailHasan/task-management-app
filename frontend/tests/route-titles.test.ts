import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ serverGet: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/server", () => ({ serverGet: mocks.serverGet, serverToken: vi.fn() }));
vi.mock("@/lib/http", async (orig) => ({ ...(await orig<typeof import("@/lib/http")>()), request: mocks.request }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: vi.fn(), usePathname: vi.fn(), useSearchParams: vi.fn() }));

const render = (t: unknown) => {
  const title = (t as { title: string }).title;
  return `RevoTask | ${title}`; // the root title.template
};

describe("one title per route (Requirement 32, TITLE-02)", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["(auth)/login", "Log in"],
    ["(auth)/register", "Register"],
    ["(app)/profile", "Profile"],
    ["(app)/admin/users", "Users"],
    ["(app)/invite/[token]", "Invitation"],
    ["(app)/boards", "Home"],
  ])("%s", async (route, name) => {
    const mod = await import(`../app/${route}/page`);
    expect(render(mod.metadata)).toBe(`RevoTask | ${name}`);
  });

  it("Board, Categories and Shared use the Board name and fall back when it cannot be read", async () => {
    const params = Promise.resolve({ id: "b1", token: "t" });
    mocks.serverGet.mockResolvedValue({ name: "Alpha Board" });
    mocks.request.mockResolvedValue({ name: "Alpha Board" });
    const board = await import("../app/(app)/boards/[id]/page");
    const cats = await import("../app/(app)/boards/[id]/categories/page");
    const shared = await import("../app/shared/[token]/page");
    expect(render(await board.generateMetadata({ params }))).toBe("RevoTask | Alpha Board");
    expect(render(await cats.generateMetadata({ params }))).toBe("RevoTask | Categories · Alpha Board");
    expect(render(await shared.generateMetadata({ params }))).toBe("RevoTask | Shared · Alpha Board");
    mocks.serverGet.mockRejectedValue(new Error("x"));
    mocks.request.mockRejectedValue(new Error("x"));
    expect(render(await board.generateMetadata({ params }))).toBe("RevoTask | Board");
    expect((await shared.generateMetadata({ params })).robots).toEqual({ index: false, follow: false });
  });
});
