import { isReturnablePath, routes } from "@/lib/routes";
import type { Role } from "@/lib/types";

export const DEFAULT_RETURN: string = routes.boards;

export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return DEFAULT_RETURN;
  const path = raw.split(/[?#]/)[0];
  return isReturnablePath(path) ? raw : DEFAULT_RETURN;
}

export function loginDestination(next: string | null | undefined, role: Role | undefined): string {
  if (next && safeReturnPath(next) === next) return next;
  return role && role !== "member" ? routes.dashboard : routes.boards;
}
