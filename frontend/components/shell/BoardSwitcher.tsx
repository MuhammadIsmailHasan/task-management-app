"use client";

import { ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseInput } from "@/components/shared/BaseField";
import { BasePopover } from "@/components/shared/BasePopover";
import type { Board } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NewBoardModal } from "./NewBoardModal";
import { useShell } from "./ShellContext";
import { boardPath } from "@/lib/routes";

const SEARCH_FROM = 6;

const percentDone = (b: Board) => (b.card_count ? Math.round(((b.done_count ?? 0) / b.card_count) * 100) : 0);

export function BoardSwitcher({ board }: { board: Board }) {
  const { boards, session } = useShell();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const canCreate = session?.role === "manager" || session?.role === "admin";
  const shown = boards.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));
  const roleOf = (b: Board) => (b.owner_id === session?.userId ? "Owner" : session ? session.role[0].toUpperCase() + session.role.slice(1) : "");

  return (
    <>
      <BasePopover
        label="Switch board"
        wide
        open={open}
        onOpenChange={setOpen}
        trigger={
          <BaseButton
            variant="secondary"
            aria-label={`Switch board: ${board.name}`}
            className="h-auto w-fit max-w-full justify-start gap-2 px-3 py-2 text-left font-heading text-xl whitespace-normal break-words"
          >
            <span className="min-w-0">{board.name}</span>
            <ChevronDown aria-hidden="true" className={cn("size-icon shrink-0 text-ink-muted transition-transform duration-fast", open && "rotate-180")} />
          </BaseButton>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-page-title">Switch board</h2>
            <BaseBadge tone="count">{boards.length} boards</BaseBadge>
          </div>
          {boards.length >= SEARCH_FROM && <BaseInput type="search" placeholder="Search boards" aria-label="Search boards" value={query} onChange={(e) => setQuery(e.target.value)} />}
          <ul className="m-0 flex max-h-popover-list list-none flex-col gap-1 overflow-y-auto p-0" aria-label="Boards">
            {shown.map((b) => (
              <li key={b.id}>
                <Link
                  href={boardPath(b.slug)}
                  aria-current={b.id === board.id ? "true" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn("flex flex-col gap-1 rounded-ui px-3 py-2 text-ink no-underline transition-colors duration-fast hover:bg-surface-sunken focus-ring", b.id === board.id && "bg-surface")}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold break-words">
                    <span className="min-w-0">{b.name}</span>
                    <BaseBadge tone={b.owner_id === session?.userId ? "accent" : "neutral"}>{roleOf(b)}</BaseBadge>
                  </span>
                  <span className="flex items-center justify-between text-xs text-ink-muted">
                    <span>{b.card_count ?? 0} cards</span>
                    <span className="font-semibold text-accent">{percentDone(b)}%</span>
                  </span>
                </Link>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 text-sm text-ink-muted">No boards found.</li>}
          </ul>
          {canCreate && (
            <BaseButton
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
            >
              <Plus aria-hidden="true" />
              Create new board
            </BaseButton>
          )}
        </div>
      </BasePopover>
      <NewBoardModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
