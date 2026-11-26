"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseMenu } from "@/components/shared/BaseMenu";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { routes } from "@/lib/routes";

/** The one user menu: Profile, then Log out (Decision L). The trigger shows the avatar, or a user icon without one. */
export function UserMenu({ user }: { user: User | null }) {
  return (
    <BaseMenu
      label="User menu"
      heading={user ? user.full_name : undefined}
      trigger={
        <BaseButton variant="ghost" size="sm" className="size-control rounded-full px-0" aria-label="User menu">
          {user?.avatar_url ? <BaseAvatar name={user.full_name} src={user.avatar_url} size="md" /> : <UserIcon aria-hidden="true" />}
        </BaseButton>
      }
      items={[
        { label: "Profile", icon: UserIcon, href: routes.profile },
        { label: "Log out", icon: LogOut, onSelect: () => void api.auth.logout() },
      ]}
    />
  );
}
