import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pageList } from "@/components/admin/UsersScreen";
import { BaseCheckbox } from "@/components/shared/BaseCheckbox";
import { BaseCombobox } from "@/components/shared/BaseCombobox";
import { BaseDateField } from "@/components/shared/BaseDateField";
import { ColorSwatchPicker } from "@/components/shared/ColorSwatchPicker";
import { BoardsToolbar } from "@/components/board/BoardsToolbar";
import { AppHeader } from "@/components/shell/AppHeader";
import { isSidebarActive, sidebarItems } from "@/components/shell/navItems";
import { ShellContext } from "@/components/shell/ShellContext";
import { Sidebar } from "@/components/shell/Sidebar";
import { shellValue } from "./support/shell";
import { CATEGORIES_CHANGED, notifyCategoriesChanged } from "@/lib/categories";
import { homeFor, parentOf } from "@/lib/routes";
import { PALETTE } from "@/lib/tones";
import { quietSuccess, reportResult, toast } from "@/lib/toast";

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMocks, Toaster: () => null }));
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }), usePathname: () => "/app/boards" }));

beforeEach(() => vi.clearAllMocks());

describe("Toasts (TOAST-01 to TOAST-07)", () => {
  it("raises the envelope message after a write and nothing after a read", () => {
    reportResult("POST", "/boards/b1/columns", { ok: true, message: "Column created" });
    reportResult("GET", "/boards", { ok: true, message: "Boards" });
    reportResult("DELETE", "/columns/c1", { ok: true, message: "OK" });
    expect(toastMocks.success.mock.calls).toEqual([["Column created"]]);
  });

  it("stays quiet for sign-in, auto-save, checks, moves, and marking read", () => {
    for (const [m, p] of [["POST", "/auth/login"], ["PATCH", "/cards/c1"], ["PATCH", "/subtasks/s1"], ["PATCH", "/cards/c1/move"], ["PATCH", "/notifications/n1/read"]]) expect(quietSuccess(m, p)).toBe(true);
    expect(quietSuccess("POST", "/cards/c1/subtasks")).toBe(false);
  });

  it("raises an error Toast, except for a field error, a 401, and the sign-in form", () => {
    reportResult("PATCH", "/users/u1", { ok: false, message: "Nope", httpStatus: 409, hasDetails: false });
    reportResult("POST", "/boards", { ok: false, message: "Bad", httpStatus: 400, hasDetails: true });
    reportResult("POST", "/boards", { ok: false, message: "Expired", httpStatus: 401, hasDetails: false });
    reportResult("POST", "/auth/login", { ok: false, message: "Wrong", httpStatus: 401, hasDetails: false });
    expect(toastMocks.warning.mock.calls).toEqual([["Nope", { id: "Nope" }]]);
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("shows a warning Toast once per message", () => {
    toast.warning("This card is archived.");
    expect(toastMocks.warning).toHaveBeenCalledWith("This card is archived.", { id: "This card is archived." });
  });

  it.each([
    [403, "warning"],
    [409, "warning"],
    [429, "warning"],
    [0, "error"],
    [404, "error"],
    [500, "error"],
  ] as const)("shows a %i failure as a %s Toast keyed by its message", (httpStatus, tone) => {
    reportResult("POST", "/cards/c1/move", { ok: false, message: "No", httpStatus, hasDetails: false });
    expect(toastMocks[tone]).toHaveBeenCalledWith("No", { id: "No" });
    expect(toastMocks[tone === "warning" ? "error" : "warning"]).not.toHaveBeenCalled();
  });
});

describe("lists show no option as chosen on open (DS-07)", () => {
  const options = [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }];
  it("highlights nothing until a key is pressed, and marks the chosen value", async () => {
    render(<BaseCombobox label="Pick" options={options} value="b" searchable onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Pick/ }));
    const list = await screen.findByRole("listbox");
    expect(list.closest("[data-slot=command]")).toHaveAttribute("data-kb", "false");
    await userEvent.keyboard("{ArrowDown}");
    expect(list.closest("[data-slot=command]")).toHaveAttribute("data-kb", "true");
  });
});

