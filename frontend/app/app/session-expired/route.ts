import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/lib/return-path";
import { TOKEN_COOKIE } from "@/lib/session";
import { routes } from "@/lib/routes";

export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const query = next && safeReturnPath(next) === next ? `?${new URLSearchParams({ next })}` : "";
  const response = new NextResponse(null, { status: 307, headers: { Location: `${routes.login}${query}` } });
  response.cookies.delete(TOKEN_COOKIE);
  return response;
}
