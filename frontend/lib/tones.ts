import type { BadgeTone } from "@/components/shared/BaseBadge";

/** Rotation used where the data has no colour of its own (categories, columns). */
export const TONE_CYCLE = ["green", "blue", "red", "purple", "orange"] as const;
export type Tone = (typeof TONE_CYCLE)[number];

const COLUMN_TONE: Record<string, Tone> = {
  todo: "orange",
  "to do": "orange",
  "in progress": "blue",
  review: "purple",
  revision: "red",
  done: "green",
};

/** Stable tone for an id (same category, same colour, every render and every board). */
export function toneForId(id: string): Tone {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONE_CYCLE[hash % TONE_CYCLE.length];
}

/** A category's own colour when it holds a known tone name, otherwise a stable tone from its id. */
export function categoryTone(c: { id: string; color: string | null }): Tone {
  return (TONE_CYCLE as readonly string[]).includes(c.color ?? "") ? (c.color as Tone) : toneForId(c.id);
}

export function columnTone(name: string, index: number): Tone {
  return COLUMN_TONE[name.trim().toLowerCase()] ?? TONE_CYCLE[index % TONE_CYCLE.length];
}

/** Solid colours for accent bars and progress fills (the --tone-* tokens). */
export const SOLID: Record<Tone, string> = {
  green: "bg-tone-green",
  blue: "bg-tone-blue",
  red: "bg-tone-red",
  purple: "bg-tone-purple",
  orange: "bg-tone-orange",
};

/** The same solid colours as a dot, for tags and chips. */
export const DOT = SOLID;

export const asBadgeTone = (t: Tone): BadgeTone => t;
