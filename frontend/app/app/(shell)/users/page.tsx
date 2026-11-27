import { redirect } from "next/navigation";
import { UsersScreen, type UsersPage } from "@/components/admin/UsersScreen";
import { serverGet, serverToken } from "@/lib/server";
import { decodeToken } from "@/lib/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const claims = decodeToken((await serverToken()) ?? "");
  if (claims?.role !== "admin") redirect(routes.boards);
  const raw = Number((await searchParams).page);
  const page = Number.isInteger(raw) && raw >= 1 ? raw : 1;
  const users = await serverGet<UsersPage>("/users", { page: String(page), per_page: String(PER_PAGE) });
  return <UsersScreen key={page} initial={users} />;
}

const PER_PAGE = 10;
