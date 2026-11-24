import { NextResponse, type NextRequest } from "next/server";
import { routeRequest, resolveHost } from "@/lib/host";
import { readOrigins } from "@/lib/origins";
import { isUsableToken } from "@/lib/session-token";
import { TOKEN_COOKIE } from "@/lib/session";

const PROTECTED = ["/boards", "/dashboard", "/profile", "/admin", "/invite"];
const isProtected = (path: string) => PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Host routing first (Requirement 42): the Site_Host serves the landing page and sends every other path to the
 * App_Host; then the route guard (Decisions P and T) for the App_Host. No cookie, or one that cannot be used,
 * redirects to /login with a safe `next` and removes the stale cookie. This check is optimistic; the Backend stays the
 * authority (a revoked or forged Token that still decodes meets a 401, which lands on /session-expired).
 */
export function proxy(request: NextRequest) {
  const { siteUrl, appUrl } = readOrigins();
  const { pathname, search } = request.nextUrl;
  const headers = { host: request.headers.get("host"), forwardedHost: request.headers.get("x-forwarded-host") };
  const route = routeRequest({ ...headers, pathname, search }, { siteUrl, appUrl, nodeEnv: process.env.NODE_ENV });
  const onApp = resolveHost(headers, siteUrl) === "app";

  if (route.kind === "notFound") return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  if (route.kind === "redirect") return NextResponse.redirect(route.url, route.status);
  if (route.kind === "rewrite") return NextResponse.rewrite(new URL(route.path, request.url));

  let response: NextResponse;
  if (onApp && isProtected(pathname)) {
    const token = request.cookies.get(TOKEN_COOKIE)?.value;
    if (isUsableToken(token)) {
      const forwarded = new Headers(request.headers);
      forwarded.set("x-return-path", pathname + search);
      response = NextResponse.next({ request: { headers: forwarded } });
    } else {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", pathname + search);
      response = NextResponse.redirect(url);
      if (token !== undefined) response.cookies.delete(TOKEN_COOKIE);
    }
  } else {
    response = NextResponse.next();
  }
  // The app is private: no search engine indexes any App_Host page (LAND-14).
  if (onApp) response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"] };
