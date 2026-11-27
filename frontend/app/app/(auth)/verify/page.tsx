import { AuthSplitLayout } from "@/components/AuthSplitLayout";
import { VerifyView } from "@/components/auth/VerifyView";

export const metadata = { title: "Confirm your email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthSplitLayout>
      <VerifyView token={token ?? null} />
    </AuthSplitLayout>
  );
}
