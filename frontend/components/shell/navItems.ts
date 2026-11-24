import { Bell, History, House, LayoutDashboard, SquareKanban, Tags, Users, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/types";
import type { PanelView } from "./ShellContext";

export interface NavContext {
  role: Role | undefined;
  boardId: string | null;
}

export interface NavItemDef {
  id: "home" | "board" | "boards" | "dashboard" | "inbox" | "activity" | "categories" | "team";
  label: string;
  icon: LucideIcon;
  /** Where the item sits: the Icon_Rail, the Top_Nav, and the Nav_Drawer (SHELL-01, 03, 04). */
  rail: boolean;
  top: boolean;
  drawer: boolean;
  isVisible: (ctx: NavContext) => boolean;
  /** A route, or null when the item opens a Side_Panel view. */
  href: (ctx: NavContext) => string | null;
  panel?: PanelView;
}

const signedIn = (c: NavContext) => !!c.role;
const staff = (c: NavContext) => c.role === "supervisor" || c.role === "manager";

/** The single list of navigation items: the rail, the Top_Nav, and the drawer all map it, so they never disagree (SHELL-05). */
export const NAV_ITEMS: NavItemDef[] = [
  { id: "home", label: "Home", icon: House, rail: true, top: false, drawer: false, isVisible: signedIn, href: () => "/boards" },
  { id: "boards", label: "Boards", icon: SquareKanban, rail: false, top: true, drawer: true, isVisible: signedIn, href: () => "/boards" },
  { id: "board", label: "Board", icon: SquareKanban, rail: true, top: false, drawer: false, isVisible: (c) => signedIn(c) && !!c.boardId, href: (c) => (c.boardId ? `/boards/${c.boardId}` : null) },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, rail: true, top: true, drawer: true, isVisible: staff, href: () => "/dashboard" },
  { id: "inbox", label: "Inbox", icon: Bell, rail: true, top: true, drawer: true, isVisible: signedIn, href: () => null, panel: "inbox" },
  { id: "activity", label: "Activity", icon: History, rail: true, top: true, drawer: true, isVisible: signedIn, href: () => null, panel: "activity" },
  {
    id: "categories",
    label: "Categories",
    icon: Tags,
    rail: true,
    top: true,
    drawer: true,
    isVisible: (c) => (c.role === "supervisor" || c.role === "manager" || c.role === "admin") && !!c.boardId,
    href: (c) => (c.boardId ? `/boards/${c.boardId}/categories` : null),
  },
  {
    id: "team",
    label: "Team",
    icon: Users,
    rail: true,
    top: true,
    drawer: true,
    isVisible: (c) => c.role === "admin" || (signedIn(c) && !!c.boardId),
    // An Admin has no Board access by default: Team goes to the user list (SHELL-21).
    href: (c) => (c.role === "admin" ? "/admin/users" : null),
    panel: "team",
  },
];

export function itemsFor(place: "rail" | "top" | "drawer", ctx: NavContext): NavItemDef[] {
  return NAV_ITEMS.filter((i) => i[place] && i.isVisible(ctx));
}

/** Whether a route item is the current page. */
export function isActive(item: NavItemDef, ctx: NavContext, pathname: string, panel: PanelView | null): boolean {
  if (item.panel && item.href(ctx) === null) return panel === item.panel;
  const href = item.href(ctx);
  if (!href) return false;
  if (item.id === "home" || item.id === "boards") return pathname === "/boards";
  if (item.id === "board") return pathname === href;
  if (item.id === "categories") return pathname.endsWith("/categories");
  return pathname.startsWith(href);
}
