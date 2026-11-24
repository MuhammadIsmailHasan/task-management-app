import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconRail } from "@/components/shell/IconRail";
import { NavDrawer } from "@/components/shell/NavDrawer";
import { ShellContext, type ShellState } from "@/components/shell/ShellContext";
import { SkipLink } from "@/components/shell/SkipLink";
import { TopNav } from "@/components/shell/TopNav";
import { BoardSwitcher } from "@/components/shell/BoardSwitcher";
import { itemsFor } from "@/components/shell/navItems";
import type { Board, Role } from "@/lib/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/boards/b1", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/lib/api", () => ({ api: { boards: { members: vi.fn().mockResolvedValue([]) }, auth: { logout: vi.fn() } } }));

const board = (n: number, over: Partial<Board> = {}): Board => ({ id: `b${n}`, name: `Board ${n}`, owner_id: "u1", archived_at: null, card_count: 4, done_count: 1, ...over });

const shell = (role: Role | null, over: Partial<ShellState> = {}): ShellState => ({
  session: role ? { token: "t", userId: "u1", role, exp: 0 } : null,
  user: null,
  boardId: "b1",
  boards: [board(1), board(2)],
  panel: null,
  inbox: { items: [], unread_count: 0 },
  refreshInbox: vi.fn(),
  toggleSidePanel: vi.fn(),
  closeSidePanel: vi.fn(),
  adjustUnread: vi.fn(),
  ...over,
});

const wrap = (ctx: ShellState, ui: React.ReactNode) => render(<ShellContext.Provider value={ctx}>{ui}</ShellContext.Provider>);

describe("navigation items by role (SHELL-05)", () => {
  const labels = (role: Role, boardId: string | null, place: "rail" | "top" | "drawer") => itemsFor(place, { role, boardId }).map((i) => i.label);

  it("shows Dashboard to a Supervisor and a Manager only", () => {
    expect(labels("supervisor", "b1", "top")).toContain("Dashboard");
    expect(labels("manager", "b1", "top")).toContain("Dashboard");
    expect(labels("member", "b1", "top")).not.toContain("Dashboard");
    expect(labels("admin", "b1", "top")).not.toContain("Dashboard");
  });

  it("shows Categories to Supervisor, Manager, and Admin while a Board is open", () => {
    for (const role of ["supervisor", "manager", "admin"] as Role[]) expect(labels(role, "b1", "top")).toContain("Categories");
    expect(labels("member", "b1", "top")).not.toContain("Categories");
    expect(labels("manager", null, "top")).not.toContain("Categories");
  });

  it("shows Team while a Board is open, and always to an Admin", () => {
    expect(labels("member", "b1", "top")).toContain("Team");
    expect(labels("member", null, "top")).not.toContain("Team");
    expect(labels("admin", null, "top")).toContain("Team");
  });

  it("puts the same destinations in the rail, the Top_Nav, and the drawer, and no Log out or Profile anywhere", () => {
    const all = ["rail", "top", "drawer"].flatMap((p) => labels("manager", "b1", p as "rail"));
    expect(all.join(" ")).not.toMatch(/log out|profile|settings/i);
    expect(labels("member", "b1", "rail")).toEqual(["Home", "Board", "Inbox", "Activity", "Team"]);
    expect(labels("member", "b1", "top")).toEqual(["Boards", "Inbox", "Activity", "Team"]);
  });
});

describe("Icon_Rail and Top_Nav", () => {
  it("names each rail item and marks the open Board as the current page", () => {
    wrap(shell("manager"), <IconRail />);
    const nav = screen.getByRole("navigation", { name: "Rail" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/boards");
    expect(within(nav).getByRole("link", { name: "Board" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: "Inbox" })).toBeInTheDocument();
  });

  it("opens the Team view for a Member and goes to the user list for an Admin", async () => {
    const member = shell("member");
    const { unmount } = wrap(member, <TopNav />);
    await userEvent.click(screen.getByRole("button", { name: "Team" }));
    expect(member.toggleSidePanel).toHaveBeenCalledWith("team");
    unmount();
    wrap(shell("admin"), <TopNav />);
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("href", "/admin/users");
  });

  it("shows the unread count on Inbox, capped at 9+", () => {
    wrap(shell("member", { inbox: { items: [], unread_count: 12 } }), <TopNav />);
    expect(screen.getByRole("button", { name: /Inbox/ })).toHaveTextContent("9+");
  });

  it("toggles the Inbox panel from the Top_Nav", async () => {
    const ctx = shell("member");
    wrap(ctx, <TopNav />);
    await userEvent.click(screen.getByRole("button", { name: "Inbox" }));
    expect(ctx.toggleSidePanel).toHaveBeenCalledWith("inbox");
  });
});

describe("Nav_Drawer (SHELL-04)", () => {
  it("lists the items and the Boards, and closes on Escape and on a link", async () => {
    const onClose = vi.fn();
    wrap(shell("supervisor"), <NavDrawer open onClose={onClose} />);
    const menu = screen.getByRole("navigation", { name: "Menu" });
    expect(within(menu).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    const boards = screen.getByRole("region", { name: "Boards" });
    await userEvent.click(within(boards).getByRole("link", { name: "Board 2" }));
    expect(onClose).toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onClose.mock.calls.length).toBeGreaterThan(1);
  });

  it("renders nothing while closed", () => {
    wrap(shell("member"), <NavDrawer open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("navigation", { name: "Menu" })).not.toBeInTheDocument();
  });
});

describe("Board_Switcher (SHELL-12 to SHELL-15)", () => {
  it("lists the Boards with the role tag, the card count, and the percentage done, without a search field under six Boards", async () => {
    wrap(shell("manager", { boards: [board(1, { done_count: 1, card_count: 4 }), board(2, { owner_id: "other", card_count: 0, done_count: 0 })] }), <BoardSwitcher board={board(1)} />);
    await userEvent.click(screen.getByRole("button", { name: "Switch board: Board 1" }));
    const list = screen.getByRole("list", { name: "Boards" });
    const first = within(list).getByRole("link", { name: /Board 1/ });
    expect(first).toHaveAttribute("aria-current", "true");
    expect(first).toHaveTextContent("Owner");
    expect(first).toHaveTextContent("4 cards");
    expect(first).toHaveTextContent("25%");
    expect(within(list).getByRole("link", { name: /Board 2/ })).toHaveTextContent("Manager");
    expect(within(list).getByRole("link", { name: /Board 2/ })).toHaveTextContent("0%");
    expect(screen.queryByRole("searchbox", { name: "Search boards" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create new board/ })).toBeInTheDocument();
  });

  it("adds a search field from six Boards and filters by name", async () => {
    const many = Array.from({ length: 7 }, (_, i) => board(i + 1));
    wrap(shell("member", { boards: many }), <BoardSwitcher board={many[0]} />);
    await userEvent.click(screen.getByRole("button", { name: /Switch board/ }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search boards" }), "Board 7");
    expect(within(screen.getByRole("list", { name: "Boards" })).getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Create new board/ })).not.toBeInTheDocument();
  });
});

describe("Skip link (SHELL-25)", () => {
  it("points at the main region", () => {
    render(<SkipLink />);
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
  });
});
