import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fc from "fast-check";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SharedBoard } from "@/components/shared-view/SharedBoard";
import { MemberSearch } from "@/components/shell/MemberSearch";
import { UserMenu } from "@/components/shell/UserMenu";
import { useCountdown } from "@/hooks/useCountdown";
import { safeReturnPath } from "@/lib/return-path";
import { isUsableToken } from "@/lib/session-token";
import { classifyIdentifier } from "@/lib/validation";
import { proxy } from "@/proxy";

const candidates = vi.fn();
const logout = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { boards: { candidates: (...a: unknown[]) => candidates(...a), addMember: vi.fn() }, auth: { logout: () => logout() }, shared: { attachmentUrl: vi.fn() } },
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const jwt = (claims: object) => `h.${btoa(JSON.stringify(claims))}.s`;

beforeEach(() => vi.clearAllMocks());

describe("classifyIdentifier (Property 42)", () => {
  it.each([
    ["Ann", { kind: "username", value: "ann" }],
    [" ann.lee_1 ", { kind: "username", value: "ann.lee_1" }],
    ["Ann@X.com", { kind: "email", value: "ann@x.com" }],
  ])("%s", (raw, expected) => expect(classifyIdentifier(raw)).toEqual(expected));

  it.each(["", "ab", "has space", "a@b", "a@@b.com", "x".repeat(31), "bad!name"])("rejects %j", (raw) => expect(classifyIdentifier(raw)).toBeNull());

  it("agrees with the backend rule for any string", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (raw) => {
        const v = raw.trim().toLowerCase();
        const got = classifyIdentifier(raw);
        if (v.includes("@")) expect(got === null || got.kind === "email").toBe(true);
        else expect(got === null || got.kind === "username").toBe(true);
        if (got) expect(got.value).toBe(v);
      }),
    );
  });
});

describe("safeReturnPath and isUsableToken (Property 48)", () => {
  it("keeps only guarded same-site paths", () => {
    expect(safeReturnPath("/app/b/alpha?x=1")).toBe("/app/b/alpha?x=1");
    expect(safeReturnPath("/app/profile")).toBe("/app/profile");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil", "javascript:alert(1)", "/app/login", "/boards/abc", "", null, undefined, "/app/boardsx"]) {
      expect(safeReturnPath(bad)).toBe("/app/boards");
    }
  });
  it("is stable for any input", () => {
    fc.assert(fc.property(fc.string(), (s) => safeReturnPath(safeReturnPath(s)) === safeReturnPath(s)));
  });
  it("needs three parts, a readable payload, and a future exp", () => {
    const now = 1_000;
    expect(isUsableToken(jwt({ sub: "u", role: "member", exp: 2_000 }), now)).toBe(true);
    expect(isUsableToken(jwt({ sub: "u", role: "member", exp: 500 }), now)).toBe(false);
    for (const bad of [null, "", "bogus", "a.b", "a..c", "h.!!.s", jwt({ role: "member", exp: 2_000 })]) expect(isUsableToken(bad as string, now)).toBe(false);
  });
});

describe("proxy (route guard)", () => {
  const call = (path: string, cookie?: string) =>
    proxy(new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie: `kanban_token=${cookie}` } } : undefined));

  it("redirects without a cookie to /app/login with next", () => {
    const r = call("/app/b/alpha?x=1");
    expect(r.status).toBe(307);
    const url = new URL(r.headers.get("location")!);
    expect(url.pathname).toBe("/app/login");
    expect(url.searchParams.get("next")).toBe("/app/b/alpha?x=1");
  });
  it("redirects a malformed or expired cookie and removes it", () => {
    for (const cookie of ["bogus", jwt({ sub: "u", role: "member", exp: 1 })]) {
      const r = call("/app/profile", cookie);
      expect(r.status).toBe(307);
      expect(r.headers.get("set-cookie")).toContain("kanban_token=;");
    }
  });
  it("lets a usable cookie through", () => {
    expect(call("/app/boards", jwt({ sub: "u", role: "member", exp: 9_999_999_999 })).status).toBe(200);
  });
});

describe("useCountdown", () => {
  it("ticks down to zero", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountdown(3));
    expect(result.current).toBe(3);
    try {
      for (const expected of [2, 1, 0, 0]) {
        act(() => void vi.advanceTimersByTime(1000));
        expect(result.current).toBe(expected);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MemberSearch", () => {
  it("sends nothing below 2 characters, then shows name, username and email", async () => {
    candidates.mockResolvedValue([{ id: "u1", full_name: "Ann Lee", username: "ann", email: "ann@x.com", avatar_url: null }]);
    render(<MemberSearch boardId="b1" onAdded={vi.fn()} />);
    expect(screen.getByText("Type at least 2 characters.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search people"), "a");
    await new Promise((r) => setTimeout(r, 350));
    expect(candidates).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Search people"), "n");
    expect(await screen.findByText("@ann · ann@x.com")).toBeInTheDocument();
    expect(candidates).toHaveBeenCalledWith("b1", "an");
  });
});

describe("UserMenu", () => {
  const user = { id: "u1", full_name: "Ann Lee", username: "ann", email: "ann@x.com", avatar_url: null };
  it("lists Profile above Log out and Log out calls the API", async () => {
    render(<UserMenu user={user} />);
    await userEvent.click(screen.getByRole("button", { name: "User menu" }));
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toEqual(["Profile", "Log out"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });
});

describe("SharedBoard", () => {
  const board = { id: "b1", name: "Roadmap", description: "Plan", has_board_access: false, columns: [{ id: "c1", board_id: "b1", name: "Todo", order: 0 }] };
  const card = {
    id: "k1", column_id: "c1", category_id: null, assignee_id: "u1", assignee_name: "Ann Lee", title: "Ship it", description: "Soon", priority: "high" as const,
    start_date: null, end_date: null, order: 1, archived_at: null, subtasks: [{ id: "s1", card_id: "k1", title: "Wire", is_done: true, order: 1 }], attachments: [],
  };
  it("is read only: banner, sign-in link, no add, drag, comments or activity", async () => {
    render(<SharedBoard token="t" board={board} cards={[card]} categories={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Read only");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/app/login");
    expect(screen.queryByText(/add a card/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Open card Ship it" })).toHaveAttribute("draggable", "false");
    await userEvent.click(screen.getByRole("button", { name: "Open card Ship it" }));
    expect(await screen.findByText("Assigned to Ann Lee")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Wire" })).toBeDisabled();
    for (const word of [/comments/i, /activity/i, /^save$/i, /^delete$/i]) expect(screen.queryByText(word)).toBeNull();
  });
});
