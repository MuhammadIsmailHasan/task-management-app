import Link from "next/link";
import { routes } from "@/lib/routes";

export function BoardUnavailable() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <h2 className="font-heading text-page-title">Board unavailable</h2>
      <p className="max-w-auth text-ink-muted">You no longer have access to this board, or it was removed.</p>
      <Link href={routes.boards} className="font-semibold">
        Go to Home
      </Link>
    </div>
  );
}
