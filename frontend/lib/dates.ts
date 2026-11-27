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

export function isRangeValid(start: string, end: string): boolean {
  return !start || !end || end >= start;
}

export function normalizeRange(start: string, end: string, picked: string): Range {
  if (!start) return { start: picked, end: "" };
  if (picked < start) return { start: picked, end: "" };
  return { start, end: picked };
}

export function withStart(range: Range, start: string): Range & { cleared: boolean } {
  if (range.end && start && start > range.end) return { start, end: "", cleared: true };
  return { start, end: range.end, cleared: false };
}

export function minSelectable(range: Range): string | undefined {
  return range.start && !range.end ? range.start : undefined;
}

export const monthStart = (year: number, month: number) => toIso(new Date(year, month, 1));

export function monthGrid(year: number, month: number): { iso: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const lead = (first.getDay() + 6) % 7;
  const trail = 6 - ((last.getDay() + 6) % 7);
  const cells: { iso: string; inMonth: boolean }[] = [];
  for (let i = -lead; i < last.getDate() + trail; i++) {
    const d = new Date(year, month, 1 + i);
    cells.push({ iso: toIso(d), inMonth: d.getMonth() === month });
  }
  return cells;
}

export const monthLabel = (year: number, month: number) => new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
