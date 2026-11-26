"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseCombobox } from "@/components/shared/BaseCombobox";
import { BaseInput } from "@/components/shared/BaseField";
import { BOARDS_QUERY_KEY } from "@/lib/routes";

export const BOARD_SORTS = [
  { value: "updated_at:desc", label: "Last updated" },
  { value: "updated_at:asc", label: "First updated" },
  { value: "created_at:desc", label: "Newest" },
  { value: "created_at:asc", label: "Oldest" },
];

/** The search and sort of the Boards page; both live in the query string (`?q=&sort=&order=`), and the page reads them on the server (BRDL-01, BRDL-03). */
export function BoardsToolbar({ q, sort, order }: { q: string; sort: string; order: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(q);
  const first = useRef(true);
  const value = `${sort}:${order}`;

  function go(next: { q: string; sort: string }) {
    const [s, o] = next.sort.split(":");
    const p = new URLSearchParams();
    if (next.q.trim()) p.set("q", next.q.trim());
    if (next.sort !== BOARD_SORTS[0].value) {
      p.set("sort", s);
      p.set("order", o);
    }
    const query = p.toString() ? `?${p}` : "";
    try {
      window.sessionStorage.setItem(BOARDS_QUERY_KEY, query);
    } catch {
      /* the arrow then returns to the bare Boards page */
    }
    router.replace(`${pathname}${query}`);
  }

  // search as the user types, after a pause
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => go({ q: text, sort: value }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="flex flex-wrap items-end gap-field">
      <div className="relative min-w-0 flex-1 basis-popover">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-icon -translate-y-1/2 text-ink-muted" />
        <BaseInput type="search" className="pl-12" placeholder="Search boards" aria-label="Search boards" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="w-popover max-w-full">
        <BaseCombobox label="Sort boards" options={BOARD_SORTS} value={value} searchable={false} onChange={(v) => go({ q: text, sort: v })} />
      </div>
      {(text || value !== BOARD_SORTS[0].value) && (
        <BaseButton variant="ghost" onClick={() => { setText(""); go({ q: "", sort: BOARD_SORTS[0].value }); }}>
          Clear
        </BaseButton>
      )}
    </div>
  );
}
