export const GAP = 1e-6;

export function computeDropOrder(siblings: number[], index: number): number {
  if (siblings.length === 0) return 1.0;
  const i = Math.max(0, Math.min(index, siblings.length));
  if (i === 0) return siblings[0] - 1;
  if (i === siblings.length) return siblings[siblings.length - 1] + 1;
  return (siblings[i - 1] + siblings[i]) / 2;
}

export function needsRebalance(prev: number | null, next: number | null): boolean {
  return prev !== null && next !== null && Math.abs(next - prev) < GAP;
}

export function rebalance(orders: number[]): number[] {
  return orders.map((_, i) => i + 1);
}

export function dropIndex(centers: number[], y: number): number {
  let i = 0;
  while (i < centers.length && y > centers[i]) i++;
  return i;
}
