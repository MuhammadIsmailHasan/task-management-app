import { AuthForm } from "@/components/AuthForm";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthSplitLayout>
      <AuthForm mode="login" next={next} />
    </AuthSplitLayout>
  );
}
