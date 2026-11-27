import { BaseBadge } from "@/components/shared/BaseBadge";
import type { DueState } from "@/lib/types";

export function DueBadge({ state }: { state: DueState | undefined }) {
  if (state === "overdue") return <BaseBadge tone="danger">Overdue</BaseBadge>;
  if (state === "due_tomorrow") return <BaseBadge tone="orange">Due tomorrow</BaseBadge>;
  return null;
}
