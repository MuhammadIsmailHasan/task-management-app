import { BaseBadge, type BadgeTone } from "@/components/shared/BaseBadge";
import type { Role } from "@/lib/types";

const ROLE: Record<Role, { label: string; tone: BadgeTone }> = {
  member: { label: "Member", tone: "neutral" },
  supervisor: { label: "Supervisor", tone: "blue" },
  manager: { label: "Manager", tone: "purple" },
  admin: { label: "Admin", tone: "amber" },
};

export function RoleTag({ role, prefix }: { role: Role; prefix?: string }) {
  return (
    <BaseBadge tone={ROLE[role].tone} shape="tag" className="shrink-0">
      {prefix ? `${prefix} ${ROLE[role].label}` : ROLE[role].label}
    </BaseBadge>
  );
}
