import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { ShellContext } from "@/components/shell/ShellContext";
import { AppHeader } from "@/components/shell/AppHeader";
import { shellValue } from "./support/shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/boards", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/lib/api", () => ({ api: { boards: { members: vi.fn().mockResolvedValue([]) }, auth: { logout: vi.fn() } } }));

const ROOT = path.resolve(import.meta.dirname, "..");
const shell = shellValue();

function renderHeader() {
  return render(
    <ShellContext.Provider value={shell}>
      <AppHeader board={null} drawerOpen={false} onToggleDrawer={vi.fn()} />
    </ShellContext.Provider>,
  );
}

beforeEach(() => localStorage.clear());

describe("BrandLogo", () => {
  it("draws the mark and the full logo with the right file, size and alt text", () => {
    const { container } = render(
      <>
        <BrandLogo variant="mark" />
        <BrandLogo variant="full" />
      </>,
    );
    const [mark, full] = Array.from(container.querySelectorAll("img"));
    expect(mark.getAttribute("src")).toBe("/brand/logo-revo.svg");
    expect([mark.getAttribute("width"), mark.getAttribute("height")]).toEqual(["203", "203"]);
    expect(full.getAttribute("src")).toBe("/brand/logo-text-revo.svg");
    expect([full.getAttribute("width"), full.getAttribute("height")]).toEqual(["704", "121"]);
    expect(mark.getAttribute("alt")).toBe("RevoBoard");
    expect(full.getAttribute("alt")).toBe("RevoBoard");
  });

  it("is decorative (empty alt) when asked", () => {
    const { container } = render(<BrandLogo variant="mark" decorative />);
    expect(container.querySelector("img")!.getAttribute("alt")).toBe("");
  });
});

describe("App_Header logo (SHELL-10)", () => {
  it("shows the full logo from 960 pixels and the mark with the wordmark below, once, in one home link", () => {
    renderHeader();
    const home = screen.getByRole("link", { name: "RevoBoard home" });
    const srcs = Array.from(home.querySelectorAll("img")).map((i) => i.getAttribute("src"));
    expect(srcs).toEqual(["/brand/logo-text-revo.svg", "/brand/logo-revo.svg"]);
    expect(home).toHaveAttribute("href", "/app/boards");
  });
});

describe("branding source rules (Req 21.3, 21.4, 21.14)", () => {
  function tsx(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const full = path.join(dir, n);
      return statSync(full).isDirectory() ? tsx(full) : full.endsWith(".tsx") || full.endsWith(".ts") ? [full] : [];
    });
  }
  const sources = [...tsx(path.join(ROOT, "components")), ...tsx(path.join(ROOT, "app"))].map((f) => ({ file: path.relative(ROOT, f), text: readFileSync(f, "utf8") }));

  it("writes the logo paths and uses <img> or next/image only in BrandLogo", () => {
    const paths = sources.filter((s) => s.text.includes("/brand/")).map((s) => s.file);
    expect(paths).toEqual([path.join("components", "shared", "BrandLogo.tsx")]);
    const raw = sources.filter((s) => /<img\b/.test(s.text) || /from "next\/image"/.test(s.text)).map((s) => s.file);
    expect(raw.sort()).toEqual([path.join("components", "shared", "BaseAvatar.tsx"), path.join("components", "shared", "BrandLogo.tsx")].sort());
  });

  it("keeps the icon and the logos where the spec puts them, with no copy left behind", () => {
    expect(() => statSync(path.join(ROOT, "images"))).toThrow();
    expect(statSync(path.join(ROOT, "public", "brand", "logo-revo.svg")).size).toBeGreaterThan(0);
    expect(statSync(path.join(ROOT, "public", "brand", "logo-text-revo.svg")).size).toBeGreaterThan(0);
    const ico = readFileSync(path.join(ROOT, "app", "favicon.ico"));
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
  });

  it("has no manual icon link and no metadata.icons or images config", () => {
    const layout = readFileSync(path.join(ROOT, "app", "layout.tsx"), "utf8");
    expect(layout).not.toMatch(/rel="icon"|icons\s*:/);
    expect(readFileSync(path.join(ROOT, "next.config.ts"), "utf8")).not.toMatch(/images|dangerouslyAllowSVG/);
  });
});

describe("Logo files are transparent (FIX-01)", () => {
  it("has a fully transparent corner in the PNG inside each logo SVG", async () => {
    const sharp = (await import("sharp")).default;
    for (const file of ["logo-revo.svg", "logo-text-revo.svg"]) {
      const svg = readFileSync(path.join(ROOT, "public/brand", file), "utf8");
      const match = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
      expect(match, file).not.toBeNull();
      const { data, info } = await sharp(Buffer.from(match![1], "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
      for (const [x, y] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) expect(alphaAt(x, y), `${file} ${x},${y}`).toBe(0);
    }
  });
});

describe("Auth layout (FIX-01, FIX-02)", () => {
  const layout = readFileSync(path.join(ROOT, "components/AuthSplitLayout.tsx"), "utf8");
  const shellSrc = readFileSync(path.join(ROOT, "components/shell/AppShell.tsx"), "utf8");
  const tokens = (src: string, re: RegExp) => (src.match(re) ?? []).sort();

  it("draws the logo with no tile behind it", () => {
    expect(layout).not.toMatch(/bg-surface-raised p-3/);
    expect(layout).toContain("<BrandLogo");
  });

  it("uses the canvas, surface, radius and shadow tokens of the app frame", () => {
    for (const re of [/bg-surface(?![-\w])/g, /bg-surface-raised/g, /rounded-frame/g, /shadow-card/g]) {
      expect(tokens(layout, re).length, String(re)).toBeGreaterThan(0);
      expect(tokens(shellSrc, re).length, String(re)).toBeGreaterThan(0);
    }
    expect(layout).not.toMatch(/shadow-panel/);
  });
});
