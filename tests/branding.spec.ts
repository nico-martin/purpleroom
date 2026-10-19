import { expect, test } from "@playwright/test";

test("brand artwork follows explicit appearance and the favicon loads", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.getByText("{ where speakers swap notes }", { exact: true })).toBeVisible();
  const brand = page.getByRole("link", {
    name: "purpleroom home",
    exact: true,
  });
  const visibleLogo = brand.locator("img:visible");
  await expect(visibleLogo).toHaveAttribute("src", /purpleroom-logo-dark/);
  await page.getByRole("button", { name: /^Colour theme: System\./ }).click();
  await expect(visibleLogo).toHaveAttribute("src", /purpleroom-logo\.svg/);
  expect(
    await visibleLogo.evaluate(
      (image: HTMLImageElement) => image.complete && image.naturalWidth > 0
    )
  ).toBe(true);
  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  const response = await page.request.get(favicon!);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('stroke-width="7"');
  await page.screenshot({
    path: "test-results/branding-login-light.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("sidebar uses the full logo and mobile navigation uses the small mark", async ({
  page,
}) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 1,
          name: "Nico",
          role: "member",
          profile_complete: 1,
          avatar_url: null,
        },
      },
    })
  );
  await page.route("**/api/conferences", (route) =>
    route.fulfill({ json: [] })
  );
  await page.goto("/conferences");
  const sidebar = page
    .locator("aside")
    .getByRole("link", { name: "purpleroom home", exact: true });
  await expect(sidebar.locator("img:visible")).toHaveAttribute(
    "src",
    /purpleroom-logo/
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = page
    .locator("div.lg\\:pl-60")
    .getByRole("link", { name: "purpleroom home", exact: true });
  await expect(mobile).toBeVisible();
  await expect(mobile.locator("img")).toHaveAttribute("width", "64");
  expect(
    await mobile
      .locator("img")
      .evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth === 64
      )
  ).toBe(true);
  await page.emulateMedia({ colorScheme: "dark" });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(sidebar.locator("img:visible")).toHaveAttribute(
    "src",
    /purpleroom-logo-dark/
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: "test-results/branding-mobile-dark.png",
    fullPage: true,
    animations: "disabled",
  });
});
