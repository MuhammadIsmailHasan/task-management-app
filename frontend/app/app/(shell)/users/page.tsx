import { redirect } from "next/navigation";
import { UsersScreen, type AdminUser } from "@/components/admin/UsersScreen";
import { serverGet, serverToken } from "@/lib/server";
import { decodeToken } from "@/lib/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "Users" };

/** Admin only: anyone else goes back to the boards (the Backend answers 403 to them anyway). */
export default async function UsersPage() {
  const claims = decodeToken((await serverToken()) ?? "");
  if (claims?.role !== "admin") redirect(routes.boards);
  const users = await serverGet<AdminUser[]>("/users");
  return <UsersScreen initial={users} />;
}
