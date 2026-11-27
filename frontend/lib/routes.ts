export const APP_BASE = "/app";

export const routes = {
  landing: "/",
  boards: `${APP_BASE}/boards`,
  dashboard: `${APP_BASE}/dashboard`,
  myTasks: `${APP_BASE}/my-tasks`,
  users: `${APP_BASE}/users`,
  profile: `${APP_BASE}/profile`,
  login: `${APP_BASE}/login`,
  register: `${APP_BASE}/register`,
  verify: `${APP_BASE}/verify`,
  sessionExpired: `${APP_BASE}/session-expired`,
} as const;

export const BOARDS_QUERY_KEY = "rb:boards-query";

export type BoardView = "list" | "calendar" | "archived";

const query = (params: Record<string, string | undefined> | undefined) => {
  const entries = Object.entries(params ?? {}).filter((e): e is [string, string] => e[1] !== undefined && e[1] !== "");
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
};

export const boardPath = (slug: string, params?: Record<string, string | undefined>) => `${APP_BASE}/b/${slug}${query(params)}`;
export const boardViewPath = (slug: string, view: BoardView, params?: Record<string, string | undefined>) => `${APP_BASE}/b/${slug}/${view}${query(params)}`;
export const cardPath = (slug: string, cardId: string) => boardPath(slug, { card: cardId });
export const boardByIdPath = (id: string) => `${APP_BASE}/boards/${id}`;
export const invitePath = (token: string) => `${APP_BASE}/invite/${token}`;
export const sharedPath = (token: string) => `${APP_BASE}/shared/${token}`;
export const loginPath = (next?: string | null) => `${routes.login}${query({ next: next ?? undefined })}`;
export const registerPath = (next?: string | null) => `${routes.register}${query({ next: next ?? undefined })}`;

export const homeFor = (role: string | undefined) => (role === "member" ? routes.myTasks : role ? routes.dashboard : routes.boards);

export function parentOf(pathname: string, role: string | undefined): { href: string; label: string } | null {
  if (pathname.startsWith(`${APP_BASE}/b/`) || pathname.startsWith(`${APP_BASE}/invite/`)) return { href: routes.boards, label: "Boards" };
  if (pathname === routes.profile) {
    const home = homeFor(role);
    return { href: home, label: home === routes.myTasks ? "My tasks" : home === routes.dashboard ? "Dashboard" : "Boards" };
  }
  return null;
}

const LEGACY: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/boards\/?$/, () => routes.boards],
  [/^\/boards\/([^/]+)\/?$/, (m) => boardByIdPath(m[1])],
  [/^\/dashboard\/?$/, () => routes.dashboard],
  [/^\/admin\/users\/?$/, () => routes.users],
  [/^\/profile\/?$/, () => routes.profile],
  [/^\/login\/?$/, () => routes.login],
  [/^\/register\/?$/, () => routes.register],
  [/^\/invite\/([^/]+)\/?$/, (m) => invitePath(m[1])],
  [/^\/shared\/([^/]+)\/?$/, (m) => sharedPath(m[1])],
  [/^\/session-expired\/?$/, () => routes.sessionExpired],
];

export function legacyRedirect(pathname: string, search: string): string | null {
  for (const [re, to] of LEGACY) {
    const m = pathname.match(re);
    if (m) return `${to(m)}${search}`;
  }
  return null;
}

const GUARDED = [routes.boards, routes.dashboard, routes.myTasks, routes.users, routes.profile];
const GUARDED_PREFIXES = [`${APP_BASE}/b/`, `${APP_BASE}/invite/`];
export const isGuardedPath = (pathname: string) => GUARDED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || GUARDED_PREFIXES.some((p) => pathname.startsWith(p) && pathname.length > p.length);
export const isReturnablePath = isGuardedPath;