describe("one date field and one checkbox (DS-09, DS-10)", () => {
  it("picks a day from the calendar and clears it", async () => {
    const onChange = vi.fn();
    render(<BaseDateField label="Due" value="2026-11-10" clearable onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /^Due:/ }));
    await userEvent.click(screen.getByRole("button", { name: /November 20th, 2026/ }));
    expect(onChange).toHaveBeenCalledWith("2026-11-20");
    await userEvent.click(screen.getByRole("button", { name: "Clear Due" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("the checkbox is a real checkbox", async () => {
    const onChange = vi.fn();
    render(<BaseCheckbox aria-label="Use" onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Use" }));
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Sidebar and back arrow (NAVB-03, NAVB-05)", () => {
  const boards = sidebarItems.find((i) => i.id === "boards")!;
  const dashboard = sidebarItems.find((i) => i.id === "dashboard")!;
  it("keeps Boards active on a Board path and on a descendant, and only one item is active", () => {
    for (const p of ["/app/boards", "/app/b/sales", "/app/b/sales/list", "/app/boards/abc"]) {
      expect(isSidebarActive(boards, p)).toBe(true);
      expect(isSidebarActive(dashboard, p)).toBe(false);
    }
    expect(isSidebarActive(dashboard, "/app/dashboard")).toBe(true);
    expect(isSidebarActive(boards, "/app/dashboardx")).toBe(false);
  });

  it("points every non-Sidebar page at its parent and gives Sidebar pages no arrow", () => {
    expect(parentOf("/app/b/sales/calendar", "member")).toEqual({ href: "/app/boards", label: "Boards" });
    expect(parentOf("/app/invite/tok", "manager")).toEqual({ href: "/app/boards", label: "Boards" });
    expect(parentOf("/app/profile", "member")).toEqual({ href: "/app/my-tasks", label: "My tasks" });
    expect(parentOf("/app/profile", "admin")).toEqual({ href: "/app/dashboard", label: "Dashboard" });
    for (const p of ["/app/boards", "/app/dashboard", "/app/my-tasks", "/app/users"]) expect(parentOf(p, "admin")).toBeNull();
    expect(homeFor("member")).toBe("/app/my-tasks");
    expect(homeFor("manager")).toBe("/app/dashboard");
  });
});

describe("Users pagination (USRP-04)", () => {
  it("lists the first, last, and two pages around the current one, with a gap", () => {
    expect(pageList(1, 3)).toEqual([1, 2, 3]);
    expect(pageList(5, 12)).toEqual([1, "gap", 3, 4, 5, 6, 7, "gap", 12]);
    expect(pageList(1, 1)).toEqual([1]);
  });
});

describe("Boards search and sort (BRDL-01, BRDL-03)", () => {
  it("writes the sort to the query string and drops the default", async () => {
    render(<BoardsToolbar q="" sort="updated_at" order="desc" />);
    await userEvent.click(screen.getByRole("button", { name: /Sort boards/ }));
    await userEvent.click(screen.getByRole("option", { name: "Oldest" }));
    expect(replace).toHaveBeenCalledWith("/app/boards?sort=created_at&order=asc");
  });

  it("searches after a pause", async () => {
    render(<BoardsToolbar q="" sort="updated_at" order="desc" />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search boards" }), "sales");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/boards?q=sales"));
  });
});

describe("categories palette and refresh (CATP-01, CATP-03, CATP-04)", () => {
  it("has the 18 keys and defines a fill and a text colour for each", () => {
    expect(PALETTE).toHaveLength(18);
    const css = readFileSync(path.join(__dirname, "..", "styles", "tokens.css"), "utf8");
    for (const k of PALETTE) {
      expect(css).toContain(`--label-${k}-bg:`);
      expect(css).toContain(`--label-${k}-text:`);
    }
  });

  it("text on fill is at least 4.5:1 for every key (Property 85)", () => {
    const css = readFileSync(path.join(__dirname, "..", "styles", "tokens.css"), "utf8");
    const hex = (name: string) => css.match(new RegExp(`--${name}: (#[0-9a-f]{6})`))![1];
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const k of PALETTE) {
      const [a, b] = [lum(hex(`label-${k}-bg`)), lum(hex(`label-${k}-text`))].sort((x, y) => y - x);
      expect((a + 0.05) / (b + 0.05), k).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the swatch grid picks a colour and shows the chosen one pressed", async () => {
    const onChange = vi.fn();
    render(<ColorSwatchPicker label="Color" value="teal" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Color: Teal" }));
    const group = screen.getByRole("group", { name: "Color" });
    expect(within(group).getAllByRole("button")).toHaveLength(18);
    expect(within(group).getByRole("button", { name: "Teal" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(group).getByRole("button", { name: "Rose" }));
    expect(onChange).toHaveBeenCalledWith("rose");
  });

  it("announces a change to the open Board", () => {
    const heard = vi.fn();
    window.addEventListener(CATEGORIES_CHANGED, heard);
    notifyCategoriesChanged("b1");
    window.removeEventListener(CATEGORIES_CHANGED, heard);
    expect((heard.mock.calls[0][0] as CustomEvent).detail).toEqual({ boardId: "b1" });
  });
});

describe("logo toggle, header line, centred Top_Menu (NAVB-01, NAVB-07, NAVB-08)", () => {
  const ctx = shellValue({ session: { token: "t", userId: "u1", role: "manager", exp: 0 } });
  it("the logo is the only Sidebar toggle: no separate expand icon", async () => {
    localStorage.clear();
    const { container } = render(
      <ShellContext.Provider value={ctx}>
        <Sidebar />
      </ShellContext.Provider>,
    );
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle.querySelector("img")?.getAttribute("src")).toBe("/brand/logo-text-revo.svg");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(toggle);
    const collapsed = screen.getByRole("button", { name: "Expand sidebar" });
    expect(collapsed.querySelector("img")?.getAttribute("src")).toBe("/brand/logo-revo.svg");
    expect(container.querySelector("svg.lucide-panel-left-close, svg.lucide-panel-left-open")).toBeNull();
  });

  it("the header carries a line under it and the Top_Menu sits between two equal parts", () => {
    render(
      <ShellContext.Provider value={ctx}>
        <AppHeader board={null} drawerOpen={false} onToggleDrawer={vi.fn()} />
      </ShellContext.Provider>,
    );
    const header = screen.getByRole("banner");
    expect(header.className).toContain("border-b");
    expect(header.className).toContain("border-line");
    const parts = Array.from(header.children).filter((c) => c.tagName === "DIV");
    expect(parts).toHaveLength(3);
    expect(parts[0].className).toContain("flex-1");
    expect(parts[2].className).toContain("flex-1");
    expect(parts[1].className).toContain("justify-center");
  });
});
