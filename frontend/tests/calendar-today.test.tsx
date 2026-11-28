import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarView } from "@/components/board/CalendarView";
import { toIso } from "@/lib/dates";

describe("CalendarView today", () => {
  it("marks only today with the accent border and a filled day number", () => {
    render(<CalendarView columns={[]} cards={[]} onOpen={() => undefined} />);
    const today = screen.getByRole("gridcell", { current: "date" });
    expect(today).toHaveClass("border-accent");
    expect(today.querySelector(".bg-accent")).toHaveTextContent(String(Number(toIso(new Date()).slice(8))));
    const others = screen.getAllByRole("gridcell").filter((c) => c !== today);
    expect(others.every((c) => c.classList.contains("border-transparent") && !c.querySelector(".bg-accent"))).toBe(true);
  });
});
