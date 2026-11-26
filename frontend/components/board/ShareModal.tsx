"use client";

import { Check, Copy, Link2, RefreshCw, Share2, ShieldCheck, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert, BaseInput } from "@/components/shared/BaseField";
import { BaseModal } from "@/components/shared/BaseModal";
import { BaseTabs } from "@/components/shared/BaseTabs";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { api, type ShareState } from "@/lib/api";
import { ApiError } from "@/lib/http";
import type { InviteState, JoinRequest } from "@/lib/types";

interface ShareModalProps {
  boardId: string;
  boardName: string;
  open: boolean;
  onClose: () => void;
  /** The Public_Link is managed by a Manager and an Admin only (PUB-01, PUB-02). */
  canPublicLink: boolean;
  /** A Manager and an Admin decide on join requests; the Board_Owner only sees the list (INV-14 to INV-16). */
  canDecide: boolean;
  onPendingChange?: (pending: number) => void;
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** A link field with a Copy button; the link is built from the page origin and the API's `path`, and never leaves this field (SHR-04). */
function LinkField({ label, link }: { label: string; link: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2 aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-icon -translate-y-1/2 text-ink-muted" />
          <BaseInput readOnly aria-label={label} className="pl-12" value={link} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <BaseButton variant="dark" aria-label={`Copy ${label.toLowerCase()}`} onClick={() => void copy()}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </BaseButton>
      </div>
      {failed && <BaseAlert>Copy failed. Select the link and copy it by hand.</BaseAlert>}
    </div>
  );
}

/** Regenerate and Disable for one link, each through ConfirmDialog (SHR-03). */
function LinkActions({ what, onRegenerate, onDisable }: { what: string; onRegenerate: () => Promise<void>; onDisable: () => Promise<void> }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-ink-muted">Regenerating instantly stops the previous link.</p>
      <div className="flex items-center gap-2">
        <ConfirmDialog
          title={`Regenerate ${what}?`}
          message="The old link stops working."
          confirmLabel="Regenerate"
          onConfirm={onRegenerate}
          trigger={
            <BaseButton variant="secondary" size="sm">
              <RefreshCw aria-hidden="true" />
              Regenerate
            </BaseButton>
          }
        />
        <ConfirmDialog
          title={`Disable ${what}?`}
          message="The link stops working."
          confirmLabel="Disable"
          onConfirm={onDisable}
          trigger={
            <BaseButton variant="secondary" size="sm" className="text-danger">
              Disable
            </BaseButton>
          }
        />
      </div>
    </div>
  );
}

/**
 * One modal for the Invite_Link, the pending Join_Requests, and the Public_Link (Requirement 55, drawn as
 * `06-invite-public-link-desktop.png`). Each section loads and fails on its own (SHR-05).
 */
