import type { Card, Subtask } from "./types";

export function deriveProgress(done: number, total: number): number | null {
  return total > 0 ? Math.floor((20 * done + total) / (2 * total)) : null;
}

export function withSubtasks(card: Card, subtasks: Subtask[]): Card {
  const done = subtasks.filter((s) => s.is_done).length;
  return { ...card, subtasks, progress: deriveProgress(done, subtasks.length), subtask_done_count: done, subtask_total_count: subtasks.length };
}
