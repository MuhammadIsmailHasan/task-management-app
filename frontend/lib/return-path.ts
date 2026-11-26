import { isReturnablePath, routes } from "@/lib/routes";

/** A same-site path that is safe to return to after sign-in; anything else becomes the Boards page (Decision T, PATH-05). */
export const DEFAULT_RETURN: string = routes.boards;

export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return DEFAULT_RETURN;
  const path = raw.split(/[?#]/)[0];
  return isReturnablePath(path) ? raw : DEFAULT_RETURN;
}
