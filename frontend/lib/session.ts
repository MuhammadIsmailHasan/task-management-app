import type { Role, User } from "./types";

export const TOKEN_COOKIE = "kanban_token";
const USER_KEY = "kanban_user";

export interface Session {
  token: string;
  userId: string;
  role: Role;
  exp: number;
}

export function decodeToken(token: string): { sub: string; role: Role; exp: number } | null {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json);
    if (!claims.sub || !claims.role) return null;
    return { sub: claims.sub, role: claims.role, exp: claims.exp ?? 0 };
  } catch {
    return null;
  }
}

export function setSession(token: string, user?: User): void {
  const claims = decodeToken(token);
  const maxAge = claims ? Math.max(claims.exp - Math.floor(Date.now() / 1000), 0) : 86400;
  document.cookie = `${TOKEN_COOKIE}=${token}; Path=/app; Max-Age=${maxAge}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  if (user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
    }
  }
}

export function storeUser(user: User): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
  }
}

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${TOKEN_COOKIE}=`));
  return match ? match.slice(TOKEN_COOKIE.length + 1) : null;
}

export function getSession(): Session | null {
  const token = getToken();
  const claims = token ? decodeToken(token) : null;
  if (!token || !claims) return null;
  return { token, userId: claims.sub, role: claims.role, exp: claims.exp };
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  document.cookie = `${TOKEN_COOKIE}=; Path=/app; Max-Age=0; SameSite=Lax`;
  document.cookie = `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
  }
}
