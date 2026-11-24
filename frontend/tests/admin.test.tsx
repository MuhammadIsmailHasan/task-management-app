import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersScreen, type AdminUser } from "@/components/admin/UsersScreen";
import { ShellContext } from "@/components/shell/ShellContext";
import { ApiError } from "@/lib/http";

const create = vi.fn();
const update = vi.fn();
vi.mock("@/lib/api", () => ({ api: { users: { create: (...a: unknown[]) => create(...a), update: (...a: unknown[]) => update(...a) } } }));

const user = (over: Partial<AdminUser>): AdminUser => ({ id: "u1", full_name: "Ann Lee", username: "ann", email: "ann@x.com", avatar_url: null, role: "member", ...over });
const shell = { session: { token: "t", userId: "a1", role: "admin" as const, exp: 9 }, user: null, boardId: null, boards: [], panel: null, inbox: null, refreshInbox: vi.fn(), toggleSidePanel: vi.fn(), closeSidePanel: vi.fn(), adjustUnread: vi.fn() };

function renderScreen(users: AdminUser[]) {
  return render(
    <ShellContext.Provider value={shell}>
      <UsersScreen initial={users} />
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
    expect(rows[0]).toHaveTextContent("@ann · ann@x.com");
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
    await waitFor(() => expect(create).toHaveBeenCalledWith({ full_name: "Cy Day", username: "cyd", email: "cy@x.com", password: "long-enough-pass", role: "member" }));
    expect(await screen.findByText("Created cyd.")).toBeInTheDocument();
    expect(screen.getByText("Cy Day")).toBeInTheDocument();
  });

  it("maps a 409 onto the username and email fields", async () => {
    create.mockRejectedValue(new ApiError(409, "CONFLICT", "Username or email already registered", { username: ["username is already taken"], email: ["email is already registered"] }));
    renderScreen([]);
    await userEvent.click(screen.getByRole("button", { name: "New user" }));
    await userEvent.type(screen.getByLabelText("Full name"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
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
    expect(await screen.findByText("Saved annlr.")).toBeInTheDocument();
  });

  it("changes a role from the row", async () => {
    update.mockResolvedValue(user({ role: "supervisor" }));
    renderScreen([user({})]);
    await userEvent.click(screen.getByRole("button", { name: "Role of ann: Member" }));
    await userEvent.click(await screen.findByRole("option", { name: "Supervisor" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("u1", { role: "supervisor" }));
    expect(await screen.findByText("ann is now supervisor.")).toBeInTheDocument();
  });
});
