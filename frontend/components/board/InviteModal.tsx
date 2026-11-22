"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseConfirm } from "@/components/shared/BaseConfirm";
import { BaseAlert, BaseInput } from "@/components/shared/BaseField";
import { BaseModal } from "@/components/shared/BaseModal";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import type { InviteState, JoinRequest } from "@/lib/types";

interface InviteModalProps {
  boardId: string;
  open: boolean;
  onClose: () => void;
  /** Manager and Admin decide; the Board_Owner only sees the list. */
  canDecide: boolean;
  onChanged: (pending: number) => void;
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** The Invite_Link and the pending Join_Requests of one Board (Requirement 24, criteria 19 to 21). The Email shows here and nowhere else. */
export function InviteModal({ boardId, open, onClose, canDecide, onChanged }: InviteModalProps) {
  const [state, setState] = useState<InviteState | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = state?.path ? `${window.location.origin}${state.path}` : "";

  const load = useCallback(async () => {
    setError(null);
    try {
      const [invite, pending] = await Promise.all([api.boards.invite(boardId), api.boards.joinRequests(boardId)]);
      setState(invite);
      setRequests(pending);
      onChanged(pending.length);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the invite.");
    }
  }, [boardId, onChanged]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function run(action: () => Promise<InviteState>) {
    setError(null);
    try {
      setState(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the invite link.");
    }
  }

  async function decide(req: JoinRequest, status: "approved" | "rejected") {
    setError(null);
    try {
      await api.invites.decide(req.id, status);
      const next = requests.filter((r) => r.id !== req.id);
      setRequests(next);
      onChanged(next.length);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the decision.");
      void load();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed. Select the link and copy it by hand.");
    }
  }

  return (
    <BaseModal open={open} title="Invite people" onClose={onClose} size="wide">
      <div className="flex flex-col gap-6">
        {error && <BaseAlert>{error}</BaseAlert>}
        <section aria-label="Invite settings" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Invite link</h3>
          <p className="text-sm text-ink-muted">
            Anyone with the link can ask to join. Nobody gets in until a manager or an admin approves the request.
          </p>
          {!state?.enabled ? (
            <div>
              <BaseButton disabled={!state} onClick={() => void run(() => api.boards.enableInvite(boardId))}>
                Generate invite link
              </BaseButton>
              {state && <p className="mt-2 text-xs text-ink-muted">Invites are off.</p>}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <BaseInput readOnly aria-label="Invite link" value={link} onFocus={(e) => e.currentTarget.select()} onClick={() => void copy()} />
                <BaseButton variant="secondary" aria-label="Copy link" onClick={() => void copy()}>
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copied ? "Copied" : "Copy"}
                </BaseButton>
              </div>
              <div className="flex items-center justify-end gap-2">
                <BaseConfirm
                  message="Make a new link? The old link stops working."
                  confirmLabel="Regenerate"
                  onConfirm={() => run(() => api.boards.regenerateInvite(boardId))}
                  trigger={<BaseButton variant="secondary">Regenerate</BaseButton>}
                />
                <BaseConfirm
                  message="Turn off invites? The link stops working."
                  confirmLabel="Disable"
                  onConfirm={() => run(() => api.boards.disableInvite(boardId))}
                  trigger={<BaseButton variant="secondary">Disable</BaseButton>}
                />
              </div>
            </>
          )}
        </section>

        <section aria-label="Join requests" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Join requests{requests.length > 0 && ` (${requests.length})`}</h3>
          {!canDecide && <p className="text-xs text-ink-muted">A manager or an admin decides on requests.</p>}
          {requests.length === 0 && <p className="text-sm text-ink-muted">No requests waiting.</p>}
          <ul className="flex flex-col gap-3">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line p-3">
                <BaseAvatar name={r.user.full_name} src={r.user.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium break-words">{r.user.full_name}</div>
                  <div className="text-xs break-words text-ink-muted">
                    {r.user.username} · {r.user.email}
                  </div>
                  <div className="text-xs text-ink-muted">{when(r.created_at)}</div>
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
    </BaseModal>
  );
}
