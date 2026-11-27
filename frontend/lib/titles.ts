const BRAND = "RevoBoard";
const MAX = 60;

export function pageTitle(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return BRAND;
  return `${BRAND} | ${clean.length > MAX ? `${clean.slice(0, MAX - 1)}…` : clean}`;
}

export function panelTitle(view: "inbox" | "activity" | "members" | "categories", unread = 0): string {
  if (view === "inbox") return pageTitle(unread > 0 ? `Inbox (${unread})` : "Inbox");
  return pageTitle(view === "activity" ? "Activity" : view === "members" ? "Members" : "Categories");
}
