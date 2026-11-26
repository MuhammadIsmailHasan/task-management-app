import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SharedBoard } from "@/components/shared-view/SharedBoard";
import { ApiError, request } from "@/lib/http";
import { serverToken } from "@/lib/server";
import type { Category, SharedBoard as SharedBoardT, SharedCard } from "@/lib/types";
import { boardByIdPath, routes } from "@/lib/routes";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  try {
    const board = await request<SharedBoardT>("GET", `/shared/${token}`);
    return { title: `Shared · ${board.name}`, robots: { index: false, follow: false } };
  } catch {
    return { title: "Shared board", robots: { index: false, follow: false } };
  }
}

function InvalidLink() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="font-heading text-xl">This link is not valid</h1>
      <p className="max-w-auth text-ink-muted">The link may have been turned off or replaced. Ask the board owner for a new one.</p>
      <Link href={routes.login} className="font-semibold">
        Sign in
      </Link>
    </main>
  );
}

/** Server page: load the shared payloads with the viewer's Token if there is one; signed-in viewers with access go to the normal board. */
export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const bearer = await serverToken();
  let board: SharedBoardT;
  let cards: SharedCard[];
  let categories: Category[];
  try {
    board = await request<SharedBoardT>("GET", `/shared/${token}`, { token: bearer });
    if (board.has_board_access) redirect(boardByIdPath(board.id));
    [cards, categories] = await Promise.all([
      request<SharedCard[]>("GET", `/shared/${token}/cards`),
      request<Category[]>("GET", `/shared/${token}/categories`),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 404) return <InvalidLink />;
    throw err;
  }
  return <SharedBoard token={token} board={board} cards={cards} categories={categories} signedIn={!!bearer} />;
}
