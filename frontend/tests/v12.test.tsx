import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fc from "fast-check";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteModal } from "@/components/board/InviteModal";
import { InviteJoin } from "@/components/invite/InviteJoin";
import { BoardUnavailable } from "@/components/board/BoardUnavailable";
import { BoardTile } from "@/components/board/BoardTile";
import { CardTile } from "@/components/board/CardTile";
import { InboxView } from "@/components/shell/InboxView";
import { ShellContext } from "@/components/shell/ShellContext";
import { Sidebar } from "@/components/shell/Sidebar";
import { CommentThread } from "@/components/card/CommentThread";
import { SubtaskChecklist } from "@/components/card/SubtaskChecklist";
import { buildPatch, mergeSent, toDraft, type Draft, type FieldKey } from "@/lib/autosave";
import { hrefFor, sentenceFor } from "@/lib/inbox";
import { deriveProgress, withSubtasks } from "@/lib/progress";
import { safeReturnPath } from "@/lib/return-path";
import type { Board, Card, Comment, JoinRequest, Member, Notification } from "@/lib/types";
import { proxy } from "@/proxy";

const mocks = vi.hoisted(() => ({
  api: {
    boards: { members: vi.fn(), invite: vi.fn(), enableInvite: vi.fn(), regenerateInvite: vi.fn(), disableInvite: vi.fn(), joinRequests: vi.fn(), removeMember: vi.fn(), create: vi.fn() },
    invites: { decide: vi.fn(), request: vi.fn() },
    notifications: { inbox: vi.fn(), markRead: vi.fn(), readAll: vi.fn() },
    subtasks: { update: vi.fn(), create: vi.fn(), remove: vi.fn() },
    auth: { logout: vi.fn() },
  },
}));
vi.mock("@/lib/api", () => ({ api: mocks.api }));
vi.mock("next/navigation", () => ({ usePathname: () => "/boards/b1", useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const jwt = (claims: object) => `h.${btoa(JSON.stringify(claims))}.s`;
const shell = (role: "manager" | "supervisor" | "member" | "admin", userId = "u1") => ({
  session: { token: "t", userId, role, exp: 0 },
  user: null,
  boardId: "b1",
  inbox: { items: [], unread_count: 2 },
  refreshInbox: vi.fn(),
  toggleSidePanel: vi.fn(),
  closeSidePanel: vi.fn(),
  adjustUnread: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

const note = (over: Partial<Notification>): Notification => ({
  id: "n1", type: "assigned", board_id: "b1", board_name: "Alpha", card_id: "c1", card_title: "Plan", actor_name: "Ada Lovelace",
  is_read: false, notify_date: "2026-11-21", created_at: "2026-11-21T10:00:00Z", ...over,
});

describe("Inbox links and sentences (Requirement 28)", () => {
  it.each([
    [{ type: "assigned" as const }, "/boards/b1?card=c1"],
    [{ type: "deadline" as const }, "/boards/b1?card=c1"],
    [{ type: "board_join_requested" as const, card_id: null }, "/boards/b1?invite=1"],
    [{ type: "board_added" as const, card_id: null }, "/boards/b1"],
    [{ type: "board_join_rejected" as const, card_id: null }, "/boards"],
  ])("%j goes to %s", (over, href) => expect(hrefFor(note(over))).toBe(href));

  it("writes the three new types as sentences with the actor and the board, and never an Email", () => {
    expect(sentenceFor(note({ type: "board_join_requested", card_id: null }))).toBe("Ada Lovelace asked to join “Alpha”");
    expect(sentenceFor(note({ type: "board_added", card_id: null }))).toBe("You were added to “Alpha”");
    expect(sentenceFor(note({ type: "board_join_rejected", card_id: null }))).toBe("Your request to join “Alpha” was declined");
    fc.assert(fc.property(fc.string(), (name) => !sentenceFor(note({ actor_name: name, type: "board_join_requested" })).includes("@") || name.includes("@")));
  });

  it("renders each row as one link; activating it marks read, lowers the count, and closes the panel", async () => {
    mocks.api.notifications.inbox.mockResolvedValue({ items: [note({}), note({ id: "n2", type: "board_join_requested", card_id: null })], unread_count: 2 });
    mocks.api.notifications.markRead.mockResolvedValue({});
    const ctx = shell("manager");
    render(
      <ShellContext.Provider value={ctx}>
        <InboxView />
      </ShellContext.Provider>,
    );
    const rows = await screen.findAllByRole("link");
    expect(rows.map((r) => r.getAttribute("href"))).toEqual(["/boards/b1?card=c1", "/boards/b1?invite=1"]);
    await userEvent.click(rows[0]);
    expect(ctx.adjustUnread).toHaveBeenCalledWith(-1);
    expect(ctx.closeSidePanel).toHaveBeenCalled();
    expect(mocks.api.notifications.markRead).toHaveBeenCalledWith("n1");
  });
});

describe("proxy and Safe_Return_Path know /invite", () => {
  const call = (path: string, cookie?: string) => proxy(new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie: `kanban_token=${cookie}` } } : undefined));
  it("sends a visitor from an invite link to /login?next=/invite/<token>", () => {
    const r = call("/invite/abc123");
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).searchParams.get("next")).toBe("/invite/abc123");
  });
  it("lets a signed-in visitor through", () => {
    expect(call("/invite/abc123", jwt({ sub: "u", role: "member", exp: 9_999_999_999 })).status).toBe(200);
  });
  it("returns to /invite/ paths and nothing like them", () => {
    expect(safeReturnPath("/invite/abc123")).toBe("/invite/abc123");
    expect(safeReturnPath("/invitex")).toBe("/boards");
    expect(safeReturnPath("//invite/abc")).toBe("/boards");
  });
});

