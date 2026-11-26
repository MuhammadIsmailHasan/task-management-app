import { CalendarDays, History, LayoutDashboard, ListChecks, ListTodo, Share2, SquareKanban, Tags, UserCog, Users, type LucideIcon } from "lucide-react";
import { APP_BASE, boardPath, boardViewPath, routes } from "@/lib/routes";
import type { Role } from "@/lib/types";
import type { PanelView } from "./ShellContext";

/** What decides whether an item shows (NAV-01, NAV-04, NAV-05). */
export interface NavContext {
  role: Role | undefined;
  boardOpen: boolean;
  /** The viewer is the Board_Owner of the open Board. */
  isOwner: boolean;
}

interface BaseItem {
  id: string;
  label: string;
  icon: LucideIcon;
  isVisible: (ctx: NavContext) => boolean;
}

/** A global item of the Sidebar: always a route. */
export interface SidebarItem extends BaseItem {
  href: string;
}

/** A board item of the Top_Menu: a route, a Side_Panel view, or the Share_Modal. */
export interface TopMenuItem extends BaseItem {
  /** The Board's path for a route item; `slug` is the open Board's slug. */
  href?: (slug: string) => string;
  panel?: PanelView;
  share?: true;
}

const signedIn = (c: NavContext) => !!c.role;
const staff = (c: NavContext) => c.role === "supervisor" || c.role === "manager" || c.role === "admin";

/** Global places (NAV-01). Dashboard: Supervisor, Manager, Admin. My Tasks: Member and Supervisor; a Manager or Admin cannot be an assignee (TASK-06). */
export const sidebarItems: SidebarItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: routes.dashboard, isVisible: staff },
  { id: "my-tasks", label: "My Tasks", icon: ListTodo, href: routes.myTasks, isVisible: (c) => c.role === "member" || c.role === "supervisor" },
  { id: "boards", label: "Boards", icon: SquareKanban, href: routes.boards, isVisible: signedIn },
  { id: "users", label: "Users", icon: UserCog, href: routes.users, isVisible: (c) => c.role === "admin" },
];

/** The places of the open Board (NAV-04). Nothing here repeats a Sidebar item (NAV-05). */
export const topMenuItems: TopMenuItem[] = [
  { id: "board", label: "Board", icon: SquareKanban, href: (slug) => boardPath(slug), isVisible: (c) => c.boardOpen },
  { id: "list", label: "List", icon: ListChecks, href: (slug) => boardViewPath(slug, "list"), isVisible: (c) => c.boardOpen },
  { id: "calendar", label: "Calendar", icon: CalendarDays, href: (slug) => boardViewPath(slug, "calendar"), isVisible: (c) => c.boardOpen },
  { id: "activity", label: "Activity", icon: History, panel: "activity", isVisible: (c) => c.boardOpen },
  { id: "members", label: "Members", icon: Users, panel: "members", isVisible: (c) => c.boardOpen },
  { id: "categories", label: "Categories", icon: Tags, panel: "categories", isVisible: (c) => c.boardOpen && (c.role === "supervisor" || c.role === "manager" || c.role === "admin") },
  { id: "share", label: "Share", icon: Share2, share: true, isVisible: (c) => c.boardOpen && (c.role === "manager" || c.role === "admin" || c.isOwner) },
];

export const sidebarFor = (ctx: NavContext) => sidebarItems.filter((i) => i.isVisible(ctx));
export const topMenuFor = (ctx: NavContext) => topMenuItems.filter((i) => i.isVisible(ctx));

/** Whether a Sidebar route is the current page. */
export const isSidebarActive = (item: SidebarItem, pathname: string) =>
  item.id === "boards" ? pathname === routes.boards || pathname.startsWith(`${routes.boards}/`) || pathname.startsWith(`${APP_BASE}/b/`) : pathname === item.href || pathname.startsWith(`${item.href}/`);

/** Whether a Top_Menu item is current: a route item by the path, a panel item by the open view. */
export function isTopMenuActive(item: TopMenuItem, slug: string | null, pathname: string, panel: PanelView | null, shareOpen: boolean): boolean {
  if (item.panel) return panel === item.panel;
  if (item.share) return shareOpen;
  if (!item.href || !slug) return false;
  return pathname === item.href(slug);
}
