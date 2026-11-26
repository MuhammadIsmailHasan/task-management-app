import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavDrawer } from "@/components/shell/NavDrawer";
import { ShellContext, type ShellState } from "@/components/shell/ShellContext";
import { Sidebar } from "@/components/shell/Sidebar";
import { SkipLink } from "@/components/shell/SkipLink";
import { TopMenu } from "@/components/shell/TopMenu";
import { BoardSwitcher } from "@/components/shell/BoardSwitcher";
import { sidebarFor, sidebarItems, topMenuFor, topMenuItems } from "@/components/shell/navItems";
import type { Board, Role } from "@/lib/types";
import { shellValue } from "./support/shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/b/board-1", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/lib/api", () => ({ api: { boards: { members: vi.fn().mockResolvedValue([]) }, auth: { logout: vi.fn() } } }));

const board = (n: number, over: Partial<Board> = {}): Board => ({ id: `b${n}`, slug: `board-${n}`, name: `Board ${n}`, owner_id: "u1", archived_at: null, card_count: 4, done_count: 1, ...over });

/** A signed-in viewer on Board 1 (or on no Board with `open: false`). */
const shell = (role: Role | null, over: Partial<ShellState> & { open?: boolean } = {}): ShellState => {
  const { open = true, ...rest } = over;
  const boards = [board(1), board(2)];
  return shellValue({
    session: role ? { token: "t", userId: "u1", role, exp: 0 } : null,
    boardId: open ? "b1" : null,
    board: open ? boards[0] : null,
    boards,
    inbox: { items: [], unread_count: 0 },
    ...rest,
  });
};

const wrap = (ctx: ShellState, ui: React.ReactNode) => render(<ShellContext.Provider value={ctx}>{ui}</ShellContext.Provider>);

const ctxOf = (role: Role, boardOpen: boolean, isOwner = false) => ({ role, boardOpen, isOwner });

beforeEach(() => localStorage.clear());

