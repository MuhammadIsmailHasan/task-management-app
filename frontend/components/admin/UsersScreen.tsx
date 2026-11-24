"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseCombobox } from "@/components/shared/BaseCombobox";
import { BaseAlert, BaseField, BaseInput } from "@/components/shared/BaseField";
import { BaseModal } from "@/components/shared/BaseModal";
import { useShell } from "@/components/shell/ShellContext";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import type { Role, User } from "@/lib/types";

export type AdminUser = User & { role: Role };

const ROLES: { value: Role; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "supervisor", label: "Supervisor" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

interface Draft {
  full_name: string;
  username: string;
  email: string;
  password: string;
  role: Role;
}

const EMPTY: Draft = { full_name: "", username: "", email: "", password: "", role: "member" };

/** Admin only: list users, create one with a Username and Email, edit the name, Username and Email, and change roles. */
export function UsersScreen({ initial }: { initial: AdminUser[] }) {
  const { session } = useShell();
  const [users, setUsers] = useState(initial);
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function open(target: AdminUser | "new") {
    setErrors({});
    setFormError(null);
    setDraft(target === "new" ? EMPTY : { full_name: target.full_name, username: target.username, email: target.email, password: "", role: target.role });
    setEditing(target);
  }

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  function fail(err: unknown) {
    if (err instanceof ApiError && err.details && Object.keys(err.details).length) setErrors(err.details);
    else setFormError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      if (editing === "new") {
        const created = (await api.users.create({ ...draft })) as AdminUser;
        setUsers((all) => [...all, created].sort((a, b) => a.full_name.localeCompare(b.full_name)));
        setNotice(`Created ${created.username}.`);
      } else {
        const saved = (await api.users.update(editing.id, { full_name: draft.full_name, username: draft.username, email: draft.email })) as AdminUser;
        setUsers((all) => all.map((u) => (u.id === saved.id ? saved : u)));
        setNotice(`Saved ${saved.username}.`);
      }
      setEditing(null);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(user: AdminUser, role: Role) {
    if (role === user.role) return;
    setNotice(null);
    try {
      const saved = (await api.users.update(user.id, { role })) as AdminUser;
      setUsers((all) => all.map((u) => (u.id === saved.id ? saved : u)));
      setNotice(`${saved.username} is now ${role}.`);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not change the role.");
    }
  }

  const field = (id: keyof Draft, label: string, type = "text", auto?: string) => (
    <BaseField label={label} htmlFor={`user-${id}`} errors={errors[id]}>
      <BaseInput id={`user-${id}`} type={type} autoComplete={auto} value={draft[id]} onChange={set(id)} aria-invalid={errors[id] ? true : undefined} />
    </BaseField>
  );

  return (
    <div className="mx-auto flex w-full max-w-modal-wide flex-col gap-4 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-title">Users</h1>
        <BaseButton onClick={() => open("new")}>
          <Plus aria-hidden="true" />
          New user
        </BaseButton>
      </div>
      {notice && <BaseAlert tone="info">{notice}</BaseAlert>}
      <ul aria-label="Users" className="m-0 flex list-none flex-col gap-2 p-0">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface-raised p-3">
            <BaseAvatar name={u.full_name} src={u.avatar_url} size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold break-words">{u.full_name}</div>
              <div className="truncate text-xs text-ink-muted">
                @{u.username} · {u.email}
              </div>
            </div>
            <div className="w-select">
              <BaseCombobox label={`Role of ${u.username}`} options={ROLES} value={u.role} searchable={false} onChange={(v) => void changeRole(u, v as Role)} />
            </div>
            <BaseButton variant="secondary" size="sm" aria-label={`Edit ${u.username}`} onClick={() => open(u)}>
              <Pencil aria-hidden="true" />
              Edit
            </BaseButton>
          </li>
        ))}
        {users.length === 0 && <li className="text-sm text-ink-muted">No users.</li>}
      </ul>
      {session && <p className="text-xs text-ink-muted">Every change is recorded in the activity log.</p>}

      <BaseModal open={!!editing} title={editing === "new" ? "New user" : "Edit user"} onClose={() => setEditing(null)}>
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          {formError && <BaseAlert>{formError}</BaseAlert>}
          {field("full_name", "Full name", "text", "off")}
          {field("username", "Username", "text", "off")}
          {field("email", "Email", "email", "off")}
          {editing === "new" && (
            <>
              {field("password", "Password", "password", "new-password")}
              <BaseField label="Role" htmlFor="user-role" errors={errors.role}>
                <BaseCombobox label="Role" options={ROLES} value={draft.role} searchable={false} onChange={(v) => setDraft((d) => ({ ...d, role: v as Role }))} />
              </BaseField>
            </>
          )}
          <div className="flex justify-end gap-2">
            <BaseButton variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </BaseButton>
            <BaseButton type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </BaseButton>
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
