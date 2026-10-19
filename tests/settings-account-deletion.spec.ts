import { expect, test } from "@playwright/test";

test("account deletion requires explicit confirmation and can be cancelled", async ({
  page,
}) => {
  const deletes: unknown[] = [];
  await page.route("**/api/me", (route) => {
    if (route.request().method() === "DELETE") {
      deletes.push(route.request().postDataJSON());
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      json: {
        user: {
          id: 1,
          name: "Speaker",
          email: "speaker@example.com",
          avatar_url: null,
          role: "member",
          profile_complete: 1,
        },
      },
    });
  });
  await page.goto("/settings");
  const danger = page.getByRole("region", { name: "Danger", exact: true });
  await expect(danger.getByText(/This cannot be undone/)).toBeVisible();
  await expect(
    danger.getByText(/Shared conferences and editions/)
  ).toBeVisible();
  await danger
    .getByRole("button", { name: "Delete my account", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Permanently delete your account?",
    exact: true,
  });
  const confirm = dialog.getByRole("button", {
    name: "Permanently delete account",
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  await dialog
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("delete");
  await expect(confirm).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Keep my account", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(deletes).toEqual([]);
  await danger
    .getByRole("button", { name: "Delete my account", exact: true })
    .click();
  await expect(
    dialog.getByLabel("Type DELETE to confirm", { exact: true })
  ).toHaveValue("");
  await dialog
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("DELETE");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: "test-results/account-deletion-mobile-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await confirm.click();
  await expect(page).toHaveURL("/login?deleted=1");
  await expect(
    page.getByText(
      "Your account and personal content have been permanently deleted.",
      { exact: true }
    )
  ).toBeVisible();
  expect(deletes).toEqual([{ confirmation: "DELETE" }]);
});

test("the last admin receives an actionable refusal without losing their account", async ({
  page,
}) => {
  await page.route("**/api/me", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 409,
          json: {
            error: {
              code: "last_admin",
              message:
                "You are the last active admin. Appoint another active admin before deleting your account.",
            },
          },
        })
      : route.fulfill({
          json: {
            user: {
              id: 1,
              name: "Admin",
              email: "admin@example.com",
              avatar_url: null,
              role: "admin",
              profile_complete: 1,
            },
          },
        })
  );
  await page.goto("/settings");
  await expect(
    page.getByText(
      "If you are the last active admin, appoint another active admin before deleting your account.",
      { exact: true }
    )
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete my account", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("DELETE");
  await dialog
    .getByRole("button", { name: "Permanently delete account", exact: true })
    .click();
  await expect(
    dialog.getByText(
      "You are the last active admin. Appoint another active admin before deleting your account.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(page).toHaveURL("/settings");
  await dialog
    .getByRole("button", { name: "Keep my account", exact: true })
    .click();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
    "Admin"
  );
});

test("a member can permanently delete their account and invalidate another signed-in device", async ({
  page,
  browser,
  baseURL,
}) => {
  const headers = { "X-Requested-With": "green-room" };
  const email = `delete-ui-${Date.now()}@example.com`;
  const requestCode = await page.request.post("/api/auth/request", {
    headers,
    data: { email },
  });
  const credentials = await requestCode.json();
  expect(
    (
      await page.request.post("/api/auth/verify", {
        headers,
        data: { request_id: credentials.request_id, code: credentials.code },
      })
    ).ok()
  ).toBe(true);
  expect(
    (
      await page.request.patch("/api/me", {
        headers,
        data: { name: "Departing speaker" },
      })
    ).ok()
  ).toBe(true);
  expect(
    (
      await page.request.post("/api/papers", {
        headers,
        data: {
          title: "Private talk to delete",
          notes: "Private notes to delete",
        },
      })
    ).ok()
  ).toBe(true);
  const secondDevice = await browser.newContext({ baseURL });
  try {
    const secondCode = await (
      await secondDevice.request.post("/api/auth/request", {
        headers,
        data: { email },
      })
    ).json();
    expect(
      (
        await secondDevice.request.post("/api/auth/verify", {
          headers,
          data: { request_id: secondCode.request_id, code: secondCode.code },
        })
      ).ok()
    ).toBe(true);
    await page.goto("/settings");
    await page
      .getByRole("button", { name: "Delete my account", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Type DELETE to confirm", { exact: true })
      .fill("DELETE");
    await dialog
      .getByRole("button", { name: "Permanently delete account", exact: true })
      .click();
    await expect(page).toHaveURL("/login?deleted=1");
    expect((await secondDevice.request.get("/api/me")).status()).toBe(401);
    expect((await page.request.get("/api/papers")).status()).toBe(401);
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Welcome to the room.", exact: true })
    ).toBeVisible();
  } finally {
    await secondDevice.close();
  }
});
