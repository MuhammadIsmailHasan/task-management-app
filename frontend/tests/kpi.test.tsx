import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TeamPerformance } from "@/components/dashboard/KpiPanels";
import { days, onTimeTone, overdueNote, percent } from "@/lib/kpi";
import type { KpiFigures } from "@/lib/types";

const zero: KpiFigures = { finished: 0, on_time_rate: null, throughput: 0, overdue_now: 0, oldest_overdue_days: null, cycle_days: null, rework_rate: null, open: 0 };
const kpi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { analytics: { kpi } } }));

describe("KPI formatting", () => {
  it("shows a dash for a figure that has too few cards", () => {
    expect(percent(null)).toBe("–");
    expect(days(null)).toBe("–");
    expect(percent(0.667)).toBe("67%");
    expect(days(3)).toBe("3 d");
    expect(overdueNote(zero)).toBe("none late");
  });

  it("colours the on-time rate green, amber, or red", () => {
    expect(onTimeTone(0.8)).toBe("accent");
    expect(onTimeTone(0.5)).toBe("amber");
    expect(onTimeTone(0.49)).toBe("danger");
    expect(onTimeTone(null)).toBe("neutral");
  });
});

describe("TeamPerformance", () => {
  it("shows the team tiles and one row per person", async () => {
    kpi.mockResolvedValue({
      range: { from: "2026-11-20", to: "2026-11-26" },
      team: { ...zero, finished: 3, on_time_rate: 0.667, throughput: 3, overdue_now: 1, oldest_overdue_days: 2, cycle_days: 3, rework_rate: 0.333, open: 2 },
      people: [
        { ...zero, id: "u1", full_name: "Dina Putri", avatar_url: null, finished: 3, on_time_rate: 0.9, open: 2 },
        { ...zero, id: "u2", full_name: "Budi Santoso", avatar_url: null },
      ],
    });
    render(<TeamPerformance board="b1" from="2026-11-20" to="2026-11-26" />);
    const rows = within(await screen.findByRole("list", { name: "People" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Dina Putri");
    expect(within(rows[0]).getByText("90%")).toHaveAttribute("data-tone", "accent");
    expect(within(rows[1]).getAllByText("–").length).toBeGreaterThan(0);
    const section = within(screen.getByRole("region", { name: "Team performance" }));
    expect(section.getByText("67%")).toHaveAttribute("data-tone", "amber");
    expect(section.getByText("oldest 2 d late")).toBeInTheDocument();
    expect(kpi).toHaveBeenCalledWith({ board: "b1", from: "2026-11-20", to: "2026-11-26" });
  });
});
