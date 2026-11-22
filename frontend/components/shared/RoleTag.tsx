import { BaseBadge } from "@/components/shared/BaseBadge";

/** The role of a Board member: "Supervisor" (blue) or "Member" (neutral); the word is always shown, never colour alone (Requirement 30). */
export function RoleTag({ role }: { role: "member" | "supervisor" }) {
  return (
    <BaseBadge tone={role === "supervisor" ? "blue" : "neutral"} shape="tag" className="shrink-0">
      {role === "supervisor" ? "Supervisor" : "Member"}
    </BaseBadge>
  );
}
