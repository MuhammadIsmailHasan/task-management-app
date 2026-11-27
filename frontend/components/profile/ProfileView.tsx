"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseTabs } from "@/components/shared/BaseTabs";
import { storeUser } from "@/lib/session";
import type { User } from "@/lib/types";
import { ProfileAbout } from "./ProfileAbout";
import { ProfileNotifications } from "./ProfileNotifications";
import { ProfileSecurity } from "./ProfileSecurity";

const TABS = ["about", "security", "notifications"] as const;
type Tab = (typeof TABS)[number];

export function ProfileView({ initial }: { initial: User }) {
  const [user, setUser] = useState(initial);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const raw = params.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "about";

  function update(fresh: User) {
    setUser(fresh);
    storeUser(fresh);
  }

  return (
    <div className="flex w-full flex-col gap-section px-page pt-surface pb-surface">
      <h1 className="sr-only">Profile</h1>
      <div className="flex flex-col gap-4">
        <div aria-hidden="true" className="h-cover w-full rounded-ui bg-gradient-brand" />
        <div className="-mt-12 flex flex-col gap-3 px-4 lg:flex-row lg:items-end lg:gap-6 lg:px-8">
          <BaseAvatar name={user.full_name} src={user.avatar_url} size="xl" className="border border-surface-raised" />
          <div className="min-w-0 pb-2">
            <p className="font-heading text-xl break-words">{user.full_name}</p>
            <p className="text-sm text-ink-muted">@{user.username}</p>
          </div>
        </div>
      </div>
      <BaseTabs
        label="Profile sections"
        value={tab}
        onValueChange={(v) => router.replace(`${pathname}?tab=${v}`)}
        tabs={[
          { value: "about", label: "About", content: <ProfileAbout user={user} onChange={update} /> },
          { value: "security", label: "Security", content: <ProfileSecurity /> },
          { value: "notifications", label: "Notifications", content: <ProfileNotifications /> },
        ]}
      />
    </div>
  );
}
