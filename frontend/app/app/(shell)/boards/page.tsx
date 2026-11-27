import { AnalyticsStrip } from "@/components/board/AnalyticsStrip";
import { BoardsClear } from "@/components/board/BoardsClear";
import { BoardsToolbar } from "@/components/board/BoardsToolbar";
import { BoardTile } from "@/components/board/BoardTile";
import { NewBoardButton } from "@/components/board/NewBoardButton";
import { decodeToken } from "@/lib/session";
import { serverGet, serverToken } from "@/lib/server";
import type { Analytics, Board, Member } from "@/lib/types";

async function analyticsFor(boards: Board[]): Promise<Analytics[] | null> {
  const token = await serverToken();
  const claims = token ? decodeToken(token) : null;
  try {
    if (claims?.role === "manager" || claims?.role === "admin") return await serverGet<Analytics[]>("/analytics/boards");
    if (claims?.role === "supervisor") {
      const own = boards.filter((b) => b.owner_id === claims.sub);
      return await Promise.all(own.map((b) => serverGet<Analytics>(`/boards/${b.id}/analytics`)));
    }
  } catch {
    return null;
  }
  return null;
}

export const metadata = { title: "Home" };

export default async function BoardsHome({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; order?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const sort = sp.sort === "created_at" ? "created_at" : "updated_at";
  const order = sp.order === "asc" ? "asc" : "desc";
  const boards = await serverGet<Board[]>("/boards", { q: q || undefined, sort, order });
  const claims = decodeToken((await serverToken()) ?? "");
  const staff = claims?.role === "manager" || claims?.role === "admin";
  const [members, analytics] = await Promise.all([
    Promise.all(boards.map((b) => serverGet<Member[]>(`/boards/${b.id}/members`).catch(() => [] as Member[]))),
    analyticsFor(boards),
  ]);
  return (
    <div className="flex flex-col gap-section px-page pt-surface pb-surface">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl">Boards</h1>
        {staff && <NewBoardButton />}
      </div>
      {analytics && analytics.length > 0 && !q && <AnalyticsStrip rows={analytics} />}
      <BoardsToolbar q={q} sort={sort} order={order} />
      {boards.length === 0 && q ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <h2 className="font-heading text-page-title">No boards match “{q}”</h2>
          <BoardsClear />
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <h2 className="font-heading text-page-title">No boards yet</h2>
          <p className="text-ink-muted">
            {staff ? "Create one with New board." : "You are not on any board yet. Ask a manager or a board owner for an invite link."}
          </p>
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-2 xl:grid-cols-3">
          {boards.map((b, i) => (
            <li key={b.id}>
              <BoardTile board={b} members={members[i]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
