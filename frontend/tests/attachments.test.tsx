import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttachmentList } from "@/components/card/AttachmentList";
import { CardModal } from "@/components/card/CardModal";
import { api } from "@/lib/api";
import type { Attachment, Board, Card, Column } from "@/lib/types";

const link = { id: "a1", card_id: "c1", name: "Design brief", url: "https://example.com/brief", file_url: null, mime_type: null } as unknown as Attachment;

const card = {
  id: "c1",
  column_id: "col1",
  title: "Design page",
  description: null,
  priority: "medium",
  start_date: null,
  end_date: null,
  category_id: null,
  assignee_id: null,
  order: 1,
  attachments: [link],
  subtasks: [{ id: "s1", card_id: "c1", title: "Outline", is_done: false, order: 1 }],
  comments: [],
  activity: [],
} as unknown as Card;

vi.mock("@/lib/api", () => ({
  api: {
    attachments: { addLink: vi.fn(async () => link), upload: vi.fn(), remove: vi.fn(async () => null), freshUrl: vi.fn() },
    cards: { get: vi.fn(async () => card), update: vi.fn(async (_id: string, body: object) => ({ ...card, ...body })), remove: vi.fn(async () => null), archive: vi.fn(), activity: vi.fn(async () => []) },
    boards: { members: vi.fn(async () => []) },
    comments: { list: vi.fn(async () => []) },
    subtasks: { remove: vi.fn(async () => null), update: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/components/shell/ShellContext", () => ({
  useShell: () => ({ session: { userId: "u1", role: "manager" } }),
}));

const noop = () => undefined;
const list = (over: Partial<React.ComponentProps<typeof AttachmentList>> = {}) => (
  <AttachmentList cardId="c1" attachments={[link]} canEdit onChange={noop} {...over} />
);

describe("AttachmentList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists existing attachments that open in a new tab", () => {
    render(list());
    expect(screen.getByRole("link", { name: "Design brief" })).toHaveAttribute("target", "_blank");
  });

  it("shows only the chosen type: Link by default, File after the selector changes", async () => {
    render(list({ attachments: [] }));
    await userEvent.click(screen.getByRole("button", { name: "Add attachment" }));
    expect(screen.getByLabelText("Attachment link")).toBeInTheDocument();
    expect(screen.queryByLabelText("Upload file")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Type: Link/ }));
    await userEvent.click(screen.getByText("File"));
    expect(screen.getByLabelText("Upload file")).toBeInTheDocument();
    expect(screen.queryByLabelText("Attachment link")).not.toBeInTheDocument();
  });

  it("sends a link at once and reports the new list", async () => {
    const onChange = vi.fn();
    render(list({ attachments: [], onChange }));
    await userEvent.click(screen.getByRole("button", { name: "Add attachment" }));
    await userEvent.type(screen.getByLabelText("Attachment link"), "https://example.com/x");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(api.attachments.addLink).toHaveBeenCalledWith("c1", { url: "https://example.com/x" });
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith([link]));
  });

  it("opens the Remove attachment modal with the name, and sends nothing until confirmed", async () => {
    const onChange = vi.fn();
    render(list({ onChange }));
    await userEvent.click(screen.getByRole("button", { name: "Remove Design brief" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove attachment?" });
    expect(within(dialog).getByText("Design brief")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(api.attachments.remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Remove Design brief" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Remove attachment?" })).getByRole("button", { name: "Remove" }));
    expect(api.attachments.remove).toHaveBeenCalledWith("a1");
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith([]));
  });

  it("keeps the tile and offers Retry when the removal fails", async () => {
    vi.mocked(api.attachments.remove).mockRejectedValueOnce(new Error("boom"));
    const onChange = vi.fn();
    render(list({ onChange }));
    await userEvent.click(screen.getByRole("button", { name: "Remove Design brief" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Remove attachment?" })).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Could not remove the attachment.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Design brief" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith([]));
  });

  it("offers no add control or Remove to a viewer who cannot edit", () => {
    render(list({ canEdit: false }));
    expect(screen.queryByRole("button", { name: "Add attachment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });

  it("says so when there are no attachments", () => {
    render(list({ attachments: [], canEdit: false }));
    expect(screen.getByText("No attachments.")).toBeInTheDocument();
  });
});

const board = { id: "b1", name: "B", columns: [] } as unknown as Board;
const columns = [{ id: "col1", name: "Todo", order: 1 }] as unknown as Column[];
const modal = (onClose = noop) => render(<CardModal cardId="c1" board={board} columns={columns} categories={[]} onClose={onClose} onChanged={noop} onDeleted={noop} />);

describe("CardModal Auto_Save", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has no Save changes button and no draft: removing an attachment is sent at once after the modal", async () => {
    modal();
    await userEvent.click(await screen.findByRole("button", { name: "Remove Design brief" }));
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Remove attachment?" })).getByRole("button", { name: "Remove" }));
    expect(api.attachments.remove).toHaveBeenCalledWith("a1");
  });

  it("sends only the title when it loses focus with a new value, and nothing when it is unchanged", async () => {
    modal();
    const title = await screen.findByLabelText("Title");
    await userEvent.click(title);
    await userEvent.tab();
    expect(api.cards.update).not.toHaveBeenCalled();
    await userEvent.clear(title);
    await userEvent.type(title, "New name");
    await userEvent.tab();
    expect(api.cards.update).toHaveBeenCalledTimes(1);
    expect(api.cards.update).toHaveBeenCalledWith("c1", { title: "New name" });
  });

  it("sends no request for an empty title and says so beside the field", async () => {
    modal();
    const title = await screen.findByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.tab();
    expect(api.cards.update).not.toHaveBeenCalled();
    expect(await screen.findByText("Title is required.")).toBeInTheDocument();
  });

  it("sends the description on Ctrl+Enter and shows Saving then Saved in a polite region", async () => {
    modal();
    const box = await screen.findByLabelText("Description");
    await userEvent.type(box, "More");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(api.cards.update).toHaveBeenCalledWith("c1", { description: "More" });
    const region = document.querySelector('[data-field-status="description"]') as HTMLElement;
    expect(region).toHaveAttribute("aria-live", "polite");
    await vi.waitFor(() => expect(region).toHaveTextContent("Saved"));
  });

  it("shows the error with Retry and keeps the typed text when a save fails", async () => {
    vi.mocked(api.cards.update).mockRejectedValueOnce(new Error("offline"));
    modal();
    const title = await screen.findByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Keep me");
    await userEvent.tab();
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(title).toHaveValue("Keep me");
    await userEvent.click(retry);
    expect(api.cards.update).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.cards.update).mock.calls[1]).toEqual(["c1", { title: "Keep me" }]);
  });

  it("closes at once when nothing is pending, and asks first when a save failed", async () => {
    const onClose = vi.fn();
    modal(onClose);
    await userEvent.click(await screen.findByRole("button", { name: "Close" }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    onClose.mockClear();
    vi.mocked(api.cards.update).mockRejectedValueOnce(new Error("offline"));
    const title = screen.getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "x");
    await userEvent.tab();
    await screen.findByRole("button", { name: "Retry" });
    await userEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(await screen.findByText("Some changes were not saved. Close anyway?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Close anyway" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sends a blur save before it closes", async () => {
    const onClose = vi.fn();
    modal(onClose);
    const title = await screen.findByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Last second");
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.cards.update).toHaveBeenCalledWith("c1", { title: "Last second" });
  });

  it("asks before deleting a subtask and before deleting the card", async () => {
    modal();
    await userEvent.click(await screen.findByRole("button", { name: "Delete subtask Outline" }));
    expect(api.subtasks.remove).not.toHaveBeenCalled();
    const ask = (await screen.findByText("Delete subtask “Outline”?")).closest('[role="dialog"]') as HTMLElement;
    await userEvent.click(within(ask).getByRole("button", { name: "Delete" }));
    expect(api.subtasks.remove).toHaveBeenCalledWith("s1");

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(api.cards.remove).not.toHaveBeenCalled();
    const askCard = (await screen.findByText("Delete card?")).closest('[role="dialog"]') as HTMLElement;
    await userEvent.click(within(askCard).getByRole("button", { name: "Delete" }));
    expect(api.cards.remove).toHaveBeenCalledWith("c1");
  });

  it("uses plain attribute rows, no column select, and only Archive and Delete in the footer", async () => {
    modal();
    await screen.findByLabelText("Title");
    for (const name of [/^Column: Todo/, /^Label: /, /^Priority: Medium/, /^Dates: /, /^Assignee: /]) {
      expect(screen.getAllByLabelText(name).length).toBeGreaterThan(0);
    }
    expect(screen.queryByLabelText("Move to column")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toHaveAttribute("data-variant", "secondary");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("data-variant", "danger");
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });
});
