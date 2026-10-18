import { expect, test } from "@playwright/test";

const conferences = [
  { id: 1, name: "DevConf", website: "https://devconf.example" },
  { id: 2, name: "JS Friends", website: "https://jsfriends.example" },
].map((conference) => ({ ...conference, logo_url: null, description: null, created_by: 1, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null, review_count: 0, tag_counts: {}, next_edition: null, would_submit_again: { yes: 0, no: 0 } }));

const year = Math.max(new Date().getFullYear(), 2027);
const existing = {
  id: 15, conference_id: 1, title: "DevConf Berlin", year, city: "Berlin", country: "DE", online: 0,
  starts_on: `${year}-05-20`, ends_on: `${year}-05-21`, website: "https://devconf.example/berlin", cfp_url: "https://devconf.example/cfp", cfp_opens_on: null, cfp_closes_on: null, notes: null,
  created_by: 1, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: { id: 1, name: "Nico", avatar_url: null, role: "admin", profile_complete: 1 } } }));
  await page.route("**/api/conferences", (route) => route.fulfill({ json: conferences }));
  await page.route("**/api/conferences/1", (route) => route.fulfill({ json: { ...conferences[0], editions: [existing], reviews: [], comments: [] } }));
  await page.route("**/api/editions/15", (route) => route.fulfill({ json: existing }));
});

test("edition titles prefill from the selected conference without overwriting custom titles", async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route("**/api/editions", async (route) => { submitted = route.request().postDataJSON() as Record<string, unknown>; await route.fulfill({ status: 201, json: { id: 99 } }); });
  await page.route("**/api/editions/99", (route) => route.fulfill({ json: { ...existing, ...submitted, id: 99, conference: conferences[1], submissions: [], attendance: [], speaking: [], going: [], maybe: [], comments: [], my_submissions: [] } }));
  await page.goto("/editions/new");
  const conference = page.getByLabel("Conference", { exact: true });
  const title = page.getByLabel("Edition title", { exact: true });
  await conference.selectOption("1");
  await expect(title).toHaveValue("DevConf");
  await conference.selectOption("2");
  await expect(title).toHaveValue("JS Friends");
  await title.fill("My custom London edition");
  await conference.selectOption("1");
  await expect(title).toHaveValue("My custom London edition");
  await title.fill("");
  await conference.selectOption("2");
  await expect(title).toHaveValue("JS Friends");
  await title.fill("JSNation Berlin 26");
  await expect(page.getByLabel("Year", { exact: true })).toHaveCount(0);
  await page.getByLabel("First day", { exact: true }).fill(`${year}-05-20`);
  await page.getByLabel("Last day", { exact: true }).fill(`${year}-05-21`);
  await page.getByLabel("City", { exact: true }).fill("London");
  await page.getByLabel("Country code (e.g. NL)", { exact: true }).fill("GB");
  await page.getByRole("button", { name: "Add edition", exact: true }).click();
  await expect(page.getByRole("heading", { name: "JSNation Berlin 26", exact: true })).toBeVisible();
  expect(submitted).toMatchObject({ conference_id: 2, title: "JSNation Berlin 26", city: "London" });
  expect(submitted).not.toHaveProperty("year");
  await expect(page.getByText(`JSNation Berlin 26 ${year}`, { exact: true })).toHaveCount(0);
});

test("another edition defaults to the conference name without a separate year field", async ({ page }) => {
  await page.goto("/editions/new?conference=1");
  await expect(page.getByLabel("Conference", { exact: true })).toHaveValue("1");
  await expect(page.getByLabel("Edition title", { exact: true })).toHaveValue("DevConf");
  await expect(page.getByLabel("Year", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Berlin");
  await page.getByLabel("Edition title", { exact: true }).fill("DevConf London");
  await page.getByLabel("City", { exact: true }).fill("London");
  await expect(page.getByLabel("First day", { exact: true })).toHaveValue("");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("editing a named edition preserves its title when the selected conference changes", async ({ page }) => {
  await page.goto("/editions/15/edit");
  await expect(page.getByLabel("Edition title", { exact: true })).toHaveValue("DevConf Berlin");
  await page.getByLabel("Conference", { exact: true }).selectOption("2");
  await expect(page.getByLabel("Edition title", { exact: true })).toHaveValue("DevConf Berlin");
  await page.getByLabel("First day", { exact: true }).fill(`${year + 1}-05-20`);
  await page.getByLabel("Last day", { exact: true }).fill(`${year + 1}-05-21`);
  await expect(page.getByLabel("Edition title", { exact: true })).toHaveValue("DevConf Berlin");
});