describe("navigation items by role (NAV-01, NAV-04, NAV-05)", () => {
  const side = (role: Role) => sidebarFor(ctxOf(role, false)).map((i) => i.label);
  const top = (role: Role, isOwner = false, open = true) => topMenuFor(ctxOf(role, open, isOwner)).map((i) => i.label);

  it("gives the Sidebar Dashboard to staff and Admin, My Tasks to a Member and a Supervisor only, Users to an Admin only (V18)", () => {
    expect(side("supervisor")).toEqual(["Dashboard", "My Tasks", "Boards"]);
    expect(side("manager")).toEqual(["Dashboard", "Boards"]);
    expect(side("member")).toEqual(["My Tasks", "Boards"]);
    expect(side("admin")).toEqual(["Dashboard", "Boards", "Users"]);
  });

  it("shows the Top_Menu only while a Board is open", () => {
    expect(top("manager", false, false)).toEqual([]);
    expect(top("member")).toEqual(["Board", "List", "Calendar", "Activity", "Members"]);
  });

  it("shows Categories to Supervisor, Manager, and Admin, and Share to the Board_Owner, a Manager, and an Admin", () => {
    for (const role of ["supervisor", "manager", "admin"] as Role[]) expect(top(role)).toContain("Categories");
    expect(top("member")).not.toContain("Categories");
    expect(top("manager")).toContain("Share");
    expect(top("admin")).toContain("Share");
    expect(top("supervisor", true)).toContain("Share");
    expect(top("supervisor", false)).not.toContain("Share");
    expect(top("member", false)).not.toContain("Share");
  });

  it("repeats no item between the Sidebar and the Top_Menu, and puts no Log out, Profile, or Inbox item in either (NAV-05, NAV-06, NAV-12)", () => {
    const ids = [...sidebarItems.map((i) => i.id), ...topMenuItems.map((i) => i.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.join(" ")).not.toMatch(/inbox|log-?out|profile/i);
    expect([...sidebarItems, ...topMenuItems].map((i) => i.label).join(" ")).not.toMatch(/log out|profile|inbox/i);
  });
});

describe("Sidebar (NAV-02)", () => {
  it("is expanded by default with labels, and collapses to icons with the state remembered per browser", async () => {
    const { unmount } = wrap(shell("manager"), <Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Sidebar" });
    expect(within(nav).getByRole("link", { name: /Dashboard/ })).toHaveTextContent("Dashboard");
    const toggle = within(nav).getByRole("button", { name: "Collapse sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    expect(within(nav).getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveTextContent("Dashboard");
    expect(localStorage.getItem("revoboard.sidebar")).toBe("collapsed");
    unmount();
    wrap(shell("manager"), <Sidebar />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument());
  });

  it("falls back to expanded for an unknown stored value", () => {
    localStorage.setItem("revoboard.sidebar", "sideways");
    wrap(shell("manager"), <Sidebar />);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("marks the current route and links to the right places", () => {
    wrap(shell("admin", { open: false }), <Sidebar />);
    expect(screen.getByRole("link", { name: /Users/ })).toHaveAttribute("href", "/app/users");
    expect(screen.getByRole("link", { name: /Boards/ })).toHaveAttribute("href", "/app/boards");
    expect(screen.queryByRole("link", { name: /My Tasks/ })).not.toBeInTheDocument();
  });

  it("does not move focus when it toggles", async () => {
    wrap(shell("member"), <Sidebar />);
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveFocus();
  });
});

describe("Top_Menu (NAV-04)", () => {
  it("renders nothing off a Board", () => {
    wrap(shell("manager", { open: false }), <TopMenu />);
    expect(screen.queryByRole("navigation", { name: "Board" })).not.toBeInTheDocument();
  });

  it("links Board, List, and Calendar to the slug routes and marks the current one", () => {
    wrap(shell("member"), <TopMenu />);
    const nav = screen.getByRole("navigation", { name: "Board" });
    expect(within(nav).getByRole("link", { name: "Board" })).toHaveAttribute("href", "/app/b/board-1");
    expect(within(nav).getByRole("link", { name: "Board" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "List" })).toHaveAttribute("href", "/app/b/board-1/list");
    expect(within(nav).getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/app/b/board-1/calendar");
  });

  it("opens the Side_Panel views and the Share_Modal through the one shell", async () => {
    const ctx = shell("manager");
    wrap(ctx, <TopMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Activity" }));
    expect(ctx.toggleSidePanel).toHaveBeenCalledWith("activity");
    await userEvent.click(screen.getByRole("button", { name: "Members" }));
    expect(ctx.toggleSidePanel).toHaveBeenCalledWith("members");
    await userEvent.click(screen.getByRole("button", { name: "Categories" }));
    expect(ctx.toggleSidePanel).toHaveBeenCalledWith("categories");
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(ctx.openShare).toHaveBeenCalled();
  });

  it("marks the open panel view as pressed", () => {
    wrap(shell("manager", { panel: "members" }), <TopMenu />);
    expect(screen.getByRole("button", { name: "Members" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Activity" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the pending join-request count on Share for a Manager, capped at 9+", () => {
    wrap(shell("manager", { pendingRequests: 12 }), <TopMenu />);
    expect(screen.getByRole("button", { name: "Share, 12 waiting" })).toHaveTextContent("9+");
  });

  it("shows no count to the Board_Owner, who does not decide on requests", () => {
    wrap(shell("supervisor", { pendingRequests: 3 }), <TopMenu />);
    expect(screen.getByRole("button", { name: "Share" })).not.toHaveTextContent("3");
  });
});

describe("Nav_Drawer (NAV-03)", () => {
  it("lists the global items, a This board group on a Board, and the Boards, and closes on Escape and on a link", async () => {
    const onClose = vi.fn();
    wrap(shell("supervisor"), <NavDrawer open onClose={onClose} />);
    const menu = screen.getByRole("navigation", { name: "Menu" });
    expect(within(menu).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/app/dashboard");
    const boardGroup = screen.getByRole("navigation", { name: "This board" });
    expect(within(boardGroup).getByRole("link", { name: "List" })).toHaveAttribute("href", "/app/b/board-1/list");
    const boards = screen.getByRole("region", { name: "Boards" });
    await userEvent.click(within(boards).getByRole("link", { name: "Board 2" }));
    expect(onClose).toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onClose.mock.calls.length).toBeGreaterThan(1);
  });

  it("has no This board group off a Board", () => {
    wrap(shell("member", { open: false }), <NavDrawer open onClose={vi.fn()} />);
    expect(screen.queryByRole("navigation", { name: "This board" })).not.toBeInTheDocument();
  });

  it("opens a Side_Panel view from the drawer and closes itself", async () => {
    const onClose = vi.fn();
    const ctx = shell("member");
    wrap(ctx, <NavDrawer open onClose={onClose} />);
    await userEvent.click(within(screen.getByRole("navigation", { name: "This board" })).getByRole("button", { name: "Activity" }));
    expect(ctx.toggleSidePanel).toHaveBeenCalledWith("activity");
    expect(onClose).toHaveBeenCalled();
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
