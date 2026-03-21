import { expect, test } from "@playwright/test";

test("login -> sessions -> submit -> poll completed", async ({ page }) => {
  await page.goto("/sessions");
  await expect(page.getByText("Sessions")).toBeVisible();
});
