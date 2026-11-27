import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersScreen, type AdminUser } from "@/components/admin/UsersScreen";
import { ShellContext } from "@/components/shell/ShellContext";
import { ApiError } from "@/lib/http";
import { shellValue } from "./support/shell";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }), usePathname: () => "/app/users" }));
const create = vi.fn();
const update = vi.fn();
vi.mock("@/lib/api", () => ({ api: { users: { create: (...a: unknown[]) => create(...a), update: (...a: unknown[]) => update(...a) } } }));

const user = (over: Partial<AdminUser>): AdminUser => ({ id: "u1", full_name: "Ann Lee", username: "ann", email: "ann@x.com", avatar_url: null, role: "member", ...over });
const shell = shellValue({ session: { token: "t", userId: "a1", role: "admin" as const, exp: 9 } });

function renderScreen(users: AdminUser[]) {
  return render(
    <ShellContext.Provider value={shell}>
      <UsersScreen initial={{ items: users, page: 1, per_page: 10, total: users.length }} />
    </ShellContext.Provider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("UsersScreen", () => {
  it("lists users with name, username, email and role", () => {
    renderScreen([user({}), user({ id: "u2", full_name: "Bob Roy", username: "bob", email: "bob@x.com", role: "manager" })]);
    const rows = within(screen.getByRole("list", { name: "Users" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Ann Lee");
    expect(rows[0]).toHaveTextContent("@ann");
    expect(rows[0]).toHaveTextContent("ann@x.com");
    expect(screen.getByRole("button", { name: "Role of bob: Manager" })).toHaveTextContent("Manager");
  });

  it("creates a user with username, email, password and role, and shows it in the list", async () => {
    create.mockResolvedValue(user({ id: "u3", full_name: "Cy Day", username: "cyd", email: "cy@x.com" }));
    renderScreen([]);
    await userEvent.click(screen.getByRole("button", { name: "New user" }));
    await userEvent.type(screen.getByLabelText("Full name"), "Cy Day");
    await userEvent.type(screen.getByLabelText("Username"), "cyd");
    await userEvent.type(screen.getByLabelText("Email"), "cy@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "long-enough-pass");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(create).not.toHaveBeenCalled();
    expect(await screen.findByText("Create user “cyd”?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ full_name: "Cy Day", username: "cyd", email: "cy@x.com", password: "long-enough-pass", role: "member" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("maps a 409 onto the username and email fields", async () => {
    create.mockRejectedValue(new ApiError(409, "CONFLICT", "Username or email already registered", { username: ["username is already taken"], email: ["email is already registered"] }));
    renderScreen([]);
    await userEvent.click(screen.getByRole("button", { name: "New user" }));
    await userEvent.type(screen.getByLabelText("Full name"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(await screen.findByRole("button", { name: "Create" }));
    expect(await screen.findByText("username is already taken")).toBeInTheDocument();
    expect(screen.getByText("email is already registered")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "true");
  });

  it("edits only name, username and email (no role, no password)", async () => {
    update.mockResolvedValue(user({ full_name: "Ann Lee-Roy", username: "annlr" }));
    renderScreen([user({})]);
    await userEvent.click(screen.getByRole("button", { name: "Edit ann" }));
    expect(screen.queryByLabelText("Password")).toBeNull();
    await userEvent.clear(screen.getByLabelText("Full name"));
    await userEvent.type(screen.getByLabelText("Full name"), "Ann Lee-Roy");
    await userEvent.clear(screen.getByLabelText("Username"));
    await userEvent.type(screen.getByLabelText("Username"), "annlr");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("u1", { full_name: "Ann Lee-Roy", username: "annlr", email: "ann@x.com" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("stages a role change in the row and saves it only after Update and a confirmation (ADM-04)", async () => {
    update.mockResolvedValue(user({ role: "supervisor" }));
    renderScreen([user({})]);
    expect(screen.getByRole("button", { name: "Update ann" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Role of ann: Member" }));
    await userEvent.click(await screen.findByRole("option", { name: "Supervisor" }));
    expect(update).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Update ann" }));
    const dialog = await screen.findByRole("dialog", { name: "Update ann?" });
    expect(within(dialog).getByText("Role: Member to Supervisor")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("u1", { role: "supervisor" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("lists every staged change together and sends one request with only the changed fields", async () => {
    update.mockResolvedValue(user({ is_active: false, is_available: false }));
    renderScreen([user({ is_active: true, is_available: true })]);
    await userEvent.click(screen.getByRole("switch", { name: "Active: ann" }));
    await userEvent.click(screen.getByRole("switch", { name: "Available: ann" }));
    await userEvent.click(screen.getByRole("button", { name: "Update ann" }));
    const dialog = await screen.findByRole("dialog", { name: "Update ann?" });
    expect(within(dialog).getByText("Active: on to off")).toBeInTheDocument();
    expect(within(dialog).getByText("Available: on to off")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith("u1", { is_active: false, is_available: false });
  });

  it("staging a change and undoing it leaves nothing to save", async () => {
    renderScreen([user({ is_active: true })]);
    const active = screen.getByRole("switch", { name: "Active: ann" });
    await userEvent.click(active);
    expect(screen.getByRole("button", { name: "Update ann" })).toBeEnabled();
    await userEvent.click(active);
    expect(screen.getByRole("button", { name: "Update ann" })).toBeDisabled();
  });

  it("cancel keeps the staged values and sends nothing", async () => {
    renderScreen([user({ is_active: true })]);
    await userEvent.click(screen.getByRole("switch", { name: "Active: ann" }));
    await userEvent.click(screen.getByRole("button", { name: "Update ann" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Update ann?" })).getByRole("button", { name: "Cancel" }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: "Active: ann" })).toHaveAttribute("aria-checked", "false");
  });

  it("shows the boards and cards that block a deactivation, with links, and changes nothing (ADM-05)", async () => {
    update.mockRejectedValue(
      new ApiError(409, "USER_HAS_OPEN_WORK", "Reassign or finish this work first.", {
        cards: [{ id: "k1", title: "Fix login", board_id: "b1", board_slug: "alpha", board_name: "Alpha" }],
        boards: [{ id: "b1", slug: "alpha", name: "Alpha", open_card_count: 2 }],
        cards_total: 1,
        boards_total: 1,
      } as never),
    );
    renderScreen([user({ is_active: true })]);
    await userEvent.click(screen.getByRole("switch", { name: "Active: ann" }));
    await userEvent.click(screen.getByRole("button", { name: "Update ann" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Update ann?" })).getByRole("button", { name: "Save" }));
    const blocked = await screen.findByRole("dialog", { name: "Ann Lee still has open work" });
    expect(within(blocked).getByText("Reassign or finish this work first.")).toBeInTheDocument();
    expect(within(blocked).getByRole("link", { name: "Alpha" })).toHaveAttribute("href", "/app/b/alpha");
    expect(within(blocked).getByRole("link", { name: "Fix login" })).toHaveAttribute("href", "/app/b/alpha?card=k1");
  });

  it("has no delete control and says accounts are turned off, never deleted", () => {
    renderScreen([user({})]);
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.getByText(/never deleted/)).toBeInTheDocument();
  });

  it("filters by name, username, or email", async () => {
    renderScreen([user({}), user({ id: "u2", full_name: "Bob Roy", username: "bob", email: "bob@x.com" })]);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search users on this page" }), "bob@");
    expect(within(screen.getByRole("list", { name: "Users" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("marks an inactive and an unavailable person on their avatar", () => {
    renderScreen([user({ is_active: false }), user({ id: "u2", full_name: "Bob Roy", username: "bob", is_available: false })]);
    expect(screen.getByRole("img", { name: "Ann Lee (Inactive)" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bob Roy (Unavailable)" })).toBeInTheDocument();
  });
});
