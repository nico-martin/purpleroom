import { expect, test } from "@playwright/test";

test("visitors can open the FAQ from login and expand answers by mouse and keyboard", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) apiRequests.push(request.url());
  });
  await page.goto("/login");
  await expect(
    page.getByText(
      "A members-only space for conference speakers. Anyone can join."
    )
  ).toBeVisible();
  await expect(
    page.getByText(/Everything inside is for signed-in members only/)
  ).toHaveCount(0);
  await page.getByRole("link", { name: /Read the FAQ/ }).click();
  await expect(page).toHaveURL("/faq");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A little about the room."
  );
  await expect(page.locator("details")).toHaveCount(8);
  await expect(page.locator("details[open]")).toHaveCount(0);

  const purpose = page
    .locator("details")
    .filter({ hasText: "What is purpleroom?" });
  await purpose.locator("summary").click();
  await expect(purpose.locator("p")).toBeVisible();
  await expect(purpose.locator("p")).toContainText(
    "members-only space for conference speakers"
  );

  const audience = page
    .locator("details")
    .filter({ hasText: "Who is it for?" });
  await page.keyboard.press("Tab");
  await expect(audience.locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(audience.locator("p")).toBeVisible();
  await expect(purpose.locator("p")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(audience.locator("p")).not.toBeVisible();
  expect(apiRequests).toEqual([]);

  await page
    .getByRole("link", { name: "Join or sign in", exact: true })
    .click();
  await expect(page).toHaveURL("/login");
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`FAQ loads directly on mobile in ${colorScheme} mode without signing in`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/faq");
    await expect(page).toHaveURL("/faq");
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      colorScheme
    );
    const privacy = page
      .locator("details")
      .filter({ hasText: "Who can see my talks and submissions?" });
    await privacy.locator("summary").click();
    await expect(privacy.locator("p")).toContainText(
      "even admins cannot view them through the app"
    );
    await expect(
      page.getByText(/Only this introduction is public/)
    ).toHaveCount(0);
    await expect(privacy.locator("p")).not.toContainText(
      "isn't publicly browsable"
    );
    await expect(page.getByText(/version: /)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await page.screenshot({
      path: `test-results/faq-mobile-${colorScheme}.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(page).toHaveURL("/faq");
    await expect(page.locator("details[open]")).toHaveCount(0);
  });
}
