import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/AuthForm";
import { ApiError } from "@/lib/http";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const login = vi.fn();
const register = vi.fn();
const availability = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { auth: { login: (...a: unknown[]) => login(...a), register: (...a: unknown[]) => register(...a), availability: (...a: unknown[]) => availability(...a) } },
}));

const user = { id: "u1", full_name: "Ann", username: "ann", email: "ann@x.com", avatar_url: null };
const token = `h.${btoa(JSON.stringify({ sub: "u1", role: "member", exp: 9999999999 }))}.s`;

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, "", "/app/login");
  document.cookie = "kanban_token=; Max-Age=0; Path=/app";
  document.cookie = "kanban_token=; Max-Age=0; Path=/";
});

describe("AuthForm", () => {
  it("renders the login fields without a name field", () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByLabelText("Username or email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Full name")).toBeNull();
  });

  it("renders the register fields", () => {
    render(<AuthForm mode="register" />);
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
  });

  it("submits identifier and password, stores the token and goes to the boards", async () => {
    login.mockResolvedValue({ user, token });
    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Username or email"), "ann@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/boards"));
    expect(login).toHaveBeenCalledWith({ identifier: "ann@x.com", password: "secret-pass" });
    expect(document.cookie).toContain("kanban_token=");
  });

  it("shows a server error message", async () => {
    login.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Invalid credentials"));
    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Username or email"), "abc");
    await userEvent.type(screen.getByLabelText("Password"), "b");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username, email or password.");
    expect(push).not.toHaveBeenCalled();
  });

  it("maps validation details onto the fields", async () => {
    register.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "Validation failed", { password: ["password is too common"] }),
    );
    render(<AuthForm mode="register" />);
    await userEvent.type(screen.getByLabelText("Full name"), "Ann");
    await userEvent.type(screen.getByLabelText("Username"), "ann");
    await userEvent.type(screen.getByLabelText("Email"), "ann@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "long-enough-pass");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByText("password is too common")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("sends no request for an identifier that is neither a username nor an email", async () => {
    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Username or email"), "not valid");
    await userEvent.type(screen.getByLabelText("Password"), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter a valid username or email.")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Username or email"));
    await userEvent.type(screen.getByLabelText("Username or email"), "a@b");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("shows a countdown and disables the button after a 429", async () => {
    login.mockRejectedValue(new ApiError(429, "RATE_LIMITED", "Too many attempts", undefined, 90));
    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Username or email"), "ann");
    await userEvent.type(screen.getByLabelText("Password"), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText(/Try again in 01:30/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled();
  });

  it("checks availability on blur and shows the taken message", async () => {
    availability.mockResolvedValue({ username: { available: false } });
    render(<AuthForm mode="register" />);
    await userEvent.type(screen.getByLabelText("Username"), "ann");
    await userEvent.tab();
    expect(await screen.findByText("This username is already taken.")).toBeInTheDocument();
  });

  it("stays silent when the availability check is rate limited", async () => {
    availability.mockRejectedValue(new ApiError(429, "RATE_LIMITED", "Too many", undefined, 30));
    render(<AuthForm mode="register" />);
    await userEvent.type(screen.getByLabelText("Username"), "ann");
    await userEvent.tab();
    await waitFor(() => expect(availability).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("validates every register field on submit, shows every error at once, focuses the first, and sends nothing (FIX-04)", async () => {
    render(<AuthForm mode="register" />);
    await userEvent.click(screen.getByRole("button", { name: "Register" }));
    for (const label of ["Full name", "Username", "Email", "Password"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText(label)).toHaveAttribute("aria-describedby", expect.stringMatching(/-error$/));
    }
    expect(screen.getByLabelText("Full name")).toHaveFocus();
    expect(register).not.toHaveBeenCalled();
  });

  it("validates both login fields at once (FIX-04)", async () => {
    render(<AuthForm mode="login" />);
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByLabelText("Username or email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(login).not.toHaveBeenCalled();
  });

  it("clears a field's error as soon as it is edited, and only that field's (FIX-03)", async () => {
    render(<AuthForm mode="register" />);
    await userEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getByText("Full name is required.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Full name"), "A");
    expect(screen.queryByText("Full name is required.")).toBeNull();
    expect(screen.getByLabelText("Full name")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("clears a server error on edit and does not bring it back until the next submit (FIX-03)", async () => {
    register.mockRejectedValue(new ApiError(409, "CONFLICT", "taken", { username: ["This username is already taken."] }));
    render(<AuthForm mode="register" />);
    await userEvent.type(screen.getByLabelText("Full name"), "Ann");
    await userEvent.type(screen.getByLabelText("Username"), "ann");
    await userEvent.type(screen.getByLabelText("Email"), "ann@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "long-enough-pass");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByText("This username is already taken.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Username"), "2");
    expect(screen.queryByText("This username is already taken.")).toBeNull();
  });
});

describe("register, confirmation, and the destination (V17, ACT-01, ACT-02, ACT-12)", () => {
  const fill = async () => {
    await userEvent.type(screen.getByLabelText("Full name"), "Ann");
    await userEvent.type(screen.getByLabelText("Username"), "ann_1");
    await userEvent.type(screen.getByLabelText("Email"), "ann@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "long-enough-pass");
  };

  it("goes to the check-your-email page after register, signs nobody in, and keeps the address and destination out of the URL", async () => {
    register.mockResolvedValue({ user, token: null });
    render(<AuthForm mode="register" next="/app/invite/abc" />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Register" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/verify"));
    expect(document.cookie).not.toContain("kanban_token=");
    expect(JSON.parse(sessionStorage.getItem("revoboard.pending-activation")!)).toEqual({ email: "ann@x.com", next: "/app/invite/abc" });
  });

  it("keeps the destination on the links between the two forms", () => {
    render(<AuthForm mode="login" next="/app/invite/abc" />);
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/app/register?next=%2Fapp%2Finvite%2Fabc");
  });

  it("shows the unconfirmed message with a resend link, and the disabled message without one", async () => {
    login.mockRejectedValueOnce(new ApiError(403, "ACCOUNT_NOT_ACTIVATED", "Confirm your email address first"));
    const { unmount } = render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Username or email"), "ann@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Confirm your email address first")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resend confirmation email" })).toHaveAttribute("href", "/app/verify");
    unmount();
    login.mockRejectedValueOnce(new ApiError(403, "ACCOUNT_DISABLED", "This account is disabled"));
    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Username or email"), "ann@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("This account is disabled")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Resend confirmation email" })).not.toBeInTheDocument();
  });
});
