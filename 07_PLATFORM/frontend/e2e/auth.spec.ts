import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE, CONTRIBUTOR_STORAGE_STATE, TEST_CONTRIBUTOR_USERNAME } from "./global-setup";

test("logs in with valid credentials", async ({ page }) => {
  // The one deliberate real-form login in this suite — everything else reuses
  // a cached session (see global-setup.ts) to stay well under the login
  // endpoint's rate limit across repeated runs.
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("admin");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText("Logged in as admin")).toBeVisible();
});

test.describe("admin", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("can create and delete a user via the Users page", async ({ page }) => {
    const username = `e2e-throwaway-${Date.now()}`;

    await page.goto("/users");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill("throwaway-pass-12345");
    await page.getByLabel("Role").selectOption("contributor");
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText(username)).toBeVisible();

    const row = page.getByRole("row", { name: new RegExp(username) });
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(username)).toHaveCount(0);
  });
});

test.describe("contributor", () => {
  test.use({ storageState: CONTRIBUTOR_STORAGE_STATE });

  test("can't see or reach user management", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(`Logged in as ${TEST_CONTRIBUTOR_USERNAME}`)).toBeVisible();

    // Client-side gate: no "Users" nav link.
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);

    // Server-side boundary: the API itself refuses, surfaced as the page's
    // own error state — not just a hidden link a client could route around.
    await page.goto("/users");
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
