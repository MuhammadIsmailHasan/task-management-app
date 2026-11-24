"use client";

import { useState, type FormEvent } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert, BaseField, BaseInput } from "@/components/shared/BaseField";
import { formatCountdown, useCountdown } from "@/hooks/useCountdown";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { storeUser } from "@/lib/session";
import type { User } from "@/lib/types";
import { AvatarUploader } from "./AvatarUploader";

/** The Profile_Page: editable full name, avatar, read-only Username and Email, and a change-password form. */
export function ProfileForm({ initial }: { initial: User }) {
  const [user, setUser] = useState(initial);
  const [fullName, setFullName] = useState(initial.full_name);
  const [nameErrors, setNameErrors] = useState<string[] | undefined>();
  const [nameNotice, setNameNotice] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string[]>>({});
  const [pwNotice, setPwNotice] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  const left = useCountdown(wait);

  function update(fresh: User) {
    setUser(fresh);
    setFullName(fresh.full_name);
    storeUser(fresh);
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setNameErrors(undefined);
    setNameNotice(null);
    try {
      update(await api.auth.updateMe({ full_name: fullName }));
      setNameNotice("Name saved.");
    } catch (err) {
      setNameErrors(err instanceof ApiError ? (err.details?.full_name ?? [err.message]) : ["Could not save."]);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwErrors({});
    setPwError(null);
    setPwNotice(null);
    try {
      await api.auth.changePassword({ current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setPwNotice("Password changed.");
    } catch (err) {
      if (err instanceof ApiError && err.httpStatus === 429) setWait(err.retryAfter ?? 60);
      else if (err instanceof ApiError && err.details) setPwErrors(err.details);
      else setPwError(err instanceof ApiError ? err.message : "Could not change the password.");
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 p-4 lg:p-8">
      <h1 className="font-heading text-title">Profile</h1>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
      <section aria-label="Picture" className="rounded-frame border border-line bg-surface-raised p-6 shadow-card">
        <AvatarUploader user={user} onChange={update} />
      </section>

      <form className="flex flex-col gap-4 rounded-frame border border-line bg-surface-raised p-6 shadow-card" onSubmit={saveName} noValidate aria-label="Account details">
        <BaseField label="Full name" htmlFor="full_name" errors={nameErrors}>
          <BaseInput id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={nameErrors ? true : undefined} />
        </BaseField>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-date-label text-ink-muted">Username</dt>
            <dd>{user.username}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-date-label text-ink-muted">Email</dt>
            <dd className="break-all">{user.email}</dd>
          </div>
        </dl>
        {nameNotice && <BaseAlert tone="info">{nameNotice}</BaseAlert>}
        <div>
          <BaseButton type="submit">Save</BaseButton>
        </div>
      </form>
      </div>

      <form className="flex flex-col gap-4 rounded-frame border border-line bg-surface-raised p-6 shadow-card" onSubmit={changePassword} noValidate aria-label="Change password">
        <h2 className="font-heading text-page-title">Change password</h2>
        {pwError && <BaseAlert>{pwError}</BaseAlert>}
        {left > 0 && <BaseAlert>Too many attempts. Try again in {formatCountdown(left)}.</BaseAlert>}
        {pwNotice && <BaseAlert tone="info">{pwNotice}</BaseAlert>}
        <BaseField label="Current password" htmlFor="current_password" errors={pwErrors.current_password}>
          <BaseInput id="current_password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={pwErrors.current_password ? true : undefined} />
        </BaseField>
        <BaseField label="New password" htmlFor="new_password" errors={pwErrors.new_password}>
          <BaseInput id="new_password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={pwErrors.new_password ? true : undefined} />
        </BaseField>
        <div>
          <BaseButton type="submit" disabled={left > 0}>
            Change password
          </BaseButton>
        </div>
      </form>
      </div>
    </div>
  );
}
