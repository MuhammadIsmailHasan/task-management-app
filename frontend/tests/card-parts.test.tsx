import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "@/components/card/DateRangePicker";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";
import { BasePopover } from "@/components/shared/BasePopover";

describe("BaseModal footer", () => {
  it("renders the footer buttons under the body", async () => {
    const onSave = vi.fn();
    render(
      <BaseModal open title="Edit" onClose={() => undefined} footer={<BaseButton onClick={onSave}>Save changes</BaseButton>}>
        <p>Body</p>
      </BaseModal>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Body")).toBeInTheDocument();
  });
});

describe("BasePopover", () => {
  it("opens from its trigger and closes with Escape", async () => {
    render(
      <BasePopover label="Pick one" trigger={<BaseButton>Open</BaseButton>}>
        <p>Inside</p>
      </BasePopover>,
    );
    expect(screen.queryByText("Inside")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Inside")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("Inside")).not.toBeInTheDocument();
  });
});

describe("DateRangePicker", () => {
  function Harness({ start = "", end = "" }: { start?: string; end?: string }) {
    const [range, setRange] = useState({ start, end });
    return (
      <>
        <DateRangePicker value={range} onChange={setRange} />
        <output aria-label="range">{`${range.start}|${range.end}`}</output>
      </>
    );
  }

  it("shows both fields and enables them from the checkboxes", async () => {
    render(<Harness />);
    expect(screen.getByLabelText("Start date")).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Use a start date" }));
    expect(screen.getByLabelText("Start date")).toBeEnabled();
  });

  it("clears the end date and says why when the start moves past it", async () => {
    render(<Harness start="2026-11-10" end="2026-11-12" />);
    await userEvent.click(screen.getByLabelText("Start date"));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Start date calendar" })).getByRole("button", { name: /November 20th, 2026/ }));
    expect(screen.getByLabelText("range")).toHaveTextContent("2026-11-20|");
    expect(screen.getByText(/end date was cleared/)).toBeInTheDocument();
  });

  it("flags a typed end date before the start", () => {
    render(<Harness start="2026-11-10" end="2026-11-05" />);
    expect(screen.getByRole("alert")).toHaveTextContent("cannot be before the start date");
    expect(screen.getByLabelText("End date")).toBeInvalid();
  });

  it("accepts the same day for both dates", () => {
    render(<Harness start="2026-11-10" end="2026-11-10" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
