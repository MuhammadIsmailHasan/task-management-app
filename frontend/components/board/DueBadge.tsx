import { BaseBadge } from "@/components/shared/BaseBadge";
import type { DueState } from "@/lib/types";

/** "Overdue" (danger) or "Due tomorrow" (warning), from the Card's `due_state`; text, never colour alone (VIEW-09). */
export function DueBadge({ state }: { state: DueState | undefined }) {
  if (state === "overdue") return <BaseBadge tone="danger">Overdue</BaseBadge>;
  if (state === "due_tomorrow") return <BaseBadge tone="orange">Due tomorrow</BaseBadge>;
  return null;
}
