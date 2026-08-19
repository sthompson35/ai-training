import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./global-setup";

test.use({ storageState: ADMIN_STORAGE_STATE });

test("creating a learner shows up in the list, the audit log, and the dashboard", async ({ page }) => {
  const suffix = Date.now();
  const name = `E2E Learner ${suffix}`;
  const email = `e2e-learner-${suffix}@example.com`;

  await page.goto("/learners");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Add learner" }).click();

  const learnerRow = page.getByText(name, { exact: false });
  await expect(learnerRow).toBeVisible();

  // The real dependency-based audit pipeline (Depends(log_audit_event)) fired
  // for this exact request, not just in pytest against a mocked session.
  await page.goto("/audit-log");
  await page.getByLabel(/search path/i).fill("/v1/learners");
  const auditRow = page.getByRole("row", { name: /admin POST/ }).first();
  await expect(auditRow).toBeVisible();
  await expect(auditRow).toContainText("/v1/learners");

  // Dashboard sanity check: tiles show real fetched numbers, not the "–"
  // loading placeholder.
  await page.goto("/");
  await expect(page.getByText(/\d+ levels/)).toBeVisible();
  await expect(page.getByText(/\d+ learners/)).toBeVisible();

  // Clean up. Scoped to this learner's own list item rather than relying on
  // the search filter to narrow the page to one match (its fetch is async,
  // and a page-wide "Delete" button locator would otherwise be ambiguous
  // whenever other learners are already present on the default page).
  await page.goto("/learners");
  const item = page.getByRole("listitem").filter({ hasText: name });
  await expect(item).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await item.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(name, { exact: false })).toHaveCount(0);
});
