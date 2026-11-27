"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert, BaseField, BaseInput } from "@/components/shared/BaseField";
import { BaseSwitch } from "@/components/shared/BaseSwitch";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { api, type ProfilePatch } from "@/lib/api";
import { ApiError } from "@/lib/http";
import type { User } from "@/lib/types";
import { isEmail, isUsername } from "@/lib/validation";
import { AvatarUploader } from "./AvatarUploader";

const CHECK_DELAY = 400;

export function ProfileAbout({ user, onChange }: { user: User; onChange: (fresh: User) => void }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);
  const [wantAvailable, setWantAvailable] = useState(user.is_available !== false);
  const checkId = useRef(0);

  const name = username.trim().toLowerCase();
  const usernameChanged = name !== user.username;
  const emailChanged = email.trim().toLowerCase() !== user.email && email.trim().toLowerCase() !== (user.pending_email ?? "");

  useEffect(() => {
    if (!usernameChanged || !isUsername(name)) return setAvailable(null);
    const id = ++checkId.current;
    const t = setTimeout(() => {
      api.auth
        .availability({ username: name })
        .then((r) => id === checkId.current && setAvailable(r.username?.available ?? null))
        .catch(() => id === checkId.current && setAvailable(null));
    }, CHECK_DELAY);
    return () => clearTimeout(t);
  }, [name, usernameChanged]);

  const problems: Record<string, string[]> = {};
  if (!fullName.trim()) problems.full_name = ["Full name is required."];
  if (usernameChanged && !isUsername(name)) problems.username = ["Use 3 to 30 letters, numbers, dots or underscores."];
  else if (usernameChanged && available === false) problems.username = ["Username is taken"];
  if (emailChanged && !isEmail(email.trim().toLowerCase())) problems.email = ["Enter a valid email address."];
  const changed = fullName.trim() !== user.full_name || usernameChanged || emailChanged;
  const shown: Record<string, string[]> = { ...problems };
  for (const [key, list] of Object.entries(errors)) if (list.length) shown[key] = list;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!changed || Object.keys(problems).length) return setErrors(problems);
    const body: ProfilePatch = {};
    if (fullName.trim() !== user.full_name) body.full_name = fullName.trim();
    if (usernameChanged) body.username = name;
    if (emailChanged) body.email = email.trim();
    setBusy(true);
    setErrors({});
    setNotice(null);
    try {
      const fresh = await api.auth.updateMe(body);
      onChange(fresh);
      setEmail(fresh.email);
      setNotice(body.email ? "Saved. Check your new address for the confirmation link." : "Saved.");
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(err.details);
      else setErrors({ form: [err instanceof ApiError ? err.message : "Could not save."] });
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailable() {
    const fresh = await api.auth.updateMe({ is_available: wantAvailable });
    onChange(fresh);
  }

  async function resend() {
    setNotice(null);
    try {
      onChange(await api.auth.resendEmailChange());
      setNotice("A new link was sent.");
    } catch (err) {
      setErrors({ form: [err instanceof ApiError ? err.message : "Could not send the link."] });
    }
  }

  async function cancel() {
    onChange(await api.auth.cancelEmailChange());
    setNotice(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Picture" className="rounded-ui border border-line bg-surface-raised p-surface">
        <AvatarUploader user={user} onChange={onChange} />
      </section>

      <form className="flex flex-col gap-4 rounded-ui border border-line bg-surface-raised p-surface" onSubmit={save} noValidate aria-label="Account details">
        {shown.form && <BaseAlert>{shown.form[0]}</BaseAlert>}
        <BaseField label="Full name" htmlFor="full_name" errors={shown.full_name}>
          <BaseInput id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={shown.full_name ? true : undefined} />
        </BaseField>
        <BaseField label="Username" htmlFor="username" errors={shown.username}>
          <BaseInput id="username" autoComplete="username" value={username} onChange={(e) => (setUsername(e.target.value), setErrors((c) => ({ ...c, username: [] })))} aria-invalid={shown.username?.length ? true : undefined} />
        </BaseField>
        <BaseField label="Email" htmlFor="email" errors={shown.email}>
          <BaseInput id="email" type="email" autoComplete="email" value={email} onChange={(e) => (setEmail(e.target.value), setErrors((c) => ({ ...c, email: [] })))} aria-invalid={shown.email?.length ? true : undefined} />
        </BaseField>
        {user.pending_email && (
          <div role="status" className="flex flex-col gap-2 rounded-ui bg-surface p-item text-sm">
            <span>
              Waiting for confirmation: <strong className="break-all">{user.pending_email}</strong>. Your current address stays in use until you confirm.
            </span>
            <div className="flex flex-wrap gap-2">
              <BaseButton variant="secondary" size="sm" onClick={() => void resend()}>
                Resend link
              </BaseButton>
              <ConfirmDialog title="Cancel the email change?" message="The new address is forgotten and its link stops working." confirmLabel="Cancel change" onConfirm={cancel} trigger={<BaseButton variant="secondary" size="sm">Cancel change</BaseButton>} />
            </div>
          </div>
        )}
        <div role="status" aria-live="polite">
          {notice && <BaseAlert tone="info">{notice}</BaseAlert>}
        </div>
        <div>
          <BaseButton type="submit" disabled={busy || !changed}>
            {busy ? "Saving…" : "Save"}
          </BaseButton>
        </div>
      </form>

      <section aria-label="Availability" className="flex items-center justify-between gap-4 rounded-ui border border-line bg-surface-raised p-surface">
        <div className="min-w-0">
          <h2 className="font-heading text-page-title">Available for work</h2>
          <p className="text-sm text-ink-muted">While this is off you are not offered in the member and assignee pickers. Cards you already have stay yours.</p>
        </div>
        <BaseSwitch
          label="Available for work"
          checked={user.is_available !== false}
          onCheckedChange={(v) => {
            setWantAvailable(v);
            setAsking(true);
          }}
        />
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          tone="primary"
          confirmLabel={wantAvailable ? "Turn on" : "Turn off"}
          title={wantAvailable ? "Mark yourself available?" : "Mark yourself unavailable?"}
          message={wantAvailable ? "You will show in the member and assignee pickers again." : "You will leave the member and assignee pickers. Your open cards and sessions are not affected."}
          onConfirm={toggleAvailable}
        />
      </section>
    </div>
  );
}
