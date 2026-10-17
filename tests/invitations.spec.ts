import { expect, test } from "@playwright/test";

const originalUrl = `https://greenroom.example/invite/${"a".repeat(64)}`;
const replacementUrl = `https://greenroom.example/invite/${"b".repeat(64)}`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const values: string[] = [];
    Object.defineProperty(window, "copiedInviteValues", { value: values });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { values.push(value); } } });
  });
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: { id: 1, name: "Nico", avatar_url: null }, cal_url: "https://example.com/calendar" } }));
  await page.route("**/api/users", (route) => route.fulfill({ json: [{ id: 1, name: "Nico", avatar_url: null }, { id: 2, name: "Alex", avatar_url: null }] }));
});

function fixture(url: string | null = originalUrl) {
  return { id: 7, email: "friend@example.com", invited_by: { id: 2, name: "Alex", avatar_url: null }, expires_at: new Date(Date.now() + 86400000).toISOString(), created_at: new Date().toISOString(), url };
}

test("copy an existing invitation directly from the list without changing its link", async ({ page }) => {
  const writes: string[] = [];
  await page.route("**/api/invites", (route) => route.fulfill({ json: [fixture()] }));
  page.on("request", (request) => { if (request.method() !== "GET") writes.push(request.url()); });
  await page.goto("/crew");
  const button = page.getByRole("button", { name: "Copy invitation link for friend@example.com", exact: true });
  await button.click();
  await expect(button).toHaveText("Copied");
  expect(await page.evaluate(() => Reflect.get(window, "copiedInviteValues"))).toEqual([originalUrl]);
  expect(writes).toEqual([]);
  await page.reload();
  await button.click();
  expect(await page.evaluate(() => Reflect.get(window, "copiedInviteValues"))).toEqual([originalUrl]);
});

test("deleting another member's open invitation requires confirmation and refreshes the list", async ({ page }) => {
  let open = [fixture()]; const deletes: string[] = [];
  await page.route("**/api/invites", (route) => route.fulfill({ json: open }));
  await page.route("**/api/invites/7", (route) => { deletes.push(route.request().method()); open = []; return route.fulfill({ status: 204 }); });
  await page.goto("/crew");
  const button = page.getByRole("button", { name: "Delete invitation for friend@example.com", exact: true });
  page.once("dialog", async (dialog) => { expect(dialog.message()).toContain("stop working immediately"); await dialog.dismiss(); });
  await button.click();
  expect(deletes).toEqual([]);
  await expect(page.getByText("friend@example.com", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await button.click();
  await expect(page.getByText("No open invitations. All caught up.", { exact: true })).toBeVisible();
  expect(deletes).toEqual(["DELETE"]);
  await expect(button).toHaveCount(0);
});

test("legacy links are replaced only after confirmation, then can be copied normally", async ({ page }) => {
  const invite = fixture(null); const regenerated: string[] = [];
  await page.route("**/api/invites", (route) => route.fulfill({ json: [invite] }));
  await page.route("**/api/invites/7/regenerate", (route) => { regenerated.push(route.request().method()); invite.url = replacementUrl; return route.fulfill({ json: { url: replacementUrl, expires_at: invite.expires_at } }); });
  await page.goto("/crew");
  const button = page.getByRole("button", { name: "Copy invitation link for friend@example.com", exact: true });
  page.once("dialog", (dialog) => dialog.dismiss());
  await button.click();
  expect(regenerated).toEqual([]);
  page.once("dialog", async (dialog) => { expect(dialog.message()).toContain("old link will stop working"); await dialog.accept(); });
  await button.click();
  await expect(page.getByRole("textbox", { name: "invite link", exact: true })).toHaveValue(replacementUrl);
  await expect(page.getByText("Replacement link ready. The old link no longer works.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Copy invite link", exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(window, "copiedInviteValues"))).toEqual([replacementUrl]);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await button.click();
  await expect(button).toHaveText("Copied");
  expect(regenerated).toEqual(["POST"]);
});

test("clipboard restrictions provide a selectable link instead of losing the invite", async ({ page }) => {
  await page.route("**/api/invites", (route) => route.fulfill({ json: [fixture()] }));
  await page.goto("/crew");
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Clipboard unavailable"); } } }); });
  await page.getByRole("button", { name: "Copy invitation link for friend@example.com", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const field = page.getByRole("textbox", { name: "invitation link for friend@example.com", exact: true });
  await expect(field).toHaveValue(originalUrl);
  await expect(field).toHaveAttribute("readonly", "");
});

test("a failed deletion keeps the invite and shows the error", async ({ page }) => {
  await page.route("**/api/invites", (route) => route.fulfill({ json: [fixture()] }));
  await page.route("**/api/invites/7", (route) => route.fulfill({ status: 500, json: { error: { code: "server_error", message: "Could not delete invitation." } } }));
  await page.goto("/crew");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete invitation for friend@example.com", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Could not delete invitation.");
  await expect(page.getByText("friend@example.com", { exact: true })).toBeVisible();
});
