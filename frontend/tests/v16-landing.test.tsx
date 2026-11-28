import { render, screen, within } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { ClosingCta, Features, Hero, LandingFooter, Roles, Workflow } from "@/components/landing/sections";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { SAMPLE_CARDS, SAMPLE_COLUMNS, sampleFigures } from "@/lib/landing-sample";
import { deriveProgress } from "@/lib/progress";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const page = () =>
  render(
    <>
      <LandingHeader />
      <main>
        <Hero />
        <Features />
        <Workflow />
        <Roles />
        <ClosingCta />
      </main>
      <LandingFooter />
    </>,
  );

describe("Landing_Page (Requirement 41)", () => {
  it("renders the parts in order with the ids the header links to (LAND-02)", () => {
    const { container } = page();
    const ids = Array.from(container.querySelectorAll("main section[id]")).map((s) => s.id);
    expect(ids).toEqual(["features", "workflow", "roles"]);
  });

  it("has one h1 and links only to the app under /app, to `/`, and to its own anchors (LAND-04, LAND-12, PATH-12)", () => {
    const { container } = page();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href")!);
    expect(links.filter((h) => !h.startsWith("#") && h !== "/" && !h.startsWith("/app/"))).toEqual([]);
    expect(links).toContain("/app/register");
    expect(links).toContain("/app/login");
  });

  it("sends the call to action to the register page under /app", () => {
    render(<Hero />);
    expect(screen.getAllByRole("link", { name: /Get started/ })[0]).toHaveAttribute("href", "/app/register");
  });

  it("keeps the copy short: one line per idea and no FAQ (round 5)", () => {
    const { container } = page();
    expect(container.querySelectorAll("details")).toHaveLength(0);
    for (const p of Array.from(container.querySelectorAll("main p"))) expect((p.textContent ?? "").split(/\s+/).length).toBeLessThanOrEqual(16);
  });

  it("claims nothing the product lacks: no pricing, tiers, Viewer role, or the old name (LAND-13)", () => {
    const { container } = page();
    expect(container.textContent).not.toMatch(/pricing|enterprise|\bPRO\b|viewer|testimonial|RevoTask|Revision trigger/i);
    expect(container.textContent).toMatch(/Member/);
    expect(container.textContent).toMatch(/Guest/);
  });

  it("makes no request and reads no cookie, header, or storage (LAND-01)", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const files = [...readdirSync(path.join(root, "components", "landing")).map((f) => path.join(root, "components", "landing", f)), path.join(root, "app", "page.tsx")];
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

describe("Workflow and Roles sections", () => {
  it("shows the five columns as ordered steps with their column colour", () => {
    render(<Workflow />);
    const steps = screen.getAllByRole("listitem").filter((li) => li.closest("ol"));
    expect(steps.map((li) => li.querySelector("h3")?.textContent)).toEqual(["Todo", "In Progress", "Review", "Revision", "Done"]);
    expect(steps[0].querySelector(".bg-tone-orange")).not.toBeNull();
    expect(steps[4].querySelector(".bg-tone-green")).not.toBeNull();
    expect(screen.getByText("Revision loops back to Review until the work passes.")).toBeInTheDocument();
  });

  it("shows the columns as a board of real card tiles", () => {
    const { container } = render(<Workflow />);
    expect(container.querySelectorAll("[inert] [data-card-id]")).toHaveLength(SAMPLE_CARDS.length);
  });

  it("shows one row per role with its badge and a mark for each ability", () => {
    render(<Roles />);
    const rows = screen.getByRole("list", { name: "Roles" }).querySelectorAll(":scope > li");
    expect(rows).toHaveLength(5);
    expect([...rows].map((c) => c.querySelector("[data-tone]")?.textContent)).toEqual(["Member", "Supervisor", "Manager", "Admin", "Guest"]);
    expect(within(rows[0] as HTMLElement).getAllByText("Assigned")).toHaveLength(2);
    expect(within(rows[4] as HTMLElement).getAllByText("No")).toHaveLength(5);
  });
});

