import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { decodeToken } from "@/lib/session";
import { serverGet, serverToken } from "@/lib/server";
import type { Analytics, Board, Throughput } from "@/lib/types";

export const metadata = { title: "Dashboard" };

/** Supervisors see the Boards they own and Managers every Board; Members and Admins go back to Home (Requirement 43). */
export default async function DashboardPage() {
  const claims = decodeToken((await serverToken()) ?? "");
  if (!claims || (claims.role !== "manager" && claims.role !== "supervisor")) redirect("/boards");
  if (claims.role === "manager") {
    const [analytics, throughput] = await Promise.all([serverGet<Analytics[]>("/analytics/boards"), serverGet<Throughput[]>("/analytics/throughput", { weeks: "8" })]);
    return <DashboardView role="manager" analytics={analytics} throughput={throughput} />;
  }
  const own = (await serverGet<Board[]>("/boards")).filter((b) => b.owner_id === claims.sub);
  const [analytics, throughput] = await Promise.all([
    Promise.all(own.map((b) => serverGet<Analytics>(`/boards/${b.id}/analytics`))),
    Promise.all(own.map((b) => serverGet<Throughput>(`/boards/${b.id}/analytics/throughput`, { weeks: "8" }))),
  ]);
  return <DashboardView role="supervisor" analytics={analytics} throughput={throughput} />;
}
