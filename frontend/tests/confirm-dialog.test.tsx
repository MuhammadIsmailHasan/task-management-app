import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BaseButton } from "@/components/shared/BaseButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

function setup(onConfirm: () => void | Promise<void>, tone: "danger" | "primary" = "danger") {
  render(
    <ConfirmDialog
      tone={tone}
      confirmLabel={tone === "danger" ? "Delete" : "Create"}
      title={tone === "danger" ? "Delete column “Review”?" : "Create board “Q3 plan”?"}
      message="Body text."
      onConfirm={onConfirm}
      trigger={<BaseButton>Open</BaseButton>}
    />,
  );
}

describe("ConfirmDialog (Requirement 45, FIX-07 to FIX-11)", () => {
  it("names the item, runs nothing until confirmed, and runs exactly once after", async () => {
    const onConfirm = vi.fn();
    setup(onConfirm);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog", { name: "Delete column “Review”?" })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("uses the danger recipe for a delete and the primary recipe for a create", async () => {
    setup(vi.fn());
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("data-variant", "danger");
  });

  it("uses the primary recipe for a create", async () => {
    setup(vi.fn(), "primary");
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute("data-variant", "primary");
  });

  it("starts on Cancel for a delete and on the primary action for a create", async () => {
    setup(vi.fn());
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("focuses the create button first for a create", async () => {
    setup(vi.fn(), "primary");
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toHaveFocus());
  });

  it("closes on Escape and on Cancel without running the action, and returns focus to the trigger", async () => {
    const onConfirm = vi.fn();
    setup(onConfirm);
    const trigger = screen.getByRole("button", { name: "Open" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("describes the dialog by its body", async () => {
    setup(vi.fn());
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/Body text\./);
  });

  it("shows a busy state while the request runs", async () => {
    let finish!: () => void;
    setup(() => new Promise<void>((resolve) => (finish = resolve)));
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("stays open with the error when the request fails", async () => {
    setup(() => Promise.reject(new Error("Move or archive its 2 cards first.")));
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Move or archive its 2 cards first.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
  });
});
