import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");
const css = readFileSync(path.join(ROOT, "styles", "tokens.css"), "utf8");

function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token --${name} is not a hex colour`);
  return m[1];
}

function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("Design_System contrast (Requirement 38, DS-07, Property 67)", () => {
  const surfaces = ["surface-100", "surface-200", "surface-sunken"];
  const text: [string, string[]][] = [
    ["ink", surfaces],
    ["ink-muted", [...surfaces, "surface-strong"]],
    ["accent", surfaces],
    ["danger", surfaces],
    ["on-brand", ["brand", "brand-soft"]],
    ["on-brand-muted", ["brand", "brand-soft"]],
    ["on-accent", ["accent"]],
    ["on-accent-tint", ["accent-tint"]],
    ["on-danger", ["danger"]],
    ["on-danger-soft", ["danger-soft"]],
  ];
  it.each(text.flatMap(([fg, bgs]) => bgs.map((bg) => [fg, bg] as const)))("%s on %s is at least 4.5 to 1", (fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps every label pair at 4.5 to 1", () => {
    for (const c of ["green", "yellow", "orange", "red", "purple", "blue"]) expect(ratio(token(`label-${c}-text`), token(`label-${c}-bg`))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the focus ring at 3 to 1 on every surface", () => {
    for (const s of surfaces) expect(ratio(token("ring"), token(s))).toBeGreaterThanOrEqual(3);
  });
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const full = path.join(dir, n);
    return statSync(full).isDirectory() ? files(full) : /\.(tsx?|css)$/.test(n) ? [full] : [];
  });
}

describe("Design_System rules (V16-T01)", () => {
  const sources = [...files(path.join(ROOT, "components")), ...files(path.join(ROOT, "app")), ...files(path.join(ROOT, "styles"))].map((f) => ({ file: path.relative(ROOT, f), text: readFileSync(f, "utf8") }));

  it("no longer defines the retired tokens", () => {
    for (const t of ["--text-heading", "--text-lg", "--radius-md", "--radius-lg", "--surface-hover", "--text-2xl"]) expect(css).not.toContain(`${t}:`);
  });

  it("uses only the one radius and the circle (DS-18, V18 round 3)", () => {
    const bad = sources.filter((s) => /\brounded-(?!(ui|full|t-|b-|l-|r-|tl-|tr-|bl-|br-)\b)[a-z0-9-]+/.test(s.text.replace(/rounded-(t|b|l|r)(l|r)?-(ui|full)/g, ""))).map((s) => s.file);
    expect(bad).toEqual([]);
  });

  it("loads no third-party font or icon service", () => {
    const bad = sources.filter((s) => /fonts\.googleapis\.com|fonts\.gstatic\.com|Material Symbols/i.test(s.text)).map((s) => s.file);
    expect(bad).toEqual([]);
  });

  it("self-hosts both font families", () => {
    const layout = readFileSync(path.join(ROOT, "app", "layout.tsx"), "utf8");
    expect(layout).toContain("@fontsource-variable/inter");
    expect(layout).toContain("@fontsource-variable/plus-jakarta-sans");
  });
});
