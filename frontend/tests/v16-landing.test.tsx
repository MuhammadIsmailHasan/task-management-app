import { render, screen } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { ClosingCta, Faq, Features, Hero, LandingFooter, Roles, Teams, Workflow } from "@/components/landing/sections";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { SAMPLE_CARDS, SAMPLE_COLUMNS, sampleFigures } from "@/lib/landing-sample";
import { deriveProgress } from "@/lib/progress";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const APP = "https://app.example.test";
const page = () =>
  render(
    <>
      <LandingHeader appUrl={APP} />
      <main>
        <Hero appUrl={APP} />
        <Features />
        <Workflow />
        <Teams />
        <Roles />
        <Faq />
        <ClosingCta appUrl={APP} />
      </main>
      <LandingFooter appUrl={APP} />
    </>,
  );

describe("Landing_Page (Requirement 41)", () => {
  it("renders the parts in order with the ids the header links to (LAND-02)", () => {
    const { container } = page();
    const ids = Array.from(container.querySelectorAll("main section[id]")).map((s) => s.id);
    expect(ids).toEqual(["features", "workflow", "teams", "roles", "faq"]);
  });

  it("has one h1 and links out only to the App_Host and to its own anchors (LAND-04, LAND-12)", () => {
    const { container } = page();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href")!);
    expect(links.filter((h) => h.startsWith("http")).every((h) => h.startsWith(APP))).toBe(true);
    expect(links.filter((h) => !h.startsWith("http") && !h.startsWith("#") && h !== "/")).toEqual([]);
    expect(links).toContain(`${APP}/register`);
    expect(links).toContain(`${APP}/login`);
  });

  it("uses relative app paths when APP_URL is unset", () => {
    render(<Hero appUrl="" />);
    expect(screen.getAllByRole("link", { name: /Get started/ })[0]).toHaveAttribute("href", "/register");
  });

  it("asks the four FAQ questions as native details elements", () => {
    const { container } = render(<Faq />);
    expect(container.querySelectorAll("details")).toHaveLength(4);
  });

  it("claims nothing the product lacks: no pricing, tiers, Viewer role, or the old name (LAND-13)", () => {
    const { container } = page();
    expect(container.textContent).not.toMatch(/pricing|enterprise|\bPRO\b|viewer|testimonial|RevoTask|Revision trigger/i);
    expect(container.textContent).toMatch(/Member/);
    expect(container.textContent).toMatch(/Guest/);
  });

  it("makes no request and reads no cookie, header, or storage (LAND-01)", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const files = [...readdirSync(path.join(root, "components", "landing")).map((f) => path.join(root, "components", "landing", f)), path.join(root, "app", "site", "page.tsx")];
    for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/\bfetch\(|cookies\(|headers\(|localStorage|sessionStorage|@\/lib\/api/);
  });
});

describe("product preview (LAND-06, Property 68)", () => {
  it("is inert, hidden from assistive technology, and described by a caption", () => {
    const { container } = render(<ProductPreview />);
    const frame = container.querySelector("[inert]")!;
    expect(frame).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("figcaption")).toHaveTextContent("Illustration of a RevoBoard board");
  });

  it("shows only numbers the app's own functions compute from the sample data", () => {
    const f = sampleFigures();
    const { container } = render(<ProductPreview />);
    const text = container.textContent!;
    expect(text).toContain(`${f.percent}% Done`);
    expect(text).toContain(`${f.subtasksDone} of ${f.subtasksTotal} subtasks done`);
    for (const p of f.perColumn) expect(text).toContain(`${p.count} ${p.count === 1 ? "task" : "tasks"}`);
    expect(f.totalCards).toBe(SAMPLE_CARDS.length);
    expect(f.perColumn.map((p) => p.name)).toEqual(SAMPLE_COLUMNS.map((c) => c.name));
    for (const { card } of SAMPLE_CARDS) expect(card.progress).toBe(deriveProgress(card.subtask_done_count ?? 0, card.subtask_total_count ?? 0));
  });
});
