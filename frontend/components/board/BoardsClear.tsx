import Link from "next/link";
import { routes } from "@/lib/routes";

/** The empty search result's way out (BRDL-03). */
export function BoardsClear() {
  return (
    <Link href={routes.boards} className="text-sm font-semibold">
      Clear search
    </Link>
  );
}
