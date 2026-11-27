export function isUsableToken(token: string | null | undefined, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => !p)) return false;
  try {
    const claims = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof claims.sub === "string" && typeof claims.role === "string" && typeof claims.exp === "number" && claims.exp > nowSeconds;
  } catch {
    return false;
  }
}
