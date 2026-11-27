import type { Page } from "@playwright/test";

/** The seed password (`flask seed-data`, SEED_PASSWORD); `PW` overrides it. */
export const PASSWORD = process.env.PW ?? "12345678";

/**
 * Fill the open login form and submit it, then wait until the Backend has answered. The redirect that follows can take
 * a few seconds on `next dev` while the target page compiles, so callers assert the URL after this returns.
 */
export async function submitLogin(page: Page, identifier: string, password = PASSWORD) {
  await page.locator("#identifier").fill(identifier);
  await page.locator("#password").fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Log in" }).click(),
  ]);
}

/** Open the login page and sign in. */
export async function signIn(page: Page, identifier: string, password = PASSWORD) {
  await page.goto("/app/login");
  await submitLogin(page, identifier, password);
}
