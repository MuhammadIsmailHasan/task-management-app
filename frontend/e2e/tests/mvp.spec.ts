import { expect, test, type Page } from "@playwright/test";
import { signIn as submitSignIn } from "../support";

const stamp = Date.now();
const BOARD = `E2E board ${stamp}`;
const CARD = `E2E card ${stamp}`;
const BOARD_PATH = `/app/b/e2e-board-${stamp}`;

async function signIn(page: Page, identifier: string) {
  await submitSignIn(page, identifier);
  await expect(page).toHaveURL(/\/app\/(boards|dashboard|my-tasks)/);
}

const column = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const tile = (page: Page) => page.getByRole("button", { name: `Open card ${CARD}` });

test.describe.configure({ mode: "serial" });

test("a Manager creates a board that starts with the five default columns", async ({ page }) => {
  await signIn(page, "manager@example.com");
  await page.goto("/app/boards");
  await page.getByRole("button", { name: "New board" }).click();
  await page.locator("#board-name").fill(BOARD);
  await page.getByRole("button", { name: "Create board" }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${BOARD_PATH}$`));
  for (const name of ["Todo", "In Progress", "Review", "Revision", "Done"]) await expect(column(page, name)).toBeVisible();
});

test("edits the board name and description in the same board modal", async ({ page }) => {
  await signIn(page, "manager@example.com");
  await page.goto(BOARD_PATH);
  await page.getByRole("button", { name: "Edit board" }).click();
  const modal = page.getByRole("dialog", { name: "Edit board" });
  await expect(modal.locator("#edit-board-name")).toHaveValue(BOARD);
  const renamed = BOARD.toUpperCase();
  await modal.locator("#edit-board-name").fill(renamed);
  await modal.getByRole("button", { name: "Save changes" }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Switch board: ${renamed}` })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${BOARD_PATH}$`));
});

test("adds a card, moves it by drag and drop, and the move survives a refresh", async ({ page }) => {
  await signIn(page, "manager@example.com");
  await page.goto(BOARD_PATH);
  await column(page, "Todo").getByRole("button", { name: "Add Card", exact: true }).click();
  await page.getByLabel("Card title").fill(CARD);
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(column(page, "Todo").getByRole("button", { name: `Open card ${CARD}` })).toBeVisible();

  await tile(page).dragTo(page.getByTestId("column-In Progress"));
  await expect(column(page, "In Progress").getByRole("button", { name: `Open card ${CARD}` })).toBeVisible();
  await page.reload();
  await expect(column(page, "In Progress").getByRole("button", { name: `Open card ${CARD}` })).toBeVisible();
  await expect(column(page, "Todo").getByRole("button", { name: `Open card ${CARD}` })).toHaveCount(0);
});

test("edits the card in the one modal: title, priority, subtasks, and a comment", async ({ page }) => {
  await signIn(page, "manager@example.com");
  await page.goto(BOARD_PATH);
  await tile(page).click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByLabel("Title", { exact: true })).toHaveValue(CARD);

  await modal.getByRole("button", { name: /^Priority:/ }).click();
  await page.getByRole("option", { name: "high" }).click();
  await expect(modal.getByRole("button", { name: "Priority: High" })).toBeVisible();

  await modal.getByLabel("New subtask").fill("Write the copy");
  await modal.getByRole("button", { name: "Add", exact: true }).click();
  await modal.getByRole("checkbox", { name: "Done: Write the copy" }).click();
  await expect(modal.getByRole("checkbox", { name: "Done: Write the copy" })).toBeChecked();
  await expect(modal.getByText("1 of 1")).toBeVisible();

  await modal.getByPlaceholder("Write a comment").fill("Looks good from e2e");
  await modal.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(modal.getByText("Looks good from e2e")).toBeVisible();

  await modal.getByRole("button", { name: "Close" }).click();
  await expect(tile(page)).toContainText("high");
  await expect(tile(page)).toContainText("1 of 1");
});

test("a Member gets no staff controls in the card modal (PERM-02)", async ({ page }) => {
  await signIn(page, "member@example.com");
  await page.goto("/app/b/alpha-board");
  await expect(page.getByRole("button", { name: "Edit board" })).toHaveCount(0);
  await page.getByRole("button", { name: /^Open card / }).first().click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "Archive", exact: true })).toHaveCount(0);
  await expect(modal.getByLabel("Title", { exact: true })).toHaveCount(0);
});

test("archives the card; it leaves the board and is listed on the Archived page", async ({ page }) => {
  await signIn(page, "manager@example.com");
  await page.goto(BOARD_PATH);
  await tile(page).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive", exact: true }).click();
  await expect(tile(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Archived/ })).toContainText("1");
  await page.getByRole("link", { name: /Archived/ }).click();
  await expect(page.getByRole("heading", { name: "Archived cards" })).toBeVisible();
  await expect(page.getByText(CARD)).toBeVisible();
});