export function ShareModal({ boardId, boardName, open, onClose, canPublicLink, canDecide, onPendingChange }: ShareModalProps) {
  const [tab, setTab] = useState("invite");
  const [invite, setInvite] = useState<InviteState | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [share, setShare] = useState<ShareState | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const inviteLink = invite?.path ? `${window.location.origin}${invite.path}` : "";
  const publicLink = share?.path ? `${window.location.origin}${share.path}` : "";

  const loadInvite = useCallback(async () => {
    setInviteError(null);
    try {
      const [state, pending] = await Promise.all([api.boards.invite(boardId), api.boards.joinRequests(boardId)]);
      setInvite(state);
      setRequests(pending);
      onPendingChange?.(pending.length);
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Could not load the invite.");
    }
  }, [boardId, onPendingChange]);

  const loadShare = useCallback(async () => {
    setShareError(null);
    try {
      setShare(await api.boards.share(boardId));
    } catch (err) {
      setShareError(err instanceof ApiError ? err.message : "Could not load the public link.");
    }
  }, [boardId]);

  useEffect(() => {
    if (!open) return;
    void loadInvite();
    if (canPublicLink) void loadShare();
  }, [open, loadInvite, loadShare, canPublicLink]);

  async function runInvite(action: () => Promise<InviteState>) {
    setInviteError(null);
    try {
      setInvite(await action());
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Could not update the invite link.");
      throw err;
    }
  }

  async function runShare(action: () => Promise<ShareState>) {
    setShareError(null);
    try {
      setShare(await action());
    } catch (err) {
      setShareError(err instanceof ApiError ? err.message : "Could not update the public link.");
      throw err;
    }
  }

  async function decide(req: JoinRequest, status: "approved" | "rejected") {
    setInviteError(null);
    try {
      await api.invites.decide(req.id, status);
      const next = requests.filter((r) => r.id !== req.id);
      setRequests(next);
      onPendingChange?.(next.length);
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Could not save the decision.");
      void loadInvite();
    }
  }

  const inviteSection = (
    <div className="flex flex-col gap-6">
      <section aria-label="Invite settings" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-icon text-accent" />
          <h3 className="text-sm font-semibold">Direct invite link</h3>
          {invite?.enabled && <BaseBadge tone="accent">Active</BaseBadge>}
        </div>
        <p className="text-sm text-ink-muted">Anyone with the link can ask to join. Nobody gets in until a manager or an admin approves the request.</p>
        {inviteError && <BaseAlert>{inviteError}</BaseAlert>}
        {!invite?.enabled ? (
          <div>
            <ConfirmDialog
              tone="primary"
              confirmLabel="Create"
              title="Create invite link?"
              message="Anyone with the link can ask to join. Nobody gets in until a manager or an admin approves."
              onConfirm={() => runInvite(() => api.boards.enableInvite(boardId))}
              trigger={<BaseButton disabled={!invite}>Generate invite link</BaseButton>}
            />
            {invite && <p className="mt-2 text-xs text-ink-muted">Invites are off.</p>}
          </div>
        ) : (
          <>
            <LinkField label="Invite link" link={inviteLink} />
            <LinkActions what="invite link" onRegenerate={() => runInvite(() => api.boards.regenerateInvite(boardId))} onDisable={() => runInvite(() => api.boards.disableInvite(boardId))} />
          </>
        )}
      </section>

      <section aria-label="Join requests" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            Pending join requests
            {requests.length > 0 && <BaseBadge tone="accent">{requests.length} pending</BaseBadge>}
          </h3>
          <span className="text-xs text-ink-muted">Manager or admin decides</span>
        </div>
        {!canDecide && <p className="rounded-card bg-surface p-3 text-sm text-ink-muted">A manager or an admin decides on requests.</p>}
        {requests.length === 0 && <p className="text-sm text-ink-muted">No requests waiting.</p>}
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line p-3">
              <BaseAvatar name={r.user.full_name} src={r.user.avatar_url} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium break-words">
                  {r.user.full_name} <span className="font-normal text-ink-muted">@{r.user.username}</span>
                </div>
                <div className="text-xs break-words text-ink-muted">{r.user.email}</div>
                <div className="text-xs text-ink-muted">Requested {when(r.created_at)}</div>
              </div>
              {canDecide && (
                <div className="flex items-center gap-2">
                  <BaseButton size="sm" className="min-h-touch lg:min-h-0" aria-label={`Approve ${r.user.full_name}`} onClick={() => void decide(r, "approved")}>
                    Approve
                  </BaseButton>
                  <BaseButton variant="secondary" size="sm" className="min-h-touch lg:min-h-0" aria-label={`Reject ${r.user.full_name}`} onClick={() => void decide(r, "rejected")}>
                    Reject
                  </BaseButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );

  const publicSection = (
    <section aria-label="Public link settings" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <Share2 aria-hidden="true" className="size-icon text-accent" />
        <h3 className="text-sm font-semibold">Public read-only link</h3>
        {share?.enabled && <BaseBadge tone="accent">Active</BaseBadge>}
      </div>
      <p className="text-sm text-ink-muted">Anyone with the link sees cards, subtasks and attachments. Comments and activity stay private.</p>
      {shareError && <BaseAlert>{shareError}</BaseAlert>}
      {!share?.enabled ? (
        <div>
          <ConfirmDialog
            tone="primary"
            confirmLabel="Create"
            title="Create public link?"
            message="Anyone with the link sees cards, subtasks and attachments. Comments and activity stay private."
            onConfirm={() => runShare(() => api.boards.enableShare(boardId))}
            trigger={<BaseButton disabled={!share}>Create public link</BaseButton>}
          />
          {share && <p className="mt-2 text-xs text-ink-muted">The public link is off.</p>}
        </div>
      ) : (
        <>
          <LinkField label="Public link" link={publicLink} />
          <LinkActions what="public link" onRegenerate={() => runShare(() => api.boards.regenerateShare(boardId))} onDisable={() => runShare(() => api.boards.disableShare(boardId))} />
        </>
      )}
    </section>
  );

  const title = (
    <span className="flex flex-wrap items-center gap-2">
      Share board
      <BaseBadge tone="neutral">{boardName}</BaseBadge>
    </span>
  );

  return (
    <BaseModal
      open={open}
      title={title}
      onClose={onClose}
      size="wide"
      footer={
        <BaseButton variant="dark" className="ml-auto" onClick={onClose}>
          Done
        </BaseButton>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Manage onboarding links, member approvals, and read-only access for people outside the board.</p>
        {canPublicLink ? (
          <BaseTabs
            label="Sharing"
            value={tab}
            onValueChange={setTab}
            tabs={[
              {
                value: "invite",
                label: (
                  <>
                    <UserPlus aria-hidden="true" className="size-icon-sm" />
                    Invite link &amp; join requests
                    {requests.length > 0 && <BaseBadge tone="accent">{requests.length}</BaseBadge>}
                  </>
                ),
                content: inviteSection,
              },
              {
                value: "public",
                label: (
                  <>
                    <Link2 aria-hidden="true" className="size-icon-sm" />
                    Public read-only link
                    {share?.enabled && <span aria-label="On" className="size-dot rounded-full bg-accent" />}
                  </>
                ),
                content: publicSection,
              },
            ]}
          />
        ) : (
          inviteSection
        )}
      </div>
    </BaseModal>
  );
}
