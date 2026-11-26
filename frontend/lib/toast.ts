import { toast as sonner } from "sonner";

/** The only way to raise a Toast (TOAST-01): components never import `sonner` directly. */
export const toast = {
  success: (message: string) => void sonner.success(message),
  error: (message: string) => void sonner.error(message || "Something went wrong. Try again."),
};

/** While an action runs inside a ConfirmDialog its error stays in the dialog, so the error Toast is held back (TOAST-06). */
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

/** Calls that report nothing on success: sign-in and out, reads of state, auto-save edits, checks, moves, reads marked (TOAST-07). */
const QUIET_SUCCESS: Array<[RegExp, string?]> = [
  [/^\/auth\//],
  [/^\/notifications/],
  [/^\/cards\/[^/]+$/, "PATCH"],
  [/^\/subtasks\/[^/]+$/, "PATCH"],
  [/^\/cards\/[^/]+\/move$/],
  [/^\/comments\/[^/]+\/priority$/],
  [/^\/cards\/[^/]+\/unarchive$/], // the Archived page names the Column itself (VIEW-07)
];
/** Calls whose failure the page already shows next to its form. */
const OWN_ERRORS: RegExp[] = [/^\/auth\/(login|register|verify|resend-verification)$/];

export function quietSuccess(method: string, path: string): boolean {
  return QUIET_SUCCESS.some(([re, m]) => re.test(path) && (!m || m === method));
}

/** Raised by `request` for every write (GET never toasts). `details` marks a field error, which stays by its field. */
export function reportResult(method: string, path: string, outcome: { ok: true; message?: string } | { ok: false; message: string; httpStatus: number; hasDetails: boolean }) {
  if (method === "GET") return;
  if (outcome.ok) {
    if (outcome.message && outcome.message !== "OK" && !quietSuccess(method, path)) toast.success(outcome.message);
    return;
  }
  if (outcome.httpStatus === 401 || outcome.hasDetails || errorToastHeld() || OWN_ERRORS.some((re) => re.test(path))) return;
  toast.error(outcome.message);
}
