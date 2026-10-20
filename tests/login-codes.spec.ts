import { expect, test } from "@playwright/test";

test("email codes support paste, retries, resend, reload, and the intended destination", async ({
  page,
}) => {
  await page.clock.install();
  let requests = 0;
  const verifications: { request_id: string; code: string }[] = [];
  await page.route("**/api/auth/request", (route) => {
    requests++;
    return route.fulfill({
      json: { ok: true, request_id: String(requests).repeat(64) },
    });
  });
  await page.route("**/api/auth/verify", (route) => {
    const data = route.request().postDataJSON() as {
      request_id: string;
      code: string;
    };
    verifications.push(data);
    return data.code === "012345" && data.request_id === "2".repeat(64)
      ? route.fulfill({ json: { user: { id: 1 } } })
      : route.fulfill({
          status: 422,
          json: {
            error: {
              code: "invalid_code",
              message:
                "That code is incorrect, expired, or no longer valid. Try again or request a new code.",
            },
          },
        });
  });
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        user: { id: 1, name: "Speaker", role: "member", profile_complete: 1 },
      },
    })
  );
  await page.route("**/api/conferences", (route) =>
    route.fulfill({ json: [] })
  );
  await page.goto("/login?next=/conferences");
  await expect(
    page.getByText("Local development", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("admin@purpleroom.dev", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(/Any other email creates a regular member account/)
  ).toBeVisible();
  await expect(page.getByText(/no email is sent/)).toBeVisible();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("speaker@example.com");
  await page
    .getByRole("button", { name: "Send me a code", exact: true })
    .click();
  const input = page.getByLabel("Sign-in code", { exact: true });
  await expect(
    page.getByText("v0 / early beta", { exact: true })
  ).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("autocomplete", "one-time-code");
  await expect(input).toHaveAttribute("inputmode", "numeric");
  await expect(
    page.getByText(/If speaker@example.com can receive a code/)
  ).toBeVisible();
  await input.fill("999999");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/That code is incorrect/)).toBeVisible();
  await expect(input).toHaveValue("999999");
  await expect(
    page.getByRole("button", { name: /Resend code in/ })
  ).toBeDisabled();
  await page.clock.fastForward(61000);
  await page.getByRole("button", { name: "Resend code", exact: true }).click();
  await expect(input).toHaveValue("");
  await page.reload();
  await expect(input).toBeVisible();
  await expect(
    page.getByText(/speaker@example.com can receive a code/)
  ).toBeVisible();
  await input.evaluate((element) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "012 345\n");
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      })
    );
  });
  await expect(input).toHaveValue("012345");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: "test-results/login-code-mobile-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/conferences");
  expect(verifications).toEqual([
    { request_id: "1".repeat(64), code: "999999" },
    { request_id: "2".repeat(64), code: "012345" },
  ]);
  expect(
    await page.evaluate(() => sessionStorage.getItem("green-room-login-code"))
  ).toBeNull();
});

test("changing email clears the pending code request", async ({ page }) => {
  await page.route("**/api/auth/request", (route) =>
    route.fulfill({ json: { ok: true, request_id: "a".repeat(64) } })
  );
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("first@example.com");
  await page
    .getByRole("button", { name: "Send me a code", exact: true })
    .click();
  await page.getByLabel("Sign-in code", { exact: true }).fill("123456");
  expect(
    await page.evaluate(() => sessionStorage.getItem("green-room-login-code"))
  ).not.toContain("123456");
  await page
    .getByRole("button", { name: "Use another email", exact: true })
    .click();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    "first@example.com"
  );
  await expect(page.getByLabel("Sign-in code", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome to the room.", exact: true })
  ).toBeVisible();
});
