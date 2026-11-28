import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { routes } from "@/lib/routes";
import { serverGet, serverToken } from "@/lib/server";
import { decodeToken } from "@/lib/session";
import type { Board } from "@/lib/types";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const claims = decodeToken((await serverToken()) ?? "");
  if (!claims || claims.role === "member") redirect(routes.boards);
  const all = await serverGet<Board[]>("/boards");
  const boards = (claims.role === "manager" || claims.role === "admin" ? all : all.filter((b) => b.owner_id === claims.sub)).map((b) => ({ id: b.id, name: b.name, slug: b.slug }));
  return <DashboardView role={claims.role} boards={boards} />;
}
