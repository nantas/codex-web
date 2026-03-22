import { expect, test } from "@playwright/test";

test("login -> sessions -> submit -> poll completed", async ({ page }) => {
  const origin = "http://localhost:43173";
  const sessionResponse = await page.request.post(`${origin}/api/v1/sessions`, {
    data: {
      workspaceId: "ws-e2e",
      cwd: "/tmp/ws-e2e",
    },
  });
  expect(sessionResponse.status()).toBe(201);

  const payload = (await sessionResponse.json()) as { sessionId: string };
  await page.goto(`${origin}/sessions/${payload.sessionId}`);

  await expect(page.getByRole("heading", { name: `Session ${payload.sessionId}` })).toBeVisible();
  await expect(page.getByLabel("Turn Message")).toBeVisible();

  await page.getByLabel("Turn Message").fill("hello from e2e");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("hello from e2e")).toBeVisible();
});
