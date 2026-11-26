"use client";

import { AtSign, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert, BaseField, BaseInput } from "@/components/shared/BaseField";
import { formatCountdown, useCountdown } from "@/hooks/useCountdown";
import { api } from "@/lib/api";
import { ACCOUNT_DISABLED, ACCOUNT_NOT_ACTIVATED, ApiError } from "@/lib/http";
import { safeReturnPath } from "@/lib/return-path";
import { loginPath, registerPath, routes } from "@/lib/routes";
import { rememberPending } from "@/components/auth/VerifyView";
import { setSession } from "@/lib/session";
import { AUTH_FIELD_ORDER, isEmail, isUsername, validateAuth } from "@/lib/validation";

type Mode = "login" | "register";

const COPY = {
  login: { title: "Welcome back", sub: "Log in to your boards.", cta: "Log in", other: "No account yet?", link: routes.register, linkText: "Register" },
  register: { title: "Create your account", sub: "It takes a minute.", cta: "Register", other: "Already registered?", link: routes.login, linkText: "Log in" },
} as const;

const ICON: Record<keyof Values, typeof User> = { full_name: User, identifier: AtSign, username: AtSign, email: Mail, password: Lock };

const GENERIC_LOGIN_ERROR = "Invalid username, email or password.";
type Values = { full_name: string; identifier: string; username: string; email: string; password: string };

