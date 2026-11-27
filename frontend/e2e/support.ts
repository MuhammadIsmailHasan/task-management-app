import type { Page } from "@playwright/test";

export const PASSWORD = process.env.PW ?? "12345678";

export async function submitLogin(page: Page, identifier: string, password = PASSWORD) {
  await page.locator("#identifier").fill(identifier);
  await page.locator("#password").fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Log in" }).click(),
  ]);
}

export async function signIn(page: Page, identifier: string, password = PASSWORD) {
  await page.goto("/app/login");
  await submitLogin(page, identifier, password);
}
