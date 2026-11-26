import { AuthSplitLayout } from "@/components/AuthSplitLayout";
import { VerifyView } from "@/components/auth/VerifyView";

export const metadata = { title: "Confirm your email" };

/** The page after register and the page the emailed link opens (Requirement 59, ACT-07). */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthSplitLayout>
      <VerifyView token={token ?? null} />
    </AuthSplitLayout>
  );
}
