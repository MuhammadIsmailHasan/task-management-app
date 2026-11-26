import { redirect } from "next/navigation";
import { MyTasksView } from "@/components/tasks/MyTasksView";
import { routes } from "@/lib/routes";
import { serverGet, serverToken } from "@/lib/server";
import { decodeToken } from "@/lib/session";
import type { MyCards } from "@/lib/types";

export const metadata = { title: "My tasks" };

/** The signed-in user's assigned Cards by due date. An Admin cannot be an assignee, so the page sends them to Boards (TASK-01). */
export default async function MyTasksPage() {
  const claims = decodeToken((await serverToken()) ?? "");
  if (claims?.role === "admin") redirect(routes.boards);
  return <MyTasksView data={await serverGet<MyCards>("/me/cards")} />;
}
