/** Server Component data access: forwards the Token cookie, redirects to login on 401. */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ACCOUNT_DISABLED, ApiError, request } from "./http";
import { routes } from "./routes";
import { TOKEN_COOKIE } from "./session";

export async function serverToken(): Promise<string | null> {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}

export async function serverGet<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
  const token = await serverToken();
  try {
    return await request<T>("GET", path, { token, query });
  } catch (err) {
    if (err instanceof ApiError && (err.httpStatus === 401 || err.code === ACCOUNT_DISABLED)) {
      const back = (await headers()).get("x-return-path");
      redirect(back ? `${routes.sessionExpired}?next=${encodeURIComponent(back)}` : routes.sessionExpired);
    }
    throw err;
  }
}
