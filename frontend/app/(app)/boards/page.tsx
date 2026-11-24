import { AnalyticsStrip } from "@/components/board/AnalyticsStrip";
import { BoardTile } from "@/components/board/BoardTile";
import { NewBoardButton } from "@/components/board/NewBoardButton";
import { decodeToken } from "@/lib/session";
import { serverGet, serverToken } from "@/lib/server";
import type { Analytics, Board, Member } from "@/lib/types";

/** Totals for the analytics strip: a Manager sees every board, a Supervisor only the boards they own; others get none. */
async function analyticsFor(boards: Board[]): Promise<Analytics[] | null> {
  const token = await serverToken();
  const claims = token ? decodeToken(token) : null;
  try {
    if (claims?.role === "manager") return await serverGet<Analytics[]>("/analytics/boards");
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

/** Home: every board the viewer may see as a tile, and an analytics strip for Supervisors and Managers. */
export default async function BoardsHome() {
  const boards = await serverGet<Board[]>("/boards");
  const claims = decodeToken((await serverToken()) ?? "");
  const staff = claims?.role === "manager" || claims?.role === "admin";
  const [members, analytics] = await Promise.all([
    Promise.all(boards.map((b) => serverGet<Member[]>(`/boards/${b.id}/members`).catch(() => [] as Member[]))),
    analyticsFor(boards),
  ]);
  return (
    <div className="flex flex-col gap-6 px-page pt-2 pb-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-title">Boards</h1>
        {staff && <NewBoardButton />}
      </div>
      {analytics && analytics.length > 0 && <AnalyticsStrip rows={analytics} />}
      {boards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <h2 className="font-heading text-xl">No boards yet</h2>
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
