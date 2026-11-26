"use client";

import { useEffect, useRef, useState } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert, BaseInput } from "@/components/shared/BaseField";
import { RoleTag } from "@/components/shared/RoleTag";
import { toast } from "@/lib/toast";
import { api, type Candidate } from "@/lib/api";
import { ApiError } from "@/lib/http";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

interface MemberSearchProps {
  boardId: string;
  onAdded: () => void;
}

/** Search users who are not on the board yet (GET /boards/{id}/candidates) and add the chosen one. */
export function MemberSearch({ boardId, onAdded }: MemberSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const short = query.trim().length < MIN_CHARS;

  useEffect(() => {
    if (short) {
      setResults(null);
      return;
    }
    let live = true;
    setError(null);
    const t = setTimeout(() => {
      api.boards
        .candidates(boardId, query.trim())
        .then((r) => live && setResults(r))
        .catch(() => live && setError("Could not search users."));
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [boardId, query, short]);

  async function add(user: Candidate) {
    setError(null);
    try {
      await api.boards.addMember(boardId, user.id);
      // the search starts over, so the next person is found from a clean field (MEMP-03)
      setQuery("");
      setResults(null);
      input.current?.focus();
      toast.success(`${user.full_name} added`);
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the member.");
    }
  }

  return (
    <div className="flex flex-col gap-label">
      <BaseInput ref={input} autoFocus type="search" placeholder="Search people to add" aria-label="Search people" value={query} onChange={(e) => setQuery(e.target.value)} />
      {error && <BaseAlert>{error}</BaseAlert>}
      {short && <p className="px-1 text-sm text-ink-muted">Type at least {MIN_CHARS} characters.</p>}
      {query.length > 0 && (
        <section aria-label="Add to board" className="flex flex-col gap-1 rounded-ui border border-line bg-surface-raised p-item shadow-popover">
          <h3 className="px-2 pt-1 text-xs text-ink-muted uppercase">Add to board</h3>
          <ul className="m-0 flex max-h-popover-list list-none flex-col gap-1 overflow-y-auto p-0" aria-label="People">
            {results?.map((u) => (
              <li key={u.id} className="flex items-center gap-2 rounded-ui px-2 py-1 hover:bg-surface">
                <BaseAvatar name={u.full_name} src={u.avatar_url} size="md" />
                <span className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-1 text-sm">
                    <span className="truncate">{u.full_name}</span>
                    {u.role && <RoleTag role={u.role} />}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    @{u.username} · {u.email}
                  </span>
                </span>
                <BaseButton size="sm" variant="secondary" aria-label={`Add ${u.full_name}`} onClick={() => void add(u)}>
                  Add
                </BaseButton>
              </li>
            ))}
            {!short && results && results.length === 0 && <li className="px-2 text-sm text-ink-muted">No people to add.</li>}
            {!short && !results && <li className="px-2 text-sm text-ink-muted">Loading…</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
