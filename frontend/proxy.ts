import { NextResponse, type NextRequest } from "next/server";
import { APP_BASE, isGuardedPath, legacyRedirect, loginPath } from "@/lib/routes";
import { isUsableToken } from "@/lib/session-token";
import { TOKEN_COOKIE } from "@/lib/session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const legacy = legacyRedirect(pathname, search);
  if (legacy) return NextResponse.redirect(new URL(legacy, request.url), 308);

  const onApp = pathname === APP_BASE || pathname.startsWith(`${APP_BASE}/`);
  let response: NextResponse;
  if (onApp && isGuardedPath(pathname)) {
    const token = request.cookies.get(TOKEN_COOKIE)?.value;
    if (isUsableToken(token)) {
      const forwarded = new Headers(request.headers);
      forwarded.set("x-return-path", pathname + search);
      response = NextResponse.next({ request: { headers: forwarded } });
    } else {
      response = NextResponse.redirect(new URL(loginPath(pathname + search), request.url));
      if (token !== undefined) response.cookies.delete({ name: TOKEN_COOKIE, path: APP_BASE });
    }
  } else {
    response = NextResponse.next();
  }
  if (onApp) response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|robots.txt|sitemap.xml).*)"] };
