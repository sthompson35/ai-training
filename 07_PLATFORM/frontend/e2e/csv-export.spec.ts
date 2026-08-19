import { test, expect } from "@playwright/test";

test("exporting levels downloads a CSV", async ({ page }) => {
  // Public page, stable seeded data, no auth needed — deliberately doesn't
  // use the admin storageState, proving export works for an anonymous visitor.
  await page.goto("/levels");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV" }).click(),
  ]);

  expect(download.suggestedFilename()).toBe("levels.csv");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const content = Buffer.concat(chunks).toString("utf-8");

  expect(content).toContain("id,title");
  expect(content).toContain("Orientation and AI Literacy");
});
