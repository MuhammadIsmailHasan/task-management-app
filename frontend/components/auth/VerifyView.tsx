"use client";

import { MailCheck, MailWarning } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert, BaseField, BaseInput } from "@/components/shared/BaseField";
import { formatCountdown, useCountdown } from "@/hooks/useCountdown";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { safeReturnPath } from "@/lib/return-path";
import { loginPath, routes } from "@/lib/routes";
import { isEmail } from "@/lib/validation";

/** Where the register form left the address and the page to come back to (kept out of the URL, ACT-07 and ACT-12). */
export const PENDING_KEY = "revoboard.pending-activation";

export function rememberPending(email: string, next?: string | null) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email, next: next ? safeReturnPath(next) : null }));
  } catch {
    /* storage unavailable: the page asks for the address instead */
  }
}

function readPending(): { email: string | null; next: string | null } {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return { email: typeof parsed?.email === "string" ? parsed.email : null, next: typeof parsed?.next === "string" ? safeReturnPath(parsed.next) : null };
  } catch {
    return { email: null, next: null };
  }
}

type State = { kind: "wait" } | { kind: "working" } | { kind: "done"; purpose: "verify_email" | "change_email" } | { kind: "failed"; expired: boolean };

/** "Check your email" after register, and the page the emailed link opens (Requirement 59, ACT-07). */
export function VerifyView({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? { kind: "working" } : { kind: "wait" });
  const [pending, setPending] = useState<{ email: string | null; next: string | null }>({ email: null, next: null });
  const [typed, setTyped] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  const left = useCountdown(wait);
  const ran = useRef(false);

  useEffect(() => {
    setPending(readPending());
  }, []);

  // The link's token is read once, sent once, and removed from the address bar at once (the token must not leak).
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    window.history.replaceState(null, "", routes.verify);
    api.auth
      .verify(token)
      .then((r) => setState({ kind: "done", purpose: r.purpose }))
      .catch((err) => setState({ kind: "failed", expired: err instanceof ApiError && err.code === "TOKEN_EXPIRED" }));
  }, [token]);

  const email = pending.email ?? (isEmail(typed.trim().toLowerCase()) ? typed.trim() : null);

  async function resend(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setSent(false);
    if (!email) return setError("Enter the email address you registered with.");
    try {
      await api.auth.resendVerification(email);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.httpStatus === 429) setWait(err.retryAfter ?? 60);
      else setError(err instanceof ApiError ? err.message : "Could not send the email. Try again.");
    }
  }

  const blocked = left > 0;
  const resendForm = (
    <form method="post" className="flex flex-col gap-3" onSubmit={resend} noValidate>
      {!pending.email && (
        <BaseField label="Email" htmlFor="verify-email" errors={undefined}>
          <BaseInput id="verify-email" type="email" autoComplete="email" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </BaseField>
      )}
      {error && <BaseAlert>{error}</BaseAlert>}
      {blocked && <BaseAlert>Too many attempts. Try again in {formatCountdown(left)}.</BaseAlert>}
      <div role="status" aria-live="polite">
        {sent && <BaseAlert tone="info">If that address needs confirming, a new link was sent.</BaseAlert>}
      </div>
      <BaseButton type="submit" variant="secondary" disabled={blocked}>
        Resend email
      </BaseButton>
    </form>
  );

  if (state.kind === "working") {
    return (
      <div role="status" className="flex flex-col gap-2">
        <h1 className="font-heading text-xl">Confirming…</h1>
        <p className="text-sm text-ink-muted">One moment while we check your link.</p>
      </div>
    );
  }

  if (state.kind === "done") {
    const changed = state.purpose === "change_email";
    return (
      <div className="flex flex-col gap-4">
        <MailCheck aria-hidden="true" className="size-icon-lg text-accent" />
        <h1 className="font-heading text-xl">{changed ? "Email address updated" : "Email confirmed"}</h1>
        <p className="text-sm text-ink-muted">{changed ? "Your new address is now the one you sign in and get notices with." : "Your account is ready. Sign in to start."}</p>
        <Link href={loginPath(pending.next)} className="inline-flex min-h-control items-center justify-center rounded-field bg-brand px-4 text-sm font-medium text-on-brand no-underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (state.kind === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <MailWarning aria-hidden="true" className="size-icon-lg text-danger" />
        <h1 className="font-heading text-xl">{state.expired ? "This link has expired" : "This link is not valid"}</h1>
        <p className="text-sm text-ink-muted">{state.expired ? "Links work for 24 hours." : "It may have been used already."} Send a new link to your email.</p>
        <h2 className="text-sm font-semibold">Send a new link</h2>
        {resendForm}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <MailCheck aria-hidden="true" className="size-icon-lg text-accent" />
      <h1 className="font-heading text-xl">Check your email</h1>
      <p className="text-sm text-ink-muted">
        We sent a link to confirm your address{pending.email ? <> to <strong className="text-ink break-all">{pending.email}</strong></> : null}. It expires in 24 hours.
      </p>
      {resendForm}
      <Link href={loginPath(pending.next)} className="text-sm font-semibold">
        Back to sign in
      </Link>
    </div>
  );
}
