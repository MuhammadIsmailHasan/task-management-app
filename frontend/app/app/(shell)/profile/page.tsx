import { ProfileView } from "@/components/profile/ProfileView";
import { serverGet } from "@/lib/server";
import type { User } from "@/lib/types";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await serverGet<User>("/auth/me");
  return <ProfileView initial={user} />;
}
