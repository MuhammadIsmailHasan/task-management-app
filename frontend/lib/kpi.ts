import type { BadgeTone } from "@/components/shared/BaseBadge";
import type { KpiFigures } from "./types";

const GOOD_ON_TIME = 0.8;
const FAIR_ON_TIME = 0.5;
const PERCENT = 100;
export const EMPTY = "–";

export const percent = (rate: number | null) => (rate === null ? EMPTY : `${Math.round(rate * PERCENT)}%`);
export const days = (value: number | null) => (value === null ? EMPTY : `${value} d`);

export function onTimeTone(rate: number | null): BadgeTone {
  if (rate === null) return "neutral";
  if (rate >= GOOD_ON_TIME) return "accent";
  if (rate >= FAIR_ON_TIME) return "amber";
  return "danger";
}

export function overdueNote(f: KpiFigures): string {
  return f.oldest_overdue_days === null ? "none late" : `oldest ${f.oldest_overdue_days} d late`;
}