const members: Member[] = [
  { id: "own", full_name: "Olive Owner", username: "olive", avatar_url: null, is_owner: true },
  { id: "m1", full_name: "Mia Member", username: "mia", avatar_url: null },
];
const boards = [{ id: "b1", name: "Alpha", owner_id: "own", archived_at: null } as Board];
const renderSidebar = (ctx: ReturnType<typeof shell>) =>
  render(
    <ShellContext.Provider value={ctx}>
      <Sidebar boards={boards} open={false} onNavigate={vi.fn()} />
    </ShellContext.Provider>,
  );

describe("Sidebar members (Requirement 22)", () => {
  beforeEach(() => mocks.api.boards.members.mockResolvedValue(members));

  it("lists the owner first, tagged Owner, with no remove button, and no Email or lock icon", async () => {
    renderSidebar(shell("manager"));
    const owner = (await screen.findByText("Olive Owner")).closest("div.flex.min-h-control") as HTMLElement;
    expect(within(owner).getByText("Owner")).toBeInTheDocument();
    expect(within(owner).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Mia Member" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/@/);
    expect(screen.queryByRole("img", { name: /(Private|Public) board/ })).not.toBeInTheDocument();
  });

  it("shows the add button to a Manager and an Admin only, never to the Board_Owner", async () => {
    const { unmount } = renderSidebar(shell("manager"));
    await screen.findByText("Olive Owner");
    expect(screen.getAllByRole("button", { name: "Add member" }).length).toBeGreaterThan(0);
    unmount();
    const owner = renderSidebar(shell("supervisor", "own"));
    await screen.findByText("Olive Owner");
    expect(screen.queryByRole("button", { name: "Add member" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Mia Member" })).toBeInTheDocument(); // the owner may still remove
    owner.unmount();
  });
});

describe("BoardTile has no visibility", () => {
  it("shows name and counts without a lock", () => {
    render(<BoardTile board={{ id: "b1", name: "Alpha", owner_id: null, archived_at: null, card_count: 2 } as Board} members={[]} />);
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /board$/ })).not.toBeInTheDocument();
  });
});

const request = (over: Partial<JoinRequest> = {}): JoinRequest => ({
  id: "r1", status: "pending", created_at: "2026-11-21T10:00:00Z",
  user: { id: "u9", full_name: "Rina Requester", username: "rina", email: "rina@example.com", avatar_url: null }, ...over,
});

describe("InviteModal (Requirement 24)", () => {
  beforeEach(() => {
    mocks.api.boards.invite.mockResolvedValue({ enabled: true, token: "tok", path: "/invite/tok" });
    mocks.api.boards.joinRequests.mockResolvedValue([request()]);
    mocks.api.invites.decide.mockResolvedValue({});
  });

  it("shows the link, the requester's Email in the pending list, and Approve and Reject to staff", async () => {
    const onChanged = vi.fn();
    render(<InviteModal boardId="b1" open onClose={vi.fn()} canDecide onChanged={onChanged} />);
    expect(await screen.findByText("Rina Requester")).toBeInTheDocument();
    expect(screen.getByText(/rina@example\.com/)).toBeInTheDocument();
    expect(screen.getByLabelText("Invite link")).toHaveValue(`${window.location.origin}/invite/tok`);
    await userEvent.click(screen.getByRole("button", { name: "Approve Rina Requester" }));
    expect(mocks.api.invites.decide).toHaveBeenCalledWith("r1", "approved");
    await waitFor(() => expect(onChanged).toHaveBeenLastCalledWith(0));
    expect(screen.queryByText("Rina Requester")).not.toBeInTheDocument();
  });

  it("shows the owner the list without actions and with the note", async () => {
    render(<InviteModal boardId="b1" open onClose={vi.fn()} canDecide={false} onChanged={vi.fn()} />);
    await screen.findByText("Rina Requester");
    expect(screen.getByText("A manager or an admin decides on requests.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Approve|Reject)/ })).not.toBeInTheDocument();
  });

  it("offers Generate when invites are off, and asks before Regenerate", async () => {
    mocks.api.boards.invite.mockResolvedValue({ enabled: false, token: null, path: null });
    mocks.api.boards.joinRequests.mockResolvedValue([]);
    mocks.api.boards.enableInvite.mockResolvedValue({ enabled: true, token: "new", path: "/invite/new" });
    render(<InviteModal boardId="b1" open onClose={vi.fn()} canDecide onChanged={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Generate invite link" }));
    expect(await screen.findByLabelText("Invite link")).toHaveValue(`${window.location.origin}/invite/new`);
    await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(mocks.api.boards.regenerateInvite).not.toHaveBeenCalled();
    expect(screen.getByText("Make a new link? The old link stops working.")).toBeInTheDocument();
  });
});

describe("Invite page (Requirement 24, criteria 23 and 24)", () => {
  const lookup = (state: "staff" | "member" | "pending" | "can_request") => ({ board: { id: "b1", name: "Alpha", description: "The plan" }, state, request: null });

  it("asks to join and then says the request was sent", async () => {
    mocks.api.invites.request.mockResolvedValue({ id: "r", board_id: "b1", status: "pending" });
    render(<InviteJoin token="tok" invite={lookup("can_request")} />);
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Request to join" }));
    expect(await screen.findByText("Request sent. You will get a notification when a manager or an admin decides.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request to join" })).not.toBeInTheDocument();
  });

  it.each([
    ["pending", "Your request is waiting for a decision."],
    ["member", "You are already a member of this board."],
    ["staff", "You already have access to every board."],
  ] as const)("%s", (state, text) => {
    render(<InviteJoin token="tok" invite={lookup(state)} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    if (state !== "pending") expect(screen.getByRole("link", { name: "Open board" })).toHaveAttribute("href", "/boards/b1");
  });
});

describe("BoardUnavailable", () => {
  it("says so in words with a link home", () => {
    render(<BoardUnavailable />);
    expect(screen.getByText("You no longer have access to this board, or it was removed.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/boards");
  });
});

const baseCard = (over: Partial<Card> = {}): Card => ({
  id: "c1", column_id: "col", category_id: null, assignee_id: null, title: "Plan", description: null, priority: "medium",
  start_date: null, end_date: null, order: 1, archived_at: null, subtasks: [], attachments: [], ...over,
});
const sub = (id: string, done: boolean) => ({ id, card_id: "c1", title: id, is_done: done, order: 1 });

describe("Derived progress and the meter (Requirement 27)", () => {
  it("rounds half up like the Backend", () => {
    expect([deriveProgress(0, 0), deriveProgress(0, 4), deriveProgress(1, 3), deriveProgress(1, 2), deriveProgress(4, 4)]).toEqual([null, 0, 3, 5, 10]);
    fc.assert(fc.property(fc.integer({ min: 1, max: 40 }), fc.nat(40), (total, d) => {
      const done = Math.min(d, total);
      const p = deriveProgress(done, total)!;
      return p >= 0 && p <= 10 && p === Math.floor((20 * done + total) / (2 * total));
    }));
  });

  it("follows the Subtasks without a reload", () => {
    const next = withSubtasks(baseCard(), [sub("a", true), sub("b", false), sub("c", false)]);
    expect([next.progress, next.subtask_done_count, next.subtask_total_count]).toEqual([3, 1, 3]);
  });

  it("shows 'done of total' on the board card only when there are Subtasks", () => {
    const props = { overdue: false, draggable: false, onOpen: vi.fn(), onDragStart: vi.fn(), onDragEnd: vi.fn() };
    const { rerender } = render(<CardTile card={baseCard()} {...props} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    rerender(<CardTile card={baseCard({ subtasks: [sub("a", true), sub("b", false)] })} {...props} />);
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });

  it("says 'No subtasks yet' in the checklist, and disables the checkbox for a viewer who cannot edit", () => {
    const { rerender } = render(<SubtaskChecklist cardId="c1" subtasks={[]} canEdit={false} onChange={vi.fn()} />);
    expect(screen.getByText("No subtasks yet")).toBeInTheDocument();
    rerender(<SubtaskChecklist cardId="c1" subtasks={[sub("a", false)]} canEdit={false} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Done: a" })).toBeDisabled();
    rerender(<SubtaskChecklist cardId="c1" subtasks={[sub("a", false)]} canEdit onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Done: a" })).toBeEnabled();
  });
});

describe("Comment deletion (Requirement 26)", () => {
  const comment = (over: Partial<Comment>): Comment => ({
    id: "k1", card_id: "c1", author_id: "me", parent_id: null, author_name: "Me", content: "Hello", is_priority: false, reply_count: 0,
    created_at: "2026-11-21T10:00:00Z", can_create_card: false, replies: [], ...over,
  });
  const thread = (comments: Comment[], viewerId: string | null, onDelete = vi.fn(async () => undefined)) =>
    render(<CommentThread comments={comments} sort="latest" canReply canPrioritize={false} onSortChange={vi.fn()} onReply={vi.fn()} onTogglePriority={vi.fn()} viewerId={viewerId} onDelete={onDelete} />);

  it("shows Delete only on the viewer's own comments", () => {
    thread([comment({}), comment({ id: "k2", author_id: "other" })], "me");
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
  });

  it("names the replies in the modal and calls delete only after confirming", async () => {
    const onDelete = vi.fn(async () => undefined);
    thread([comment({ reply_count: 2, replies: [comment({ id: "r1", parent_id: "k1" }), comment({ id: "r2", parent_id: "k1" })] })], "me", onDelete);
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Delete comment?" });
    expect(within(dialog).getByText("This also deletes its 2 replies.")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "k1" }));
  });

  it("gives no Delete to a signed-out viewer", () => {
    thread([comment({})], null);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});

describe("Property 58: auto-save sends only what changed", () => {
  const draftArb = fc.record({
    title: fc.string({ minLength: 1, maxLength: 12 }).map((t) => t.trim() || "x"), // the server stores titles trimmed
    description: fc.string({ maxLength: 12 }),
    priority: fc.constantFrom("high", "medium", "low"),
    start_date: fc.constantFrom("", "2026-01-01", "2026-02-01"),
    end_date: fc.constantFrom("", "2026-03-01", "2026-04-01"),
    category_id: fc.constantFrom("", "k1", "k2"),
    assignee_id: fc.constantFrom("", "u1", "u2"),
  }) as fc.Arbitrary<Draft>;
  const FIELDS: FieldKey[] = ["title", "description", "priority", "category_id", "assignee_id", "dates"];
  const KEYS: Record<FieldKey, string[]> = { title: ["title"], description: ["description"], priority: ["priority"], category_id: ["category_id"], assignee_id: ["assignee_id"], dates: ["start_date", "end_date"] };

  it("builds a body with only that field's keys, and none when it equals the saved value", () => {
    fc.assert(fc.property(draftArb, draftArb, fc.constantFrom(...FIELDS), (saved, next, field) => {
      const body = buildPatch(field, saved, next);
      if (body === null) return true;
      return Object.keys(body).every((k) => KEYS[field].includes(k)) && Object.keys(body).length === KEYS[field].length;
    }));
    fc.assert(fc.property(draftArb, fc.constantFrom(...FIELDS), (d, field) => buildPatch(field, d, d) === null));
  });

  it("merges only the sent fields, so a late response never overwrites another field", () => {
    fc.assert(fc.property(draftArb, draftArb, fc.constantFrom(...FIELDS), (a, b, field) => {
      const shown = baseCard({ title: a.title, description: a.description || null, priority: a.priority });
      const response = baseCard({ title: b.title, description: b.description || null, priority: b.priority });
      const merged = mergeSent(shown, response, KEYS[field]);
      const untouched = ["title", "description", "priority"].filter((k) => !KEYS[field].includes(k)) as (keyof Card)[];
      return untouched.every((k) => merged[k] === shown[k]);
    }));
  });

  it("round-trips a Card through toDraft", () => {
    expect(toDraft(baseCard({ description: null, start_date: "2026-01-01" }))).toMatchObject({ description: "", start_date: "2026-01-01" });
  });
});

describe("Role tag follows the list (Property 60)", () => {
  it("shows each member's role in the Team members rows, never manager or admin", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom("member", "supervisor"), { minLength: 1, maxLength: 4 }), async (roles) => {
        const list = roles.map((role, i) => ({ id: `r${i}`, full_name: `Person ${i}`, username: `p${i}`, avatar_url: null, role })) as Member[];
        mocks.api.boards.members.mockResolvedValue(list);
        const { unmount } = renderSidebar(shell("manager"));
        for (const [i, role] of roles.entries()) {
          const row = (await screen.findByText(`Person ${i}`)).closest("div.flex.min-h-control") as HTMLElement;
          expect(within(row).getByText(role === "supervisor" ? "Supervisor" : "Member")).toBeInTheDocument();
        }
        expect(screen.queryByText(/^(manager|admin)$/i)).not.toBeInTheDocument();
        unmount();
      }),
      { numRuns: 10 },
    );
  });
});
