import { BaseBadge } from "@/components/shared/BaseBadge";

export function RoleTag({ role }: { role: "member" | "supervisor" }) {
  return (
    <BaseBadge tone={role === "supervisor" ? "blue" : "neutral"} shape="tag" className="shrink-0">
      {role === "supervisor" ? "Supervisor" : "Member"}
    </BaseBadge>
  );
}
