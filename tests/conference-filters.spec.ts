import { expect, test } from "@playwright/test";

test("conference tags, CFP filter, and both sort directions combine and survive reload", async ({
  page,
}) => {
  const definitions = [
    { id: 6, name: "Zeta", tags: ["ai"], date: null, open: true },
    { id: 4, name: "Echo", tags: [], date: null, open: false },
    { id: 3, name: "Delta", tags: ["javascript"], date: null, open: false },
    {
      id: 5,
      name: "Gamma",
      tags: ["javascript", "css"],
      date: "2027-06-10",
      open: true,
    },
    { id: 2, name: "Beta", tags: ["css"], date: "2027-07-20", open: false },
    {
      id: 1,
      name: "Alpha",
      tags: ["javascript"],
      date: "2027-06-10",
      open: true,
    },
  ];
  const conferences = definitions.map((item) => ({
    id: item.id,
    name: item.name,
    tags: item.tags,
    has_open_cfp: item.open,
    logo_url: null,
    website: null,
    description: null,
    created_by: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    review_count: 0,
    tag_counts: {},
    would_submit_again: { yes: 0, no: 0 },
    next_edition: item.date
      ? {
          id: item.id + 10,
          title: item.name,
          starts_on: item.date,
          ends_on: item.date,
          city: "Berlin",
          country: "DE",
          online: 0,
        }
      : null,
  }));
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 1,
          name: "Nico",
          avatar_url: null,
          role: "member",
          profile_complete: 1,
        },
      },
    })
  );
  await page.route("**/api/conferences", (route) =>
    route.fulfill({ json: conferences })
  );
  await page.goto("/conferences");
  const directory = page.getByRole("list", {
    name: "Conferences",
    exact: true,
  });
  const titles = directory.locator("h2");
  await expect(titles).toHaveText([
    "Alpha",
    "Beta",
    "Delta",
    "Echo",
    "Gamma",
    "Zeta",
  ]);
  const sort = page.getByLabel("Sort conferences", { exact: true });
  await sort.selectOption("name_desc");
  await expect(titles).toHaveText([
    "Zeta",
    "Gamma",
    "Echo",
    "Delta",
    "Beta",
    "Alpha",
  ]);
  await sort.selectOption("next_asc");
  await expect(titles).toHaveText([
    "Alpha",
    "Gamma",
    "Beta",
    "Delta",
    "Echo",
    "Zeta",
  ]);
  await sort.selectOption("next_desc");
  await expect(titles).toHaveText([
    "Beta",
    "Alpha",
    "Gamma",
    "Delta",
    "Echo",
    "Zeta",
  ]);
  const tags = page.getByRole("group", { name: "Filter by tags", exact: true });
  await tags.getByRole("button", { name: "javascript", exact: true }).click();
  await expect(titles).toHaveText(["Alpha", "Gamma", "Delta"]);
  await tags.getByRole("button", { name: "css", exact: true }).click();
  await expect(titles).toHaveText(["Beta", "Alpha", "Gamma", "Delta"]);
  await page
    .getByLabel("Have editions with open CFPs", { exact: true })
    .click();
  await expect(page.getByLabel("Have editions with open CFPs", { exact: true })).toBeChecked();
  await expect(titles).toHaveText(["Alpha", "Gamma"]);
  await expect(page.getByText("2 matches", { exact: true })).toBeVisible();
  await tags.getByRole("button", { name: "ai", exact: true }).click();
  await expect(titles).toHaveText(["Alpha", "Gamma", "Zeta"]);
  await page.reload();
  await expect(sort).toHaveValue("next_desc");
  await expect(
    page.getByLabel("Have editions with open CFPs", { exact: true })
  ).toBeChecked();
  await expect(
    tags.getByRole("button", { name: "ai", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(titles).toHaveText(["Alpha", "Gamma", "Zeta"]);
  await page.getByLabel("Search conferences", { exact: true }).fill("Beta");
  await expect(
    page.getByRole("heading", { name: "No conferences match.", exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .first()
    .click();
  await expect(titles).toHaveText([
    "Beta",
    "Alpha",
    "Gamma",
    "Delta",
    "Echo",
    "Zeta",
  ]);
  await expect(sort).toHaveValue("next_desc");
  await page.screenshot({
    path: "test-results/conference-filters-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await tags.getByRole("button", { name: "javascript", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: "test-results/conference-filters-mobile-dark.png",
    fullPage: true,
    animations: "disabled",
  });
});
