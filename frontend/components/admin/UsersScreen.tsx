"use client";

import { Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseCombobox } from "@/components/shared/BaseCombobox";
import { BaseAlert, BaseField, BaseInput } from "@/components/shared/BaseField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BaseModal } from "@/components/shared/BaseModal";
import { BaseSwitch } from "@/components/shared/BaseSwitch";
import { useShell } from "@/components/shell/ShellContext";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { boardPath, cardPath } from "@/lib/routes";
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

interface BlockedDetails {
  cards: { id: string; title: string; board_slug: string; board_name: string }[];
  boards: { id: string; slug: string; name: string; open_card_count: number }[];
  cards_total: number;
  boards_total: number;
}

/** What a staged row would change, in the words the confirmation lists (ADM-04). */
interface Staged {
  role?: Role;
  is_active?: boolean;
  is_available?: boolean;
}

const onOff = (v: boolean) => (v ? "on" : "off");

function changesOf(user: AdminUser, staged: Staged): string[] {
  const out: string[] = [];
  if (staged.role !== undefined && staged.role !== user.role) out.push(`Role: ${label(user.role)} to ${label(staged.role)}`);
  if (staged.is_active !== undefined && staged.is_active !== (user.is_active ?? true)) out.push(`Active: ${onOff(user.is_active ?? true)} to ${onOff(staged.is_active)}`);
  if (staged.is_available !== undefined && staged.is_available !== (user.is_available ?? true)) out.push(`Available: ${onOff(user.is_available ?? true)} to ${onOff(staged.is_available)}`);
  return out;
}

const label = (role: Role) => ROLES.find((r) => r.value === role)?.label ?? role;

/**
 * Admin only (Requirement 53): a table of users with a Role select, an Active switch, an Available switch, and an Update
 * button per row. A change is staged in its row; Update lists the changes in a ConfirmDialog and saves them in one request.
 * There is no delete: an account is turned off, and not while the user has open work. Below 960 pixels each row is a card.
 */
