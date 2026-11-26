import { notFound, redirect } from "next/navigation";
import { BoardUnavailable } from "@/components/board/BoardUnavailable";
import { ApiError } from "@/lib/http";
import { boardPath, routes } from "@/lib/routes";
import { serverGet } from "@/lib/server";
import type { Board } from "@/lib/types";

/** Redirect-only (PATH-08, Open Question 65): an old `/boards/{id}` link becomes `/app/b/{slug}` with its query kept. */
export default async function BoardByIdPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const flat = Object.fromEntries(Object.entries(query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  let board: Board;
  try {
    board = await serverGet<Board>(`/boards/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 404) notFound();
    if (err instanceof ApiError && err.httpStatus === 403) return <BoardUnavailable />;
    if (err instanceof ApiError && err.httpStatus === 401) redirect(routes.login);
    throw err; // includes a 400 for a value that is not an id
  }
  redirect(boardPath(board.slug, flat));
}
