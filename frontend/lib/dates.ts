/** Date rules for the card modal. Dates are ISO "YYYY-MM-DD" strings: no time of day and no time zone. */

export interface Range {
  start: string;
  end: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export const isIso = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(fromIso(value).getTime());

/** True when either date is empty, or the end is the same day as the start or later (ISO strings sort as dates). */
export function isRangeValid(start: string, end: string): boolean {
  return !start || !end || end >= start;
}

/**
 * A day clicked in the calendar:
 * - no start yet: it becomes the start;
 * - a start and no end: a later or equal day becomes the end, an earlier day restarts the range there;
 * - both set: a later or equal day becomes the new end, an earlier day restarts the range there.
 */
export function normalizeRange(start: string, end: string, picked: string): Range {
  if (!start) return { start: picked, end: "" };
  if (picked < start) return { start: picked, end: "" };
  return { start, end: picked };
}

/** A new start typed or picked: moving it past the end clears the end (reported through `cleared`). */
export function withStart(range: Range, start: string): Range & { cleared: boolean } {
  if (range.end && start && start > range.end) return { start, end: "", cleared: true };
  return { start, end: range.end, cleared: false };
}

/** Days before this one are not selectable while the end date is being picked. */
export function minSelectable(range: Range): string | undefined {
  return range.start && !range.end ? range.start : undefined;
}

/** The first day of a month, as an ISO string: `monthStart(2026, 10)` is "2026-11-01" (month is 0-based). */
export const monthStart = (year: number, month: number) => toIso(new Date(year, month, 1));

/**
 * The cells of a month grid, Monday first (the same week as the throughput weeks, THR-05): whole weeks from the Monday on
 * or before the 1st to the Sunday on or after the last day. Every entry is an ISO date; `inMonth` marks the month's own days.
 */
export function monthGrid(year: number, month: number): { iso: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const trail = 6 - ((last.getDay() + 6) % 7);
  const cells: { iso: string; inMonth: boolean }[] = [];
  for (let i = -lead; i < last.getDate() + trail; i++) {
    const d = new Date(year, month, 1 + i);
    cells.push({ iso: toIso(d), inMonth: d.getMonth() === month });
  }
  return cells;
}

/** "November 2026" for the month heading. */
export const monthLabel = (year: number, month: number) => new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
