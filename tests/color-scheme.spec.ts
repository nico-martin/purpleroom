import { expect, test } from "@playwright/test";

test("theme is browser-cookie scoped and explicit choices override system settings", async ({ page, context, browser }) => {
  const writes: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET") writes.push(request.url()); });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect((await context.cookies()).some((cookie) => cookie.name === "gr_theme")).toBe(false);

  await page.getByRole("button", { name: /^Colour theme: System\./ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  let cookie = (await context.cookies()).find((item) => item.name === "gr_theme");
  expect(cookie).toMatchObject({ value: "light", path: "/", sameSite: "Lax", domain: "127.0.0.1" });
  expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 300 * 86400);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: /^Colour theme: Light\./ })).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByRole("button", { name: /^Colour theme: Light\./ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page.goto("/setup");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /^Colour theme: Dark\./ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  cookie = (await context.cookies()).find((item) => item.name === "gr_theme");
  expect(cookie?.value).toBe("system");
  expect(writes).toEqual([]);

  const separateBrowser = await browser.newContext({ colorScheme: "light" });
  try {
    const otherPage = await separateBrowser.newPage();
    await otherPage.goto("http://127.0.0.1:5179/login");
    await expect(otherPage.locator("html")).toHaveAttribute("data-theme-preference", "system");
    await expect(otherPage.locator("html")).toHaveAttribute("data-theme", "light");
    expect((await separateBrowser.cookies()).some((item) => item.name === "gr_theme")).toBe(false);
  } finally { await separateBrowser.close(); }
});

test("a saved theme is applied before the React app loads", async ({ page, context }) => {
  await context.addCookies([{ name: "gr_theme", value: "light", url: "http://127.0.0.1:5179", sameSite: "Lax" }]);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.route("**/src/main.tsx", (route) => route.abort());
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "light");
  expect(await page.locator("#root").innerHTML()).toBe("");
});
