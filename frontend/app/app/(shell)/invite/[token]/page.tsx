import Link from "next/link";
import { InviteJoin } from "@/components/invite/InviteJoin";
import { ApiError } from "@/lib/http";
import { serverGet } from "@/lib/server";
import type { InviteLookup } from "@/lib/types";
import { routes } from "@/lib/routes";

export const metadata = { title: "Invitation", robots: { index: false, follow: false } };

function NotValid() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <h1 className="font-heading text-xl">This invite link is not valid</h1>
      <p className="max-w-auth text-ink-muted">Ask the board owner for a new link.</p>
      <Link href={routes.boards} className="font-semibold">
        Go to Home
      </Link>
    </div>
  );
}

/** Server page: look the invite up with the viewer's Token; one page for every kind of bad link (Requirement 24, criterion 25). */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let invite: InviteLookup;
  try {
    invite = await serverGet<InviteLookup>(`/invite/${token}`);
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 404) return <NotValid />;
    throw err;
  }
  return <InviteJoin token={token} invite={invite} />;
}
