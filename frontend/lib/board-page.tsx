import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BoardUnavailable } from "@/components/board/BoardUnavailable";
import { BoardView } from "@/components/board/BoardView";
import { ArchivedView } from "@/components/board/ArchivedView";
import { ApiError } from "@/lib/http";
import { routes } from "@/lib/routes";
import { serverGet } from "@/lib/server";
import type { Board, Card, Category } from "@/lib/types";

export type BoardPageView = "board" | "list" | "calendar" | "archived";
export type BoardParams = { params: Promise<{ slug: string }> };

const TITLE: Record<BoardPageView, string> = { board: "", list: " · List", calendar: " · Calendar", archived: " · Archived" };

/** The tab title: the Board's name, with the view after it (Requirement 32). */
export async function boardMetadata({ params }: BoardParams, view: BoardPageView): Promise<Metadata> {
  const { slug } = await params;
  try {
    return { title: `${(await serverGet<Board>(`/boards/slug/${slug}`)).name}${TITLE[view]}` };
  } catch {
    return { title: "Board" };
  }
}

/**
 * One Server Component body for every view of a Board (Requirement 50): an unknown or former slug is the
 * Not_Found_Page, no access is the unavailable page, and an expired session goes to sign in.
 */
export async function renderBoardPage({ params }: BoardParams, view: BoardPageView): Promise<ReactNode> {
  const { slug } = await params;
  try {
    const board = await serverGet<Board>(`/boards/slug/${slug}`);
    if (view === "archived") {
      const [cards, categories] = await Promise.all([serverGet<Card[]>(`/boards/${board.id}/cards`, { archived: "true" }), serverGet<Category[]>(`/boards/${board.id}/categories`)]);
      return <ArchivedView key={board.id} board={board} initialCards={cards} categories={categories} />;
    }
    const [cards, categories, archived] = await Promise.all([
      serverGet<Card[]>(`/boards/${board.id}/cards`),
      serverGet<Category[]>(`/boards/${board.id}/categories`),
      serverGet<Card[]>(`/boards/${board.id}/cards`, { archived: "true" }),
    ]);
    return <BoardView key={board.id} view={view} board={board} initialCards={cards} initialCategories={categories} initialArchivedCount={archived.length} />;
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 404) notFound();
    if (err instanceof ApiError && err.httpStatus === 403) return <BoardUnavailable />;
    if (err instanceof ApiError && err.httpStatus === 401) redirect(routes.login);
    throw err;
  }
}