/** One form for both modes. Login takes a Username or Email; register takes both separately (Decisions M and N). */
export function AuthForm({ mode, next }: { mode: Mode; next?: string | null }) {
  const router = useRouter();
  const copy = COPY[mode];
  const [values, setValues] = useState<Values>({ full_name: "", identifier: "", username: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const left = useCountdown(wait);
  const blocked = left > 0;
  // A blocked availability check stops the on-blur checks until the wait ends (Req 20.16).
  const availabilityPausedUntil = useRef(0);

  // Editing a field clears that field's error at once, and only that field's (FIX-03).
  const set = (key: keyof Values) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((cur) => {
      if (!cur[key]) return cur;
      const { [key]: _gone, ...rest } = cur;
      return rest;
    });
  };

  async function checkAvailability(field: "username" | "email") {
    const value = values[field].trim();
    const valid = field === "username" ? isUsername(value.toLowerCase()) : isEmail(value.toLowerCase());
    if (!value || !valid || Date.now() < availabilityPausedUntil.current) return;
    try {
      const result = await api.auth.availability({ [field]: value });
      if (result[field]?.available === false) {
        setErrors((e) => ({ ...e, [field]: [field === "username" ? "This username is already taken." : "This email is already registered."] }));
      }
    } catch (err) {
      if (err instanceof ApiError && err.httpStatus === 429) availabilityPausedUntil.current = Date.now() + (err.retryAfter ?? 60) * 1000;
      // any failure stays silent: the 409 on submit is authoritative
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setUnconfirmed(false);
    // Validate every field before any request, show every error, and focus the first invalid field (FIX-04).
    const found = validateAuth(mode, values);
    const first = AUTH_FIELD_ORDER.find((id) => found[id]);
    if (first) {
      setErrors(found);
      document.getElementById(first)?.focus();
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === "login"
          ? await api.auth.login({ identifier: values.identifier.trim(), password: values.password })
          : await api.auth.register({
              full_name: values.full_name,
              username: values.username.trim(),
              email: values.email.trim(),
              password: values.password,
            });
      if (mode === "register" || !result.token) {
        // no Token before the email is confirmed (ACT-02): the address and the page to come back to wait in sessionStorage, not the URL
        rememberPending(values.email.trim(), next);
        router.push(routes.verify);
        return;
      }
      setSession(result.token, result.user);
      router.push(safeReturnPath(next));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.httpStatus === 429) {
        setWait(err.retryAfter ?? 60);
      } else if (err instanceof ApiError && mode === "login" && err.httpStatus === 401) {
        setFormError(GENERIC_LOGIN_ERROR);
      } else if (err instanceof ApiError && err.code === ACCOUNT_NOT_ACTIVATED) {
        setFormError(err.message);
        setUnconfirmed(true);
      } else if (err instanceof ApiError && err.code === ACCOUNT_DISABLED) {
        setFormError(err.message); // no resend: an Admin turned the account off
      } else if (err instanceof ApiError) {
        // field errors come from error.details; anything else is a form-level message
        if (err.details && Object.keys(err.details).length) {
          setErrors(err.details);
          const firstServer = AUTH_FIELD_ORDER.find((id) => err.details?.[id]);
          if (firstServer) document.getElementById(firstServer)?.focus();
        }
        else setFormError(err.message);
      } else {
        setFormError("Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const field = (id: keyof Values, label: string, opts: { type?: string; autoComplete?: string; onBlur?: () => void } = {}) => {
    const Icon = ICON[id];
    const password = id === "password";
    return (
      <BaseField label={label} htmlFor={id} errors={errors[id]}>
        <div className="relative">
          <Icon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-icon -translate-y-1/2 text-ink-muted" />
          <BaseInput
            id={id}
            name={id}
            type={password && reveal ? "text" : (opts.type ?? "text")}
            autoComplete={opts.autoComplete}
            className={password ? "pr-12 pl-12" : "pl-12"}
            value={values[id]}
            onChange={set(id)}
            onBlur={opts.onBlur}
            aria-invalid={errors[id] ? true : undefined}
            aria-describedby={errors[id] ? `${id}-error` : undefined}
          />
          {password && (
            <BaseButton variant="ghost" size="sm" className="absolute top-1/2 right-2 size-control-sm -translate-y-1/2 px-0" aria-label={reveal ? "Hide password" : "Show password"} onClick={() => setReveal((r) => !r)}>
              {reveal ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </BaseButton>
          )}
        </div>
      </BaseField>
    );
  };

  return (
    <>
      <nav aria-label="Sign in or create an account" className="mb-8 flex w-fit gap-1 rounded-field bg-surface p-1 text-sm font-medium">
        <Link href={loginPath(next)} aria-current={mode === "login" ? "page" : undefined} className={`rounded-sm px-4 py-2 no-underline ${mode === "login" ? "bg-surface-raised text-ink shadow-card" : "text-ink-muted"}`}>
          Sign in
        </Link>
        <Link href={registerPath(next)} aria-current={mode === "register" ? "page" : undefined} className={`rounded-sm px-4 py-2 no-underline ${mode === "register" ? "bg-surface-raised text-ink shadow-card" : "text-ink-muted"}`}>
          Create account
        </Link>
      </nav>
      <h1 className="font-heading text-xl">{copy.title}</h1>
      <p className="mt-1 mb-6 text-sm text-ink-muted">{copy.sub}</p>
      <form method="post" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {formError && <BaseAlert>{formError}</BaseAlert>}
        {unconfirmed && (
          <Link href={routes.verify} className="-mt-2 text-sm font-semibold">
            Resend confirmation email
          </Link>
        )}
        {blocked && <BaseAlert>Too many attempts. Try again in {formatCountdown(left)}.</BaseAlert>}
        {mode === "register" && field("full_name", "Full name", { autoComplete: "name" })}
        {mode === "login" && field("identifier", "Username or email", { autoComplete: "username" })}
        {mode === "register" && field("username", "Username", { autoComplete: "username", onBlur: () => void checkAvailability("username") })}
        {mode === "register" && field("email", "Email", { type: "email", autoComplete: "email", onBlur: () => void checkAvailability("email") })}
        {field("password", "Password", { type: "password", autoComplete: mode === "login" ? "current-password" : "new-password" })}
        <BaseButton type="submit" variant="dark" block className="min-h-control rounded-field shadow-modal" disabled={busy || blocked}>
          {busy ? "Please wait…" : copy.cta}
        </BaseButton>
      </form>
    </>
  );
}
