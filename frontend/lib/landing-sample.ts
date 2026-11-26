import { deriveProgress } from "./progress";
import type { Card, Category, Column, Priority } from "./types";

/** The sample Board the landing page shows: typed like the Backend's data, so the preview uses the app's own components and functions (LAND-06). */
export const SAMPLE_COLUMNS: Column[] = ["Todo", "In Progress", "Review", "Revision", "Done"].map((name, order) => ({ id: `col-${order}`, board_id: "sample", name, order }));

export const SAMPLE_CATEGORIES: Category[] = [
  { id: "cat-design", board_id: "sample", name: "Design", color: "green" },
  { id: "cat-eng", board_id: "sample", name: "Engineering", color: "blue" },
  { id: "cat-ops", board_id: "sample", name: "Operations", color: "orange" },
];

interface SampleSpec {
  title: string;
  description: string;
  column: number;
  priority: Priority;
  category: string;
  subtasks: [done: number, total: number];
  overdue?: boolean;
}

const SPECS: SampleSpec[] = [
  { title: "Plan the launch checklist", description: "List what has to ship before the first release.", column: 0, priority: "medium", category: "cat-ops", subtasks: [0, 3] },
  { title: "Fix the login redirect loop", description: "Users bounce between /login and the board.", column: 1, priority: "high", category: "cat-eng", subtasks: [1, 2], overdue: true },
  { title: "Design the drag-and-drop states", description: "Placeholder, lift, and drop feedback for cards.", column: 1, priority: "high", category: "cat-design", subtasks: [3, 4] },
  { title: "Audit the comment threads", description: "Check replies, priority comments, and sorting.", column: 2, priority: "medium", category: "cat-eng", subtasks: [2, 2] },
  { title: "Update the brand colours", description: "Align the tokens with the new palette.", column: 3, priority: "low", category: "cat-design", subtasks: [0, 0] },
  { title: "Set up the CI pipeline", description: "Run the tests on every pull request.", column: 4, priority: "low", category: "cat-ops", subtasks: [3, 3] },
];

export interface SampleCard {
  card: Card;
  overdue: boolean;
}

export const SAMPLE_CARDS: SampleCard[] = SPECS.map((s, i) => {
  const [done, total] = s.subtasks;
  const subtasks = Array.from({ length: total }, (_, n) => ({ id: `st-${i}-${n}`, card_id: `card-${i}`, title: `Step ${n + 1}`, is_done: n < done, order: n + 1 }));
  return {
    overdue: !!s.overdue,
    card: {
      id: `card-${i}`,
      column_id: SAMPLE_COLUMNS[s.column].id,
      category_id: s.category,
      assignee_id: null,
      title: s.title,
      description: s.description,
      priority: s.priority,
      start_date: null,
      end_date: s.overdue ? "2000-01-01" : null,
      order: i + 1,
      archived_at: null,
      due_state: s.overdue ? "overdue" : null,
      subtasks,
      progress: deriveProgress(done, total),
      subtask_done_count: done,
      subtask_total_count: total,
      attachments: [],
    },
  };
});

/** Every figure the preview shows, computed from the sample data (Property 68). */
export function sampleFigures() {
  const doneColumn = SAMPLE_COLUMNS.find((c) => c.name === "Done")!;
  const cards = SAMPLE_CARDS.map((s) => s.card);
  const done = cards.filter((c) => c.column_id === doneColumn.id).length;
  const subtasks = cards.flatMap((c) => c.subtasks);
  return {
    totalCards: cards.length,
    doneCards: done,
    percent: cards.length ? Math.round((done / cards.length) * 100) : 0,
    subtasksDone: subtasks.filter((s) => s.is_done).length,
    subtasksTotal: subtasks.length,
    perColumn: SAMPLE_COLUMNS.map((c) => ({ name: c.name, count: cards.filter((x) => x.column_id === c.id).length })),
  };
}
