"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseConfirm } from "@/components/shared/BaseConfirm";
import { RoleTag } from "@/components/shared/RoleTag";
import { api } from "@/lib/api";
import type { Member } from "@/lib/types";
import { MemberSearch } from "./MemberSearch";
import { useShell } from "./ShellContext";

/** The members of the open Board in the Side_Panel: owner first, role tags, add and remove for those who may (SHELL-19, SHELL-20). */
export function TeamView() {
  const { boardId, boards, session } = useShell();
  const [members, setMembers] = useState<Member[]>([]);
  const [version, setVersion] = useState(0);
  const board = boards.find((b) => b.id === boardId) ?? null;
  const staff = session?.role === "manager" || session?.role === "admin";
  const canAdd = staff;
  const canRemove = staff || (!!session && board?.owner_id === session.userId);

  useEffect(() => {
    if (!boardId) return setMembers([]);
    let live = true;
    api.boards
      .members(boardId)
      .then((m) => live && setMembers(m))
      .catch(() => live && setMembers([]));
    return () => {
      live = false;
    };
  }, [boardId, version]);

  if (!boardId) return <p className="text-meta text-ink-muted">Open a board to see its team.</p>;

  return (
    <div className="flex flex-col gap-4">
      {canAdd && <MemberSearch boardId={boardId} onAdded={() => setVersion((v) => v + 1)} />}
      <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Team members">
        {members.length === 0 && <li className="text-meta text-ink-muted">No members yet.</li>}
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-card p-3 hover:bg-surface">
            <BaseAvatar name={m.full_name} src={m.avatar_url} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold break-words">
                {m.full_name}
                {m.is_owner && <BaseBadge tone="accent">Owner</BaseBadge>}
                {m.role && <RoleTag role={m.role} />}
              </div>
              <div className="truncate text-xs text-ink-muted">{m.username}</div>
            </div>
            {canRemove && !m.is_owner && (
              <BaseConfirm
                message={`Remove ${m.full_name} from this board?`}
                confirmLabel="Remove"
                onConfirm={async () => {
                  await api.boards.removeMember(boardId, m.id);
                  setVersion((v) => v + 1);
                }}
                trigger={
                  <BaseButton variant="ghost" size="sm" className="size-control-sm shrink-0 px-0" aria-label={`Remove ${m.full_name}`}>
                    <X aria-hidden="true" />
                  </BaseButton>
                }
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
