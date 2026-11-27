import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyView, PENDING_KEY } from "@/components/auth/VerifyView";
import { ProfileView } from "@/components/profile/ProfileView";
import { ApiError } from "@/lib/http";
import type { User } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  tab: { value: null as string | null },
  api: {
    auth: {
      updateMe: vi.fn(),
      availability: vi.fn(),
      changePassword: vi.fn(),
      resendEmailChange: vi.fn(),
      cancelEmailChange: vi.fn(),
      verify: vi.fn(),
      resendVerification: vi.fn(),
      uploadAvatar: vi.fn(),
      removeAvatar: vi.fn(),
    },
    notifications: { preferences: vi.fn(), savePreferences: vi.fn() },
  },
}));
vi.mock("@/lib/api", () => ({ api: mocks.api }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/profile",
  useRouter: () => ({ replace: mocks.replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mocks.tab.value ? `tab=${mocks.tab.value}` : ""),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const me = (over: Partial<User> = {}): User => ({ id: "u1", full_name: "Ann Lee", username: "ann", email: "ann@x.com", avatar_url: null, is_active: true, is_available: true, pending_email: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tab.value = null;
  sessionStorage.clear();
  mocks.api.auth.availability.mockResolvedValue({ username: { available: true } });
});

describe("Profile layout and tabs (PRF-01)", () => {
  it("shows the name, @username, and the three tabs with About selected by default", () => {
    render(<ProfileView initial={me()} />);
    expect(screen.getByText("@ann")).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["About", "Security", "Notifications"]);
    expect(screen.getByRole("tab", { name: "About" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
  });

  it("keeps the tab in the query and honours it on load", async () => {
    mocks.api.notifications.preferences.mockResolvedValue({ preferences: [] });
    render(<ProfileView initial={me()} />);
    await userEvent.click(screen.getByRole("tab", { name: "Security" }));
    expect(mocks.replace).toHaveBeenCalledWith("/app/profile?tab=security");
  });

  it("opens the tab named in the query and ignores an unknown one", () => {
    mocks.tab.value = "security";
    const { unmount } = render(<ProfileView initial={me()} />);
    expect(screen.getByRole("tab", { name: "Security" })).toHaveAttribute("aria-selected", "true");
    unmount();
    mocks.tab.value = "nonsense";
    render(<ProfileView initial={me()} />);
    expect(screen.getByRole("tab", { name: "About" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("About tab (PRF-02 to PRF-04, PRF-10)", () => {
  it("disables Save until a field changed, then sends only the changed keys", async () => {
    mocks.api.auth.updateMe.mockResolvedValue(me({ full_name: "Ann Marie" }));
    render(<ProfileView initial={me()} />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Full name"), " Marie");
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(mocks.api.auth.updateMe).toHaveBeenCalledWith({ full_name: "Ann Lee Marie" });
  });

  it("checks a new username live and says Username is taken, and does not check the current one", async () => {
    mocks.api.auth.availability.mockResolvedValue({ username: { available: false } });
    render(<ProfileView initial={me()} />);
    const field = screen.getByLabelText("Username");
    await userEvent.clear(field);
    await userEvent.type(field, "ann");
    await new Promise((r) => setTimeout(r, 500));
    expect(mocks.api.auth.availability).not.toHaveBeenCalled();
    await userEvent.clear(field);
    await userEvent.type(field, "bob");
    expect(await screen.findByText("Username is taken", undefined, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.api.auth.updateMe).not.toHaveBeenCalled();
  });

  it("a new email is a request: the page says it is waiting and offers Resend and Cancel", async () => {
    mocks.api.auth.updateMe.mockResolvedValue(me({ pending_email: "new@x.com" }));
    const { rerender } = render(<ProfileView initial={me()} />);
    await userEvent.clear(screen.getByLabelText("Email"));
    await userEvent.type(screen.getByLabelText("Email"), "new@x.com");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.api.auth.updateMe).toHaveBeenCalledWith({ email: "new@x.com" });
    expect(await screen.findByText(/Waiting for confirmation/)).toHaveTextContent("new@x.com");
    expect(screen.getByRole("button", { name: "Resend link" })).toBeInTheDocument();
    rerender(<ProfileView initial={me({ pending_email: "new@x.com" })} />);
  });

  it("cancelling a waiting change asks first and then clears it", async () => {
    mocks.api.auth.cancelEmailChange.mockResolvedValue(me());
    render(<ProfileView initial={me({ pending_email: "new@x.com" })} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel change" }));
    expect(mocks.api.auth.cancelEmailChange).not.toHaveBeenCalled();
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Cancel the email change?" })).getByRole("button", { name: "Cancel change" }));
    await waitFor(() => expect(mocks.api.auth.cancelEmailChange).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/Waiting for confirmation/)).not.toBeInTheDocument());
  });

  it("the availability switch asks before it saves (PRF-04)", async () => {
    mocks.api.auth.updateMe.mockResolvedValue(me({ is_available: false }));
    render(<ProfileView initial={me()} />);
    const toggle = screen.getByRole("switch", { name: "Available for work" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(toggle);
    expect(mocks.api.auth.updateMe).not.toHaveBeenCalled();
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Mark yourself unavailable?" })).getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(mocks.api.auth.updateMe).toHaveBeenCalledWith({ is_available: false }));
  });
});

describe("Security tab (PRF-05)", () => {
  async function open() {
    mocks.tab.value = "security";
    render(<ProfileView initial={me()} />);
  }

  it("requires the current password, a long enough new one, and a matching confirmation before it sends anything", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByText("Enter your current password.")).toBeInTheDocument();
    expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Current password"), "old-pass-1");
    await userEvent.type(screen.getByLabelText("New password"), "new-pass-123");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "other-pass");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByText("The two passwords do not match.")).toBeInTheDocument();
    expect(mocks.api.auth.changePassword).not.toHaveBeenCalled();
  });

  it("sends the change, clears the fields, and says a notice went to the email", async () => {
    mocks.api.auth.changePassword.mockResolvedValue(null);
    await open();
    await userEvent.type(screen.getByLabelText("Current password"), "old-pass-1");
    await userEvent.type(screen.getByLabelText("New password"), "new-pass-123");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-pass-123");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(mocks.api.auth.changePassword).toHaveBeenCalledWith({ current_password: "old-pass-1", new_password: "new-pass-123" });
    expect(await screen.findByText(/notice to your email/)).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("shows a wrong current password beside its field", async () => {
    mocks.api.auth.changePassword.mockRejectedValue(new ApiError(400, "VALIDATION_ERROR", "Current password is incorrect", { current_password: ["current password is incorrect"] }));
    await open();
    await userEvent.type(screen.getByLabelText("Current password"), "wrong-pass");
    await userEvent.type(screen.getByLabelText("New password"), "new-pass-123");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-pass-123");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("current password is incorrect")).toBeInTheDocument();
  });
});

describe("Notifications tab (PRF-06)", () => {
  const prefs = ["comment_on_assigned", "due_today", "due_tomorrow", "assigned_card_changed", "subtask_on_assigned"].map((type) => ({ type, enabled: true }));
  beforeEach(() => {
    mocks.tab.value = "notifications";
    mocks.api.notifications.preferences.mockResolvedValue({ preferences: prefs });
  });

  it("shows one switch per type and says it is in-app only", async () => {
    render(<ProfileView initial={me()} />);
    expect(await screen.findAllByRole("switch")).toHaveLength(5);
    expect(screen.getByText("These control in-app notifications only.")).toBeInTheDocument();
  });

  it("saves a switch at once without a confirmation and shows Saved", async () => {
    mocks.api.notifications.savePreferences.mockResolvedValue({ preferences: prefs });
    render(<ProfileView initial={me()} />);
    await userEvent.click(await screen.findByRole("switch", { name: "Due today" }));
    expect(mocks.api.notifications.savePreferences).toHaveBeenCalledWith([{ type: "due_today", enabled: false }]);
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rolls a switch back and offers Retry when the save fails", async () => {
    mocks.api.notifications.savePreferences.mockRejectedValueOnce(new Error("down"));
    render(<ProfileView initial={me()} />);
    const toggle = await screen.findByRole("switch", { name: "Subtasks" });
    await userEvent.click(toggle);
    expect(await screen.findByText(/Could not save/)).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("VerifyView (ACT-07)", () => {
  it("asks to check the email, with the stored address and a resend button, and never shows the address from the URL", async () => {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email: "ann@x.com", next: null }));
    render(<VerifyView token={null} />);
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText("ann@x.com")).toBeInTheDocument();
    expect(screen.getByText(/expires in 24 hours/)).toBeInTheDocument();
    mocks.api.auth.resendVerification.mockResolvedValue({ message: "ok" });
    await userEvent.click(screen.getByRole("button", { name: "Resend email" }));
    expect(mocks.api.auth.resendVerification).toHaveBeenCalledWith("ann@x.com");
    expect(await screen.findByText(/a new link was sent/)).toBeInTheDocument();
  });

  it("disables resend with a countdown after a 429", async () => {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email: "ann@x.com", next: null }));
    mocks.api.auth.resendVerification.mockRejectedValue(new ApiError(429, "RATE_LIMITED", "slow down", undefined, 90));
    render(<VerifyView token={null} />);
    await userEvent.click(await screen.findByRole("button", { name: "Resend email" }));
    expect(await screen.findByText(/Try again in 01:30/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend email" })).toBeDisabled();
  });

  it("asks for the address when none was kept", async () => {
    render(<VerifyView token={null} />);
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resend email" }));
    expect(await screen.findByText(/Enter the email address you registered with/)).toBeInTheDocument();
  });

  it("confirms a link once, takes the token out of the address bar, and offers Sign in with the stored destination", async () => {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email: "ann@x.com", next: "/app/invite/abc" }));
    mocks.api.auth.verify.mockResolvedValue({ purpose: "verify_email" });
    const replaceState = vi.spyOn(window.history, "replaceState");
    render(<VerifyView token="tok-1" />);
    expect(await screen.findByRole("heading", { name: "Email confirmed" })).toBeInTheDocument();
    expect(mocks.api.auth.verify).toHaveBeenCalledTimes(1);
    expect(mocks.api.auth.verify).toHaveBeenCalledWith("tok-1");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/app/verify");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/app/login?next=%2Fapp%2Finvite%2Fabc");
  });

  it("says an email change was applied for a change_email link", async () => {
    mocks.api.auth.verify.mockResolvedValue({ purpose: "change_email" });
    render(<VerifyView token="tok-2" />);
    expect(await screen.findByRole("heading", { name: "Email address updated" })).toBeInTheDocument();
  });

  it("shows an expired or invalid link as an error with Send a new link", async () => {
    mocks.api.auth.verify.mockRejectedValueOnce(new ApiError(400, "TOKEN_EXPIRED", "expired"));
    const { unmount } = render(<VerifyView token="old" />);
    expect(await screen.findByRole("heading", { name: "This link has expired" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Send a new link" })).toBeInTheDocument();
    unmount();
    mocks.api.auth.verify.mockRejectedValueOnce(new ApiError(400, "TOKEN_INVALID", "bad"));
    render(<VerifyView token="used" />);
    expect(await screen.findByRole("heading", { name: "This link is not valid" })).toBeInTheDocument();
  });
});
