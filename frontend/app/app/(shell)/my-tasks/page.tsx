import { redirect } from "next/navigation";
import { MyTasksView } from "@/components/tasks/MyTasksView";
import { routes } from "@/lib/routes";
import { serverGet, serverToken } from "@/lib/server";
import { decodeToken } from "@/lib/session";
import type { MyCards } from "@/lib/types";

export const metadata = { title: "My tasks" };

export default async function MyTasksPage() {
  const claims = decodeToken((await serverToken()) ?? "");
  if (claims?.role === "admin" || claims?.role === "manager") redirect(routes.dashboard);
  return <MyTasksView role={claims?.role} data={await serverGet<MyCards>("/me/cards")} />;
}
