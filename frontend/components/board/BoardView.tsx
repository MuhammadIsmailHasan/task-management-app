"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardModal } from "@/components/card/CardModal";
import { BaseAlert } from "@/components/shared/BaseField";
import { useShell } from "@/components/shell/ShellContext";
import { api } from "@/lib/api";
import { CATEGORIES_CHANGED } from "@/lib/categories";
import { ApiError } from "@/lib/http";
import { computeDropOrder, needsRebalance } from "@/lib/ordering";
import type { Board as BoardT, Card, Category, Comment, Member } from "@/lib/types";
import { Board } from "./Board";
import { BoardHeader } from "./BoardHeader";
import { CalendarView } from "./CalendarView";
import { ListView } from "./ListView";

interface BoardViewProps {
  view?: "board" | "list" | "calendar";
  board: BoardT;
  initialCards: Card[];
  initialCategories: Category[];
  initialArchivedCount?: number;
}

export function BoardView({ view = "board", board, initialCards, initialCategories, initialArchivedCount = 0 }: BoardViewProps) {
  const { session } = useShell();
  const [columns, setColumns] = useState(board.columns ?? []);
  const [cards, setCards] = useState(initialCards);
  const [categories, setCategories] = useState(initialCategories);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = useRef(true);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const cardParam = params.get("card");
  const [notice, setNotice] = useState<string | null>(null);
  const [archivedCount, setArchivedCount] = useState(initialArchivedCount);
  const role = session?.role;
  const staff = role === "supervisor" || role === "manager" || role === "admin";
  const canManageColumns = !!session && (role === "manager" || role === "admin" || board.owner_id === session.userId);

  useEffect(() => {
    let live = true;
    api.categories.listForBoard(board.id).then((c) => live && setCategories(c)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [board.id]);

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ boardId: string }>).detail?.boardId !== board.id) return;
      api.categories.listForBoard(board.id).then(setCategories).catch(() => undefined);
      void refetchRef.current();
    };
    window.addEventListener(CATEGORIES_CHANGED, onChanged);
    return () => window.removeEventListener(CATEGORIES_CHANGED, onChanged);
  }, [board.id]);

  useEffect(() => {
    let live = true;
    api.boards.members(board.id).then((m) => live && setMembers(m)).catch(() => live && setMembers([]));
    return () => {
      live = false;
    };
  }, [board.id]);

  useEffect(() => {
    if (!cardParam) return;
    let live = true;
    setNotice(null);
    api.cards
      .get(cardParam)
      .then((c) => {
        if (!live) return;
        if (!columns.some((col) => col.id === c.column_id)) return void setNotice("This card is no longer available.");
        if (c.archived_at) return void setNotice("This card is archived.");
        setCards((all) => (all.some((x) => x.id === c.id) ? all : [...all, c]));
        setOpenId(c.id);
      })
      .catch(() => live && setNotice("This card is no longer available."));
    return () => {
      live = false;
    };
  }, [cardParam, board.id]);

  const failColumn = (err: unknown, fallback: string) => setError(err instanceof ApiError ? err.message : fallback);

  async function reorder(id: string, to: number) {
    const ordered = [...columns].sort((a, b) => a.order - b.order);
    const from = ordered.findIndex((c) => c.id === id);
    if (from < 0 || to < 0 || to >= ordered.length || from === to) return;
    const snapshot = columns;
    const next = [...ordered];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setError(null);
    setColumns(next.map((c, i) => ({ ...c, order: i })));
    try {
      await api.columns.move(id, to);
    } catch (err) {
      setColumns(snapshot);
      failColumn(err, "Could not move the column.");
    }
  }

  const columnActions = canManageColumns
    ? {
        onRename: async (id: string, name: string) => {
          setError(null);
          try {
            const saved = await api.columns.rename(id, name);
            setColumns((all) => all.map((c) => (c.id === id ? { ...c, ...saved } : c)));
          } catch (err) {
            failColumn(err, "Could not rename the column.");
            throw err;
          }
        },
        onMove: async (id: string, delta: -1 | 1) => {
          const from = [...columns].sort((a, b) => a.order - b.order).findIndex((c) => c.id === id);
          await reorder(id, from + delta);
        },
        onReorder: (id: string, to: number) => reorder(id, to),
        onDelete: async (id: string) => {
          setError(null);
          await api.columns.remove(id);
          setColumns((all) => all.filter((c) => c.id !== id));
        },
        onAdd: async (name: string) => {
          setError(null);
          try {
            const created = await api.columns.create(board.id, name);
            setColumns((all) => [...all, created]);
          } catch (err) {
            failColumn(err, "Could not add the column.");
            throw err;
          }
        },
      }
    : undefined;

  function closeCard() {
    setOpenId(null);
    if (params.get("card")) router.replace(pathname);
  }

  const refetch = useCallback(async () => {
    try {
      setCards(await api.cards.listForBoard(board.id, { search: search || undefined, category: categoryId ?? undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load cards.");
    }
  }, [board.id, search, categoryId]);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(refetch, 250);
    return () => clearTimeout(t);
  }, [refetch]);

  async function onMove(cardId: string, columnId: string, index: number) {
    const snapshot = cards;
    const moving = cards.find((c) => c.id === cardId);
    if (!moving) return;
    const siblings = cards.filter((c) => c.column_id === columnId && c.id !== cardId).sort((a, b) => a.order - b.order);
    const order = computeDropOrder(siblings.map((s) => s.order), index);
    const prev = siblings[index - 1] ?? null;
    const next = siblings[index] ?? null;
    setError(null);
    setCards((all) => all.map((c) => (c.id === cardId ? { ...c, column_id: columnId, order } : c)));
    try {
      const saved = await api.cards.move(cardId, { column_id: columnId, prev: prev?.id ?? null, next: next?.id ?? null });
      setCards((all) => all.map((c) => (c.id === cardId ? { ...c, ...saved } : c)));
      if (needsRebalance(prev?.order ?? null, next?.order ?? null)) await refetch();
    } catch (err) {
      setCards(snapshot);
      setError(err instanceof ApiError ? err.message : "Could not move the card.");
    }
  }

  async function onCreate(columnId: string, title: string) {
    setError(null);
    try {
      const card = await api.cards.create(columnId, { title });
      setCards((all) => [...all, card]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the card.");
      throw err;
    }
  }

  async function createFromComment(comment: Comment) {
    const target = columns[0];
    if (!target) return;
    const card = await api.cards.create(target.id, {
      title: comment.content.slice(0, 255),
      description: comment.content,
    });
    setCards((all) => [...all, card]);
  }

  const open = cards.find((c) => c.id === openId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <BoardHeader
        board={board}
        cards={cards}
        members={members}
        categories={categories}
        categoryId={categoryId}
        search={search}
        onSearch={setSearch}
        onCategory={setCategoryId}
        archivedCount={archivedCount}
        canEdit={canManageColumns}
      />
      {notice && (
        <div className="shrink-0 px-4 pt-4 lg:px-8">
          <BaseAlert tone="info">{notice}</BaseAlert>
        </div>
      )}
      {error && (
        <div className="shrink-0 px-4 pt-4 lg:px-8">
          <BaseAlert>{error}</BaseAlert>
        </div>
      )}
      {view === "list" && <ListView columns={columns} cards={cards} categories={categories} members={members} onOpen={(c) => setOpenId(c.id)} />}
      {view === "calendar" && <CalendarView columns={columns} cards={cards} onOpen={(c) => setOpenId(c.id)} />}
      {view === "board" && (
        <Board
          columns={columns}
          cards={cards}
          categories={categories}
          members={members}
          canMove={!!session}
          canCreate={staff}
          onOpen={(c) => setOpenId(c.id)}
          onMove={onMove}
          onCreate={onCreate}
          columnActions={columnActions}
        />
      )}
      {open && (
        <CardModal
          cardId={open.id}
          board={board}
          columns={columns}
          categories={categories}
          onClose={closeCard}
          onChanged={(card) => {
            if (card.archived_at && cards.some((c) => c.id === card.id)) setArchivedCount((n) => n + 1);
            setCards((all) => (card.archived_at ? all.filter((c) => c.id !== card.id) : all.map((c) => (c.id === card.id ? { ...c, ...card } : c))));
          }}
          onDeleted={(id) => {
            setCards((all) => all.filter((c) => c.id !== id));
            closeCard();
          }}
          onCreateCardFromComment={staff ? createFromComment : undefined}
        />
      )}
    </div>
  );
}
