import { reportResult } from "@/lib/toast";

/** One place that unwraps the { status, message, data } envelope and throws ApiError on failure. */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api").replace(/\/$/, "");

/**
 * Where `request` sends a call. The server uses INTERNAL_API_URL when it is set. The browser uses API_URL, resolved
 * against the page's origin when it is relative (`/api`), so one build works on any host (Requirement 33).
 */
function apiBase(): string {
  const inBrowser = typeof window !== "undefined";
  const internal = inBrowser ? undefined : process.env.INTERNAL_API_URL;
  if (internal) return internal.replace(/\/$/, "");
  if (!API_URL.startsWith("/")) return API_URL;
  if (inBrowser) return `${window.location.origin}${API_URL}`;
  throw new Error("INTERNAL_API_URL is required on the server when NEXT_PUBLIC_API_URL is relative");
}

/** A URL the browser can open for a backend path such as /api/users/{id}/avatar/file. Never the internal URL. */
export function apiAsset(path: string): string {
  return path.startsWith("/") && !API_URL.startsWith("/") ? `${new URL(API_URL).origin}${path}` : path;
}

export type Details = Record<string, string[]>;

/** The two refusals of sign-in after a right password, and of every request from a deactivated account (ACT-01, ADM-07). */
export const ACCOUNT_NOT_ACTIVATED = "ACCOUNT_NOT_ACTIVATED";
export const ACCOUNT_DISABLED = "ACCOUNT_DISABLED";

export class ApiError extends Error {
  constructor(
    public httpStatus: number,
    public code: string,
    message: string,
    public details?: Details,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  token?: string | null;
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | undefined | null>;
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${apiBase()}${path}`);
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, cache: "no-store" });
  } catch {
    reportResult(method, path, { ok: false, message: "Cannot reach the server. Check your connection and try again.", httpStatus: 0, hasDetails: false });
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server");
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new ApiError(res.status, "ERROR", res.statusText || "Unexpected response");
  }
  const env = payload as {
    status?: boolean;
    message?: string;
    data?: T;
    error?: { code?: string; details?: Record<string, unknown> };
  };
  if (env.status === true) {
    reportResult(method, path, { ok: true, message: env.message });
    return env.data as T;
  }
  const raw = env.error?.details ?? {};
  const retry = Number(raw.retry_after ?? res.headers?.get?.("Retry-After"));
  const fields: Details = {};
  for (const [key, value] of Object.entries(raw)) if (Array.isArray(value)) fields[key] = value.map(String);
  reportResult(method, path, { ok: false, message: env.message ?? "", httpStatus: res.status, hasDetails: Object.keys(fields).length > 0 });
  throw new ApiError(
    res.status,
    env.error?.code ?? "ERROR",
    env.message ?? "Request failed",
    Object.keys(fields).length ? fields : undefined,
    Number.isFinite(retry) && retry > 0 ? retry : undefined,
  );
}
