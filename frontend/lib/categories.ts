/** Tells the open Board, List, Calendar, Archived view and Card modal that a category changed (CATP-04). */
export const CATEGORIES_CHANGED = "rb:categories-changed";

export function notifyCategoriesChanged(boardId: string): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED, { detail: { boardId } }));
}
