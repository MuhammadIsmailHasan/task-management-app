import type { BadgeTone } from "@/components/shared/BaseBadge";

export const TONE_CYCLE = ["green", "blue", "red", "purple", "orange"] as const;
export const PALETTE = ["red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose", "slate"] as const;
export type Tone = (typeof PALETTE)[number];

const COLUMN_TONE: Record<string, Tone> = {
  todo: "orange",
  "to do": "orange",
  "in progress": "blue",
  review: "purple",
  revision: "red",
  done: "green",
};

export function toneForId(id: string): Tone {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONE_CYCLE[hash % TONE_CYCLE.length];
}

export function categoryTone(c: { id: string; color: string | null }): Tone {
  return (PALETTE as readonly string[]).includes(c.color ?? "") ? (c.color as Tone) : toneForId(c.id);
}

export function columnTone(name: string, index: number): Tone {
  return COLUMN_TONE[name.trim().toLowerCase()] ?? TONE_CYCLE[index % TONE_CYCLE.length];
}

export const SOLID: Record<Tone, string> = {
  red: "bg-tone-red",
  orange: "bg-tone-orange",
  amber: "bg-tone-amber",
  yellow: "bg-tone-yellow",
  lime: "bg-tone-lime",
  green: "bg-tone-green",
  emerald: "bg-tone-emerald",
  teal: "bg-tone-teal",
  cyan: "bg-tone-cyan",
  sky: "bg-tone-sky",
  blue: "bg-tone-blue",
  indigo: "bg-tone-indigo",
  violet: "bg-tone-violet",
  purple: "bg-tone-purple",
  fuchsia: "bg-tone-fuchsia",
  pink: "bg-tone-pink",
  rose: "bg-tone-rose",
  slate: "bg-tone-slate",
};

export const DOT = SOLID;

export const asBadgeTone = (t: Tone): BadgeTone => t;
