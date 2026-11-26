import { AuthForm } from "@/components/AuthForm";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";

export const metadata = { title: "Register" };

/** `?next=` keeps an invite link alive through register, confirmation, and sign-in (ACT-12). */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthSplitLayout>
      <AuthForm mode="register" next={next} />
    </AuthSplitLayout>
  );
}
