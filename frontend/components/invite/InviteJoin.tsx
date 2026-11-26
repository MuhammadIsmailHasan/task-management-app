"use client";

import Link from "next/link";
import { useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert } from "@/components/shared/BaseField";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import type { InviteLookup } from "@/lib/types";
import { boardPath } from "@/lib/routes";

/** The four states of an invitation: ask, waiting, already in, or staff (Requirement 24, criteria 23 and 24). */
export function InviteJoin({ token, invite }: { token: string; invite: InviteLookup }) {
  const [state, setState] = useState(invite.state);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { board } = invite;

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
    <div className="mx-auto flex max-w-auth flex-col items-center gap-4 px-4 py-12 text-center">
      <p className="text-sm text-ink-muted">You are invited to</p>
      <h1 className="font-heading text-xl break-words">{board.name}</h1>
      {board.description && <p className="text-ink-muted break-words">{board.description}</p>}
      {error && <BaseAlert>{error}</BaseAlert>}
      {state === "can_request" && (
        <BaseButton disabled={busy} onClick={() => void ask()}>
          Request to join
        </BaseButton>
      )}
      {state === "pending" && (
        <p role="status">
          {sent ? "Request sent. You will get a notification when a manager or an admin decides." : "Your request is waiting for a decision."}
        </p>
      )}
      {state === "member" && (
        <>
          <p>You are already a member of this board.</p>
          <Link href={boardPath(board.slug)} className="font-semibold">Open board</Link>
        </>
      )}
      {state === "staff" && (
        <>
          <p>You already have access to every board.</p>
          <Link href={boardPath(board.slug)} className="font-semibold">Open board</Link>
        </>
      )}
    </div>
  );
}
