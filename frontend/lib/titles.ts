const BRAND = "RevoBoard";
const MAX = 60;

/** `RevoBoard | <name>`, the name cut at 60 characters; the brand comes first (Requirement 32). */
export function pageTitle(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return BRAND;
  return `${BRAND} | ${clean.length > MAX ? `${clean.slice(0, MAX - 1)}…` : clean}`;
}

/** The title while the Inbox or Activity panel is open; the unread count shows only above zero. */
export function panelTitle(view: "inbox" | "activity", unread = 0): string {
  return view === "inbox" ? pageTitle(unread > 0 ? `Inbox (${unread})` : "Inbox") : pageTitle("Activity");
}
