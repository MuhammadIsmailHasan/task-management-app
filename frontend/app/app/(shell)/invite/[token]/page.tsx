import Link from "next/link";
import { Link2Off } from "lucide-react";
import { InviteCard } from "@/components/invite/InviteCard";
import { InviteJoin } from "@/components/invite/InviteJoin";
import { BaseLinkButton } from "@/components/shared/BaseLinkButton";
import { ApiError } from "@/lib/http";
import { serverGet } from "@/lib/server";
import type { InviteLookup } from "@/lib/types";
import { routes } from "@/lib/routes";

export const metadata = { title: "Invitation", robots: { index: false, follow: false } };

function NotValid() {
  return (
    <InviteCard icon={Link2Off}>
      <h1 className="font-heading text-xl">This invite link is not valid</h1>
      <p className="text-sm text-ink-muted">Ask the board owner for a new link.</p>
      <BaseLinkButton variant="secondary" href={routes.boards} className="w-full">
        Go to Home
      </BaseLinkButton>
    </InviteCard>
  );
}

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
