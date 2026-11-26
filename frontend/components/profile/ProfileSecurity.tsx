"use client";

import { useState, type FormEvent } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert, BaseField, BaseInput } from "@/components/shared/BaseField";
import { formatCountdown, useCountdown } from "@/hooks/useCountdown";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { PASSWORD_MIN } from "@/lib/validation";

/** The Security tab: the current password is required, the new one is typed twice, and a notice goes to the account's email (PRF-05). */
export function ProfileSecurity() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  const left = useCountdown(wait);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const found: Record<string, string[]> = {};
    if (!current) found.current_password = ["Enter your current password."];
    if (next.length < PASSWORD_MIN) found.new_password = [`Use at least ${PASSWORD_MIN} characters.`];
    if (again !== next) found.confirm = ["The two passwords do not match."];
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      await api.auth.changePassword({ current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setAgain("");
      setNotice("Password changed. We sent a notice to your email.");
    } catch (err) {
      if (err instanceof ApiError && err.httpStatus === 429) setWait(err.retryAfter ?? 60);
      else if (err instanceof ApiError && err.details) setErrors(err.details);
      else setError(err instanceof ApiError ? err.message : "Could not change the password.");
    }
  }

  const edit = (key: string, set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    setErrors((c) => ({ ...c, [key]: [] }));
  };

  return (
    <form className="flex flex-col gap-4 rounded-ui border border-line bg-surface-raised p-surface" onSubmit={submit} noValidate aria-label="Change password">
      <h2 className="font-heading text-page-title">Change password</h2>
      {error && <BaseAlert>{error}</BaseAlert>}
      {left > 0 && <BaseAlert>Too many attempts. Try again in {formatCountdown(left)}.</BaseAlert>}
      <div role="status" aria-live="polite">
        {notice && <BaseAlert tone="info">{notice}</BaseAlert>}
      </div>
      <BaseField label="Current password" htmlFor="current_password" errors={errors.current_password}>
        <BaseInput id="current_password" type="password" autoComplete="current-password" value={current} onChange={edit("current_password", setCurrent)} aria-invalid={errors.current_password?.length ? true : undefined} />
      </BaseField>
      <BaseField label="New password" htmlFor="new_password" errors={errors.new_password}>
        <BaseInput id="new_password" type="password" autoComplete="new-password" value={next} onChange={edit("new_password", setNext)} aria-invalid={errors.new_password?.length ? true : undefined} />
      </BaseField>
      <BaseField label="Confirm new password" htmlFor="confirm_password" errors={errors.confirm}>
        <BaseInput id="confirm_password" type="password" autoComplete="new-password" value={again} onChange={edit("confirm", setAgain)} aria-invalid={errors.confirm?.length ? true : undefined} />
      </BaseField>
      <div>
        <BaseButton type="submit" disabled={left > 0}>
          Change password
        </BaseButton>
      </div>
    </form>
  );
}
