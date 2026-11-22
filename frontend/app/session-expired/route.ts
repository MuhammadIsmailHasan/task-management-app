import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/lib/return-path";
import { TOKEN_COOKIE } from "@/lib/session";

/** Landing for a Token the Backend rejected: drop the cookie, then go to /login (never anywhere else, Req 1.59). */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const query = next && safeReturnPath(next) === next ? `?${new URLSearchParams({ next })}` : "";
  // Relative on purpose: behind a proxy `request.url` holds the server's own address, not the public one.
  const response = new NextResponse(null, { status: 307, headers: { Location: `/login${query}` } });
  response.cookies.delete(TOKEN_COOKIE);
  return response;
}
