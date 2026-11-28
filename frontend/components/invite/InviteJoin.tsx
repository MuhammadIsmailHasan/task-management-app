"use client";

import { Clock, ShieldCheck, UserCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { InviteCard } from "./InviteCard";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert } from "@/components/shared/BaseField";
import { BaseLinkButton } from "@/components/shared/BaseLinkButton";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { htmlToText } from "@/lib/rich-text";
import type { InviteLookup } from "@/lib/types";
import { boardPath } from "@/lib/routes";

const ICON = { can_request: UserPlus, pending: Clock, member: UserCheck, staff: ShieldCheck } as const;

function OpenBoard({ slug }: { slug: string }) {
  return (
    <BaseLinkButton href={boardPath(slug)} className="w-full">
      Open board
    </BaseLinkButton>
  );
}

export function InviteJoin({ token, invite }: { token: string; invite: InviteLookup }) {
  const [state, setState] = useState(invite.state);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { board } = invite;
  const description = htmlToText(board.description);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      await api.invites.request(token);
      setSent(true);
      setState("pending");
    } catch (err) {
      if (err instanceof ApiError && err.httpStatus === 409) setState("pending");
      else setError(err instanceof ApiError ? err.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <InviteCard icon={ICON[state]}>
      <div className="flex flex-col gap-2">
        <span className="inline-flex items-center justify-center gap-2 text-xs text-ink-muted uppercase">
          <i aria-hidden="true" className="size-dot rounded-full bg-accent" />
          You are invited to
        </span>
        <h1 className="font-heading text-xl break-words">{board.name}</h1>
        {description && <p className="line-clamp-3 text-sm text-ink-muted break-words">{description}</p>}
      </div>
      {error && <BaseAlert>{error}</BaseAlert>}
      {state === "can_request" && (
        <>
          <BaseButton block disabled={busy} onClick={() => void ask()}>
            <UserPlus aria-hidden="true" />
            Request to join
          </BaseButton>
          <p className="text-xs text-ink-muted">A manager or the board owner decides, and you get a notification.</p>
        </>
      )}
      {state === "pending" && (
        <BaseAlert tone="info">
          {sent ? "Request sent. You will get a notification when a manager or an admin decides." : "Your request is waiting for a decision."}
        </BaseAlert>
      )}
      {state === "member" && (
        <>
          <p className="text-sm">You are already a member of this board.</p>
          <OpenBoard slug={board.slug} />
        </>
      )}
      {state === "staff" && (
        <>
          <p className="text-sm">You already have access to every board.</p>
          <OpenBoard slug={board.slug} />
        </>
      )}
    </InviteCard>
  );
}
