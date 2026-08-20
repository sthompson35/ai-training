import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./global-setup";

test.use({ storageState: ADMIN_STORAGE_STATE });

// Exercises R2's canonical identity contract through the real browser UI and
// the real API/DB, not mocked fixtures: create -> resolve -> role-change ->
// lifecycle transitions -> audit trail. Component tests (vitest) already
// cover each piece in isolation; this proves the whole chain actually works
// wired together, the same way crud-and-audit.spec.ts does for learners.
test("registers an identity, changes its role, and moves it through a full lifecycle transition round trip", async ({
  page,
}) => {
  const suffix = Date.now();
  const callsign = `E2ETRP${suffix}`;
  const serviceMemberId = `ATA-${callsign}-000`;
  const displayName = `E2E Trooper ${suffix}`;

  await page.goto("/service-members/new");
  await page.getByLabel("Service member ID").fill(serviceMemberId);
  await page.getByLabel("Callsign ID").fill(`ATA-SM-${callsign}-001`);
  await page.getByLabel("Callsign", { exact: true }).fill(`@${callsign}`);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Current role").fill("Support Technician");
  await page.getByRole("button", { name: "Register service member" }).click();

  // Registration navigates to the new identity's own detail page.
  await expect(page.getByRole("heading", { name: displayName })).toBeVisible();
  await expect(page.getByText(serviceMemberId)).toBeVisible();

  // It's now findable via the canonical registry, not just the record we
  // just created client-side.
  await page.goto("/service-members");
  await page.getByLabel("Search:").fill(callsign);
  await expect(page.getByRole("link", { name: `@${callsign}` })).toBeVisible();

  await page.getByRole("link", { name: `@${callsign}` }).click();
  await expect(page.getByRole("heading", { name: displayName })).toBeVisible();

  // Role change: governed, versioned, with a recorded reason -- never a
  // silent field flip.
  await page.getByLabel("New role").fill("Field Lead");
  await page.getByLabel("Reason (optional)").fill("E2E promotion");
  await page.getByRole("button", { name: "Change role" }).click();
  await expect(page.getByText(/field lead · v2/i)).toBeVisible();
  await expect(page.getByRole("cell", { name: "E2E promotion" })).toBeVisible();

  // Lifecycle: deactivate requires a reason before the button even enables.
  const deactivateButton = page.getByRole("button", { name: "Deactivate" });
  await expect(deactivateButton).toBeDisabled();
  await page.getByLabel(/reason \(required for any transition/i).fill("E2E stand-down");
  await expect(deactivateButton).toBeEnabled();
  await deactivateButton.click();
  await expect(page.getByText("Current state: inactive")).toBeVisible();
  await expect(page.getByRole("cell", { name: "E2E stand-down" })).toBeVisible();

  // Reactivate back to active -- the round trip a discharge could never do.
  await page.getByLabel(/reason \(required for any transition/i).fill("E2E return from stand-down");
  await page.getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByText("Current state: active")).toBeVisible();

  // The real audit pipeline fired for these mutations, same proof pattern as
  // crud-and-audit.spec.ts.
  await page.goto("/audit-log");
  await page.getByLabel(/search path/i).fill(`/v1/service-members/${serviceMemberId}/deactivate`);
  await expect(page.getByRole("row", { name: /admin POST/ }).first()).toBeVisible();
});

test("an identity discharged through the UI is terminal and still resolves", async ({ page }) => {
  const suffix = Date.now();
  const callsign = `E2EDISCH${suffix}`;
  const serviceMemberId = `ATA-${callsign}-000`;
  const displayName = `E2E Discharge Subject ${suffix}`;

  await page.goto("/service-members/new");
  await page.getByLabel("Service member ID").fill(serviceMemberId);
  await page.getByLabel("Callsign ID").fill(`ATA-SM-${callsign}-001`);
  await page.getByLabel("Callsign", { exact: true }).fill(`@${callsign}`);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Current role").fill("Support Technician");
  await page.getByRole("button", { name: "Register service member" }).click();
  await expect(page.getByRole("heading", { name: displayName })).toBeVisible();

  await page.getByLabel(/reason \(required for any transition/i).fill("E2E discharge");
  await page.getByRole("button", { name: "Discharge (terminal)" }).click();
  await expect(page.getByText("Current state: discharged")).toBeVisible();
  await expect(page.getByText(/discharged is terminal/i)).toBeVisible();

  // Terminal means no further transition buttons, not that the identity
  // stops resolving -- history stays intact and the canonical lookup still
  // works for whatever already references this identity.
  await page.goto("/service-members");
  await page.getByLabel("Search:").fill(callsign);
  await page.getByRole("link", { name: `@${callsign}` }).click();
  await expect(page.getByRole("button", { name: /^deactivate$/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^reactivate$/i })).toHaveCount(0);
});
