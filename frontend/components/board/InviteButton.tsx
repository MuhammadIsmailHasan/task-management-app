"use client";

import { UserPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { api } from "@/lib/api";
import { InviteModal } from "./InviteModal";

/** "Invite" in the Board header for the Board_Owner, a Manager, or an Admin, with the pending count; `?invite=1` opens it. */
export function InviteButton({ boardId, canDecide }: { boardId: string; canDecide: boolean }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(params.get("invite") === "1");
  const [pending, setPending] = useState(0);
  const onChanged = useCallback((n: number) => setPending(n), []);

  useEffect(() => {
    let live = true;
    api.boards
      .joinRequests(boardId)
      .then((rows) => live && setPending(rows.length))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [boardId]);

  function close() {
    setOpen(false);
    if (params.get("invite")) router.replace(pathname);
  }

  return (
    <>
      <BaseButton variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label={pending ? `Invite, ${pending} waiting` : "Invite"}>
        <UserPlus aria-hidden="true" />
        <span className="sr-only lg:not-sr-only">Invite</span>
        {pending > 0 && <span aria-hidden="true" className="rounded-full bg-accent-tint px-2 text-2xs font-semibold text-on-accent-tint">{pending}</span>}
      </BaseButton>
      <InviteModal boardId={boardId} open={open} onClose={close} canDecide={canDecide} onChanged={onChanged} />
    </>
  );
}
