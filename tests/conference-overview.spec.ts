import { expect, test } from "@playwright/test";

test("compact conference cards show four per desktop row without depending on logos", async ({ page }) => {
  const names = ["AI coding summit", "Build Stuff", "CityJS", "DevTalks Romania", "Devfest Nantes", "FFConf", "Frontier Alicante", "HalfStack", "Infobip Shift Conference", "JSNation", "JSWORLD Conference", "React Advanced London"];
  const conferences = names.map((name, index) => ({
    id: index + 1, name, website: `https://www.conference-${index + 1}.example`,
    logo_url: index % 2 ? `https://images.example/transparent-logo-fragment-${index}.png` : `/api/conference-logos/${index + 1}/wide-logo-fragment.png`,
    description: "A legacy description that should not clutter the directory.", created_by: 1,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null,
    review_count: index === 2 || index === 9 ? 4 : index === 5 ? 1 : 0,
    tag_counts: index === 2 || index === 9 ? { covers_travel: 3, great_speaker_care: 4, recorded: 1 } : {},
    would_submit_again: { yes: 3, no: 0 },
    next_edition: index === 2 || index === 9 ? {
      id: index + 30, conference_id: index + 1, year: 2027, city: index === 9 ? "Amsterdam" : "London", country: index === 9 ? "NL" : "GB", online: 0,
      starts_on: "2027-05-21", ends_on: "2027-05-22", website: null, cfp_url: null, cfp_opens_on: null, cfp_closes_on: "2027-03-01", notes: null,
      created_by: 1, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null,
    } : null,
  }));
  const logoRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("logo-fragment")) logoRequests.push(request.url()); });
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: { id: 1, name: "Nico", email: "test@example.com", avatar_url: null }, cal_url: "https://example.com/calendar" } }));
  await page.route("**/api/conferences", (route) => route.fulfill({ json: conferences }));
  await page.goto("/conferences");
  await expect(page).toHaveTitle("purpleroom — A little speaker intel");
  await expect(page.locator("footer").getByLabel("App version", { exact: true })).toHaveText("version: dev-local");
  await expect(page.locator("aside").getByLabel("App version", { exact: true })).toHaveCount(0);
  await expect(page.locator("footer").getByRole("link", { name: "Nico Martin", exact: true })).toHaveAttribute("href", "https://nico.dev");
  await expect(page.locator("footer").getByRole("link", { name: "Open source on GitHub", exact: true })).toHaveAttribute("href", "https://github.com/nico-martin/purpleroom/");
  const brand = page.getByRole("link", { name: "purpleroom.", exact: true });
  await expect(brand).toBeVisible();
  await expect(brand.locator("span").first()).toHaveCSS("background-color", "rgb(102, 51, 153)");
  const directory = page.getByRole("list", { name: "Conferences", exact: true });
  await expect(directory.getByRole("listitem")).toHaveCount(names.length);
  await expect(directory).toHaveCSS("grid-template-columns", /^(\d+(?:\.\d+)?px\s+){3}\d+(?:\.\d+)?px$/);
  const cards = directory.getByRole("listitem");
  const boxes = await Promise.all([0, 1, 2, 3, 4].map((index) => cards.nth(index).boundingBox()));
  expect(boxes.slice(0, 4).every((box) => box?.y === boxes[0]?.y)).toBe(true);
  expect(boxes[4]!.y).toBeGreaterThan(boxes[0]!.y);
  expect(boxes[0]!.height).toBeLessThan(240);
  await expect(directory.getByRole("img")).toHaveCount(0);
  await expect(page.getByText("A legacy description that should not clutter the directory.")).toHaveCount(0);
  await expect(page.getByText("A new addition to the crew's shortlist.", { exact: false })).toHaveCount(0);
  await expect(directory.getByRole("link", { name: "JSNation", exact: true })).toHaveAttribute("href", "/conferences/10");
  await expect(directory.getByRole("link", { name: "JSNation edition", exact: true })).toHaveAttribute("href", "/editions/39");
  await expect(directory.getByText("Amsterdam, NL", { exact: true })).toBeVisible();
  await expect(directory.getByText("4 speaker takes", { exact: true })).toHaveCount(2);
  await page.screenshot({ path: "test-results/conferences-cards-desktop.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/conferences-cards-mobile.png", fullPage: true, animations: "disabled" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(brand.locator("span").first()).toHaveCSS("background-color", "rgb(196, 154, 232)");
  await page.screenshot({ path: "test-results/conferences-cards-dark.png", fullPage: true, animations: "disabled" });
  await page.getByRole("textbox", { name: "Search conferences", exact: true }).fill("CityJS");
  await expect(directory.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("1 match", { exact: true })).toBeVisible();
  await expect(directory.getByRole("link", { name: "CityJS", exact: true })).toBeVisible();
  expect(logoRequests).toEqual([]);
});
