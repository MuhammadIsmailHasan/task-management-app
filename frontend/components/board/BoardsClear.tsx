import Link from "next/link";
import { routes } from "@/lib/routes";

export function BoardsClear() {
  return (
    <Link href={routes.boards} className="text-sm font-semibold">
      Clear search
    </Link>
  );
}
