/** A same-site path that is safe to return to after sign-in; anything else becomes /boards (Decision T). */
export const DEFAULT_RETURN = "/boards";
const GUARDED = ["/boards", "/dashboard", "/profile", "/admin", "/invite"];

export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return DEFAULT_RETURN;
  const path = raw.split(/[?#]/)[0];
  return GUARDED.some((p) => path === p || path.startsWith(`${p}/`)) ? raw : DEFAULT_RETURN;
}
