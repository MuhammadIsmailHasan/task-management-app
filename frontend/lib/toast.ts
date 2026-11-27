import { toast as sonner } from "sonner";

export const toast = {
  success: (message: string) => void sonner.success(message),
  error: (message: string) => void sonner.error(message || "Something went wrong. Try again."),
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
  toast.error(outcome.message);
}
