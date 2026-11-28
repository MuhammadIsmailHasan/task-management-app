import { expect, test } from "@playwright/test";
import { signIn, submitLogin } from "../support";

const unique = `e2e${Date.now()}`;

test.describe("login", () => {
  test("a seeded Manager signs in, lands on Dashboard, and signs out", async ({ page }) => {
    await signIn(page, "manager@example.com");
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await expect(page.getByRole("region", { name: "Filters" })).toBeVisible();
    await page.getByRole("button", { name: "User menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/app\/login|\/$/);
    await page.goto("/app/boards");
    await expect(page).toHaveURL(/\/app\/login/);
  });

  test("signs in with the username too, in any letter case", async ({ page }) => {
    await signIn(page, "MEMBER");
    await expect(page).toHaveURL(/\/app\/boards/);
  });

  test("checks every field before sending, then reports a wrong password without saying which part", async ({ page }) => {
    await page.goto("/app/login");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("#identifier")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#password")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#identifier")).toBeFocused();

    await signIn(page, "manager@example.com", "not-the-password");
    await expect(page.getByText("Invalid username, email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/app\/login/);
  });

  test("a protected page sends a visitor to sign in and back after it", async ({ page }) => {
    await page.goto("/app/boards");
    await expect(page).toHaveURL(/\/app\/login\?next=%2Fapp%2Fboards/);
    await submitLogin(page, "manager@example.com");
    await expect(page).toHaveURL(/\/app\/boards/);
  });
});

test.describe("register", () => {
  test("creates an account and asks to confirm the email; sign-in waits for the confirmation", async ({ page }) => {
    await page.goto("/app/register");
    await page.locator("#full_name").fill("E2E Person");
    await page.locator("#username").fill(unique);
    await page.locator("#email").fill(`${unique}@example.com`);
    await page.locator("#password").fill("a-long-password");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/app\/verify/);
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(`${unique}@example.com`)).toBeVisible();

    await signIn(page, unique, "a-long-password");
    await expect(page.getByText(/confirm your email address first/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Resend confirmation email/ })).toBeVisible();
  });

  test("validates every field before sending", async ({ page }) => {
    await page.goto("/app/register");
    await page.locator("#email").fill("not-an-email");
    await page.locator("#password").fill("short");
    await page.getByRole("button", { name: "Register" }).click();
    for (const id of ["full_name", "username", "email", "password"]) await expect(page.locator(`#${id}`)).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/app\/register/);
  });

  test("names a taken username and a taken email next to their fields", async ({ page }) => {
    await page.goto("/app/register");
    await page.locator("#full_name").fill("Copy Cat");
    await page.locator("#username").fill("manager");
    await page.locator("#email").fill("manager@example.com");
    await page.locator("#password").fill("a-long-password");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.locator("#username")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/app\/register/);
  });

  test("switches between Sign in and Create account", async ({ page }) => {
    await page.goto("/app/login");
    await page.getByRole("link", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/app\/register/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create your account");
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back");
  });
});
