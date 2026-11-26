import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** DS-14 to DS-17 (V18): one radius per role, one look for every form control, no magic number. */
const ROOT = path.resolve(import.meta.dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(tsx|ts)$/.test(full) ? [full] : [];
  });
}

const all = ["components", "app", "lib", "hooks"].flatMap((d) => files(path.join(ROOT, d))).map((f) => ({ file: path.relative(ROOT, f), text: readFileSync(f, "utf8") }));
const outsideUi = all.filter((s) => !s.file.startsWith(path.join("components", "ui")));
/** Comments are not code. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("no magic number (DS-16)", () => {
  it("has no raw px, rgb, hsl, or hex value outside the tokens", () => {
    const raw = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b\d+(\.\d+)?px\b/;
    const bad = outsideUi.filter((s) => raw.test(code(s.text).replace(/&#\d+;/g, ""))).map((s) => s.file);
    expect(bad).toEqual([]);
  });

  it("has no inline style with a literal length or colour; a computed percentage or a measured height is allowed", () => {
    const styles = outsideUi.flatMap((s) => [...code(s.text).matchAll(/style=\{\{([^}]*)\}\}/g)].map((m) => ({ file: s.file, body: m[1] })));
    const bad = styles.filter(({ body }) => /:\s*["']?\d/.test(body) && !/\$\{[^}]+\}%/.test(body)).map((s) => s.file);
    expect(bad).toEqual([]);
  });
});

describe("one radius for every component (DS-18)", () => {
  const tsx = all.filter((s) => s.file.endsWith(".tsx"));
  const literals = tsx.flatMap((s) => [...code(s.text).matchAll(/"[^"\n]*"|`[^`]*`/g)].map((m) => ({ file: s.file, text: m[0] })));

  it("defines only two radius tokens: the one radius and the circle", () => {
    const css = readFileSync(path.join(ROOT, "styles", "tokens.css"), "utf8");
    expect([...css.matchAll(/--radius-([a-z]+):/g)].map((m) => m[1]).sort()).toEqual(["full", "ui"]);
  });

  it("uses no other radius utility anywhere", () => {
    const allowed = /^!?rounded-(?:(?:[tblr]|tl|tr|bl|br)-)?(?:ui|full)$/;
    const bad = literals.flatMap((l) => (l.text.match(/(?<![\w-])!?rounded(?:-[\w-]+)?/g) ?? []).filter((u) => !allowed.test(u)).map((u) => `${l.file}: ${u}`));
    expect(bad).toEqual([]);
  });

  it("keeps the circle for avatars, dots, and the switch only", () => {
    const circles = literals.filter((l) => /(?<![\w-])rounded-full\b/.test(l.text));
    const bad = circles.filter((l) => !l.file.endsWith("BaseAvatar.tsx") && !/size-(dot|dot-md|alert-dot|switch-thumb)\b|h-switch-h/.test(l.text));
    expect(bad.map((b) => `${b.file}: ${b.text.slice(0, 60)}`)).toEqual([]);
  });

  it("draws every form control with the shared control look and the inset focus ring", () => {
    const shared = (name: string) => readFileSync(path.join(ROOT, "components", "shared", name), "utf8");
    const input = readFileSync(path.join(ROOT, "components", "ui", "input.tsx"), "utf8");
    expect(input).toMatch(/controlClasses =\s*"[^"]*rounded-ui[^"]*focus-ring-inset/);
    for (const name of ["BaseCombobox.tsx", "BaseDateField.tsx", "ColorSwatchPicker.tsx"]) expect(shared(name), name).toContain("controlClasses");
    expect(shared("BaseCombobox.tsx")).not.toMatch(/BaseButton/);
  });
});

describe("padding from the two padding tokens (DS-19)", () => {
  it("pads every surface and item with p-surface or p-item, never a raw step", () => {
    const tsx = all.filter((s) => s.file.endsWith(".tsx") && !s.file.startsWith(path.join("components", "landing")));
    const literals = tsx.flatMap((s) => [...code(s.text).matchAll(/"[^"\n]*"|`[^`]*`/g)].map((m) => ({ file: s.file, text: m[0] })));
    // a surface: a bordered or raised block with the one radius and an all-round padding
    const bad = literals.filter((l) => /rounded-ui\b/.test(l.text) && /(?:border|shadow-card|bg-surface)/.test(l.text) && /(?<![\w-])(?:lg:)?p-(?:3|4|5|6|8)\b/.test(l.text));
    expect(bad.map((b) => `${b.file}: ${b.text.slice(0, 70)}`)).toEqual([]);
  });
});

describe("one small type scale (DS-22)", () => {
  it("uses only the six text sizes", () => {
    const allowed = new Set(["xs", "sm", "base", "page-title", "xl", "display"]);
    const tsx = all.filter((s) => s.file.endsWith(".tsx"));
    const sizes = tsx.flatMap((s) => [...code(s.text).matchAll(/(?<![\w-])(?:[a-z]+:)*text-(2xs|xs|sm|base|meta|page-title|title|xl|2xl|3xl|display|card-[a-z]+|lg)\b/g)].map((m) => `${s.file}: ${m[1]}`));
    expect(sizes.filter((x) => !allowed.has(x.split(": ")[1]))).toEqual([]);
    const css = readFileSync(path.join(ROOT, "styles", "tokens.css"), "utf8");
    expect([...new Set([...css.matchAll(/--text-([a-z-]+?)(?:-lh)?:/g)].map((m) => m[1]))].sort()).toEqual(["base", "display", "page-title", "sm", "xl", "xs"]);
  });

  it("the Board toolbar uses one text size for its chips, progress, and search", () => {
    const header = readFileSync(path.join(ROOT, "components", "board", "BoardHeader.tsx"), "utf8");
    const chip = readFileSync(path.join(ROOT, "components", "shared", "BaseChip.tsx"), "utf8");
    expect(chip).toMatch(/text-sm/);
    expect(chip).not.toMatch(/text-xs/);
    expect(header).not.toMatch(/Total Tasks/);
  });
});

describe("one size per heading level (DS-24)", () => {
  const tsx = all.filter((s) => s.file.endsWith(".tsx"));
  const heads = tsx.flatMap((s) => [...code(s.text).matchAll(/<(h[1-4])\b[^>]*?className=(?:"([^"]*)"|\{[^}]*?"([^"]*)")/g)].map((m) => ({ file: s.file, tag: m[1], cls: m[2] ?? m[3] ?? "" })));
  const size = (cls: string) => cls.match(/(?<![\w-])text-(xs|sm|base|page-title|xl|display)\b/)?.[1];
  it("h1 is xl (the landing hero alone is display), h2 is page-title, h3 and h4 are base or an xs eyebrow", () => {
    const bad = heads.filter(({ file, tag, cls }) => {
      if (/sr-only/.test(cls)) return false;
      const s = size(cls);
      if (tag === "h1") return !(s === "xl" || (s === "display" && file.includes("landing")));
      if (tag === "h2") return s !== "page-title";
      return !(s === "base" || (s === "xs" && /uppercase/.test(cls)));
    });
    expect(bad.map((b) => `${b.file} <${b.tag}> ${b.cls}`)).toEqual([]);
  });
});