export function UsersScreen({ initial }: { initial: AdminUser[] }) {
  const [users, setUsers] = useState(initial);
  const [staged, setStaged] = useState<Record<string, Staged>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ user: AdminUser; details: BlockedDetails } | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const shown = users.filter((u) => {
    const q = query.trim().toLowerCase();
    return !q || u.full_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const stage = (user: AdminUser, patch: Staged) =>
    setStaged((all) => {
      const next = { ...all[user.id], ...patch };
      return changesOf(user, next).length ? { ...all, [user.id]: next } : Object.fromEntries(Object.entries(all).filter(([id]) => id !== user.id));
    });

  async function saveStaged(user: AdminUser) {
    const body = { ...staged[user.id] };
    setNotice(null);
    try {
      const saved = (await api.users.update(user.id, body)) as AdminUser;
      setUsers((all) => all.map((u) => (u.id === saved.id ? { ...u, ...saved } : u)));
      setStaged((all) => Object.fromEntries(Object.entries(all).filter(([id]) => id !== user.id)));
      setNotice(`Saved ${saved.username}.`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "USER_HAS_OPEN_WORK") {
        setBlocked({ user, details: err.details as unknown as BlockedDetails });
        return;
      }
      throw err; // the ConfirmDialog keeps the message
    }
  }

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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (editing === "new") setAsking(true);
    else void save();
  }

  async function save() {
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
        setUsers((all) => all.map((u) => (u.id === saved.id ? { ...u, ...saved } : u)));
        setNotice(`Saved ${saved.username}.`);
      }
      setEditing(null);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const field = (id: keyof Draft, label: string, type = "text", auto?: string) => (
    <BaseField label={label} htmlFor={`user-${id}`} errors={errors[id]}>
      <BaseInput id={`user-${id}`} type={type} autoComplete={auto} value={draft[id]} onChange={set(id)} aria-invalid={errors[id] ? true : undefined} />
    </BaseField>
  );

  const row = (u: AdminUser) => {
    const st = staged[u.id] ?? {};
    const role = st.role ?? u.role;
    const active = st.is_active ?? u.is_active ?? true;
    const available = st.is_available ?? u.is_available ?? true;
    const changes = changesOf(u, st);
    return (
      <li key={u.id} className="grid grid-cols-1 items-center gap-3 rounded-card border border-line bg-surface-raised p-3 lg:grid-cols-12">
        <div className="flex min-w-0 items-center gap-3 lg:col-span-2">
          <BaseAvatar name={u.full_name} src={u.avatar_url} size="md" inactive={u.is_active === false} unavailable={u.is_available === false} />
          <div className="min-w-0">
            <div className="text-sm font-semibold break-words">{u.full_name}</div>
            <div className="truncate text-xs text-ink-muted">@{u.username}</div>
          </div>
        </div>
        <div className="min-w-0 text-sm break-all text-ink-muted lg:col-span-3">{u.email}</div>
        <div className="lg:col-span-2">
          <BaseCombobox label={`Role of ${u.username}`} options={ROLES} value={role} searchable={false} onChange={(v) => stage(u, { role: v as Role })} />
        </div>
        <label className="flex items-center justify-between gap-2 text-sm lg:col-span-1 lg:justify-center">
          <span className="lg:sr-only">Active</span>
          <BaseSwitch label={`Active: ${u.username}`} checked={active} onCheckedChange={(v) => stage(u, { is_active: v })} />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm lg:col-span-1 lg:justify-center">
          <span className="lg:sr-only">Available</span>
          <BaseSwitch label={`Available: ${u.username}`} checked={available} onCheckedChange={(v) => stage(u, { is_available: v })} />
        </label>
        <div className="flex items-center justify-end gap-2 lg:col-span-3">
          <BaseButton variant="secondary" size="sm" aria-label={`Edit ${u.username}`} onClick={() => open(u)}>
            <Pencil aria-hidden="true" />
            Edit
          </BaseButton>
          <ConfirmDialog
            tone="primary"
            confirmLabel="Save"
            title={`Update ${u.username}?`}
            message="These changes are saved together:"
            detail={
              <ul className="m-0 list-disc pl-5">
                {changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            }
            onConfirm={() => saveStaged(u)}
            trigger={
              <BaseButton size="sm" disabled={changes.length === 0} aria-label={`Update ${u.username}`}>
                Update
              </BaseButton>
            }
          />
        </div>
      </li>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-modal-wide flex-col gap-4 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-title">Users</h1>
        <BaseButton onClick={() => open("new")}>
          <Plus aria-hidden="true" />
          New user
        </BaseButton>
      </div>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-icon -translate-y-1/2 text-ink-muted" />
        <BaseInput type="search" className="pl-12" placeholder="Search users" aria-label="Search users" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div role="status" aria-live="polite">
        {notice && <BaseAlert tone="info">{notice}</BaseAlert>}
      </div>
      <div aria-hidden="true" className="hidden grid-cols-12 gap-3 px-3 text-2xs text-ink-muted uppercase lg:grid">
        <span className="col-span-2">Name</span>
        <span className="col-span-3">Email</span>
        <span className="col-span-2">Role</span>
        <span className="col-span-1 text-center">Active</span>
        <span className="col-span-1 text-center">Available</span>
        <span className="col-span-3" />
      </div>
      <ul aria-label="Users" className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map(row)}
        {shown.length === 0 && <li className="text-sm text-ink-muted">No users.</li>}
      </ul>
      <p className="text-xs text-ink-muted">Every change is recorded in the activity log. Accounts are turned off, never deleted.</p>

      <BaseModal open={!!editing} title={editing === "new" ? "New user" : "Edit user"} onClose={() => setEditing(null)}>
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          tone="primary"
          confirmLabel="Create"
          title={`Create user “${draft.username}”?`}
          message="The account can sign in at once with the password you set."
          onConfirm={save}
        />
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

      <BaseModal open={!!blocked} title={blocked ? `${blocked.user.full_name} still has open work` : "Open work"} onClose={() => setBlocked(null)} size="wide">
        {blocked && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">Reassign or finish this work first.</p>
            {blocked.details.boards.length > 0 && (
              <section aria-label="Boards they own" className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Boards they own with open cards ({blocked.details.boards_total})</h3>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {blocked.details.boards.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Link href={boardPath(b.slug)} className="font-semibold">
                        {b.name}
                      </Link>
                      <BaseBadge tone="neutral">{b.open_card_count} open</BaseBadge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {blocked.details.cards.length > 0 && (
              <section aria-label="Cards assigned to them" className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Open cards assigned to them ({blocked.details.cards_total})</h3>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {blocked.details.cards.map((c) => (
                    <li key={c.id} className="text-sm">
                      <Link href={cardPath(c.board_slug, c.id)} className="font-semibold">
                        {c.title}
                      </Link>{" "}
                      <span className="text-ink-muted">on {c.board_name}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </BaseModal>
    </div>
  );
}
