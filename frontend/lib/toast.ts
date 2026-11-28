import { toast as sonner } from "sonner";

const WARNING_STATUSES: readonly number[] = [403, 409, 429];
const FALLBACK_ERROR = "Something went wrong. Try again.";

export const toast = {
  success: (message: string) => void sonner.success(message),
  error: (message: string) => void sonner.error(message || FALLBACK_ERROR),
  warning: (message: string) => void sonner.warning(message, { id: message }),
  failure: (message: string, httpStatus?: number) => {
    const text = message || FALLBACK_ERROR;
    const show = httpStatus !== undefined && WARNING_STATUSES.includes(httpStatus) ? sonner.warning : sonner.error;
    show(text, { id: text });
  },
};

let held = 0;
export const errorToastHeld = () => held > 0;
export async function withoutErrorToast<T>(run: () => Promise<T>): Promise<T> {
  held += 1;
  try {
    return await run();
  } finally {
    held -= 1;
  }
}

const QUIET_SUCCESS: Array<[RegExp, string?]> = [
  [/^\/auth\//],
  [/^\/notifications/],
  [/^\/cards\/[^/]+$/, "PATCH"],
  [/^\/subtasks\/[^/]+$/, "PATCH"],
  [/^\/cards\/[^/]+\/move$/],
  [/^\/comments\/[^/]+\/priority$/],
  [/^\/cards\/[^/]+\/unarchive$/],
];
const OWN_ERRORS: RegExp[] = [/^\/auth\/(login|register|verify|resend-verification)$/];

export function quietSuccess(method: string, path: string): boolean {
  return QUIET_SUCCESS.some(([re, m]) => re.test(path) && (!m || m === method));
}

export function reportResult(method: string, path: string, outcome: { ok: true; message?: string } | { ok: false; message: string; httpStatus: number; hasDetails: boolean }) {
  if (method === "GET") return;
  if (outcome.ok) {
    if (outcome.message && outcome.message !== "OK" && !quietSuccess(method, path)) toast.success(outcome.message);
    return;
  }
  if (outcome.httpStatus === 401 || outcome.hasDetails || errorToastHeld() || OWN_ERRORS.some((re) => re.test(path))) return;
  toast.failure(outcome.message, outcome.httpStatus);
}
