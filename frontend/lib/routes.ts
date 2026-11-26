/**
 * Every page path of the product, built in one place (Requirement 46, PATH-10). Components never write `/app/...`
 * by hand. The Landing_Page is `/`; every other page lives under `/app` (Decision AZ). API paths are not here:
 * they go through `lib/api.ts`.
 */
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

export type BoardView = "list" | "calendar" | "archived";

const query = (params: Record<string, string | undefined> | undefined) => {
  const entries = Object.entries(params ?? {}).filter((e): e is [string, string] => e[1] !== undefined && e[1] !== "");
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
};

/** A Board by its slug: `/app/b/{slug}`. */
export const boardPath = (slug: string, params?: Record<string, string | undefined>) => `${APP_BASE}/b/${slug}${query(params)}`;
/** A view of a Board: `/app/b/{slug}/list`, `/calendar`, or `/archived`. */
export const boardViewPath = (slug: string, view: BoardView, params?: Record<string, string | undefined>) => `${APP_BASE}/b/${slug}/${view}${query(params)}`;
/** A Card opened over its Board. */
export const cardPath = (slug: string, cardId: string) => boardPath(slug, { card: cardId });
/** The redirect-only route that turns a Board id into its slug URL (PATH-08). */
export const boardByIdPath = (id: string) => `${APP_BASE}/boards/${id}`;
export const invitePath = (token: string) => `${APP_BASE}/invite/${token}`;
export const sharedPath = (token: string) => `${APP_BASE}/shared/${token}`;
/** The sign-in page, with the page to come back to (checked by `safeReturnPath`). */
export const loginPath = (next?: string | null) => `${routes.login}${query({ next: next ?? undefined })}`;
export const registerPath = (next?: string | null) => `${routes.register}${query({ next: next ?? undefined })}`;

/** The V16 paths and where each now lives; answered with HTTP 308 and the query kept (PATH-08). */
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

/** Page paths that need a signed-in user; the proxy sends anyone else to the sign-in page (PATH-05). */
const GUARDED = [routes.boards, routes.dashboard, routes.myTasks, routes.users, routes.profile];
/** These only exist with something after them (`/app/b/{slug}`, `/app/invite/{token}`), so the bare prefix is not a page. */
const GUARDED_PREFIXES = [`${APP_BASE}/b/`, `${APP_BASE}/invite/`];
export const isGuardedPath = (pathname: string) => GUARDED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || GUARDED_PREFIXES.some((p) => pathname.startsWith(p) && pathname.length > p.length);
/** Paths a `next` value may point at: the guarded ones. */
export const isReturnablePath = isGuardedPath;
