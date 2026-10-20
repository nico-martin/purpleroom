import { expect, test } from "@playwright/test";

test.use({ timezoneId: "America/New_York" });

const conference = {
  id: 1,
  name: "Timezone Conference",
  logo_url: null,
  review_count: 0,
  tag_counts: {},
  would_submit_again: { yes: 0, no: 0 },
};
const baseEdition = {
  id: 11,
  conference_id: 1,
  title: "Timezone edition",
  starts_on: "2030-08-20",
  ends_on: "2030-08-21",
  city: "Zurich",
  country: "CH",
  online: 0,
  website: null,
  cfp_url: null,
  cfp_opens_on: null,
  cfp_closes_on: "2030-07-10",
  notes: null,
  conference,
  my_submissions: [],
  attendance: [],
  going: [],
  maybe: [],
  submitted_friends: [],
};

for (const deadline of [
  { date: "2027-03-01", instant: "2027-03-01T22:59:00Z", offset: "UTC+1" },
  { date: "2027-06-27", instant: "2027-06-27T21:59:00Z", offset: "UTC+2" },
]) {
  test(`date displays use friendly timezone names with ${deadline.offset} for the deadline date`, async ({
    page,
  }) => {
    await page.route("**/api/me", (route) =>
      route.fulfill({
        json: {
          user: { id: 1, name: "Admin", role: "admin", profile_complete: 1 },
        },
      })
    );
    await page.route("**/api/editions/11", (route) =>
      route.fulfill({
        json: {
          ...baseEdition,
          starts_on: "2027-05-14",
          ends_on: null,
          starts_timezone: "Europe/Zurich",
          cfp_opens_on: "2027-01-01",
          cfp_opens_timezone: "Europe/Amsterdam",
          cfp_closes_on: deadline.date,
          cfp_closes_time: "23:59",
          cfp_closes_timezone: "Europe/Zurich",
          cfp_closes_at: deadline.instant,
        },
      })
    );
    await page.goto("/editions/11");
    await expect(
      page.getByText("14 May 2027 (Central European Time)", { exact: true })
    ).toBeVisible();
    const cfp = page.getByText(/Opens 1 Jan 2027/);
    await expect(cfp).toContainText(
      "Opens 1 Jan 2027 (Central European Time)."
    );
    await expect(cfp).toContainText(
      `23:59 (Central European Time, ${deadline.offset})`
    );
    await expect(page.getByText(/Europe\/(Zurich|Amsterdam)/)).toHaveCount(0);
  });
}

test("new date selectors default to the browser zone and deadlines remain in the selected CFP zone", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2030-07-10T22:00:00Z") });
  let saved: Record<string, unknown> = {};
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        user: { id: 1, name: "Admin", role: "admin", profile_complete: 1 },
      },
    })
  );
  await page.route("**/api/conferences", (route) =>
    route.fulfill({ json: [conference] })
  );
  await page.route("**/api/editions", async (route) => {
    saved = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      json: { ...baseEdition, ...saved, cfp_closes_at: "2030-07-10T21:59:00Z" },
    });
  });
  await page.route("**/api/editions/11", (route) =>
    route.fulfill({
      json: { ...baseEdition, ...saved, cfp_closes_at: "2030-07-10T21:59:00Z" },
    })
  );
  await page.goto("/editions/new");
  for (const label of [
    "First day timezone",
    "Last day timezone",
    "CFP opening timezone",
    "CFP closing timezone",
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(
      "America/New_York"
    );
  await expect(
    page.getByLabel("CFP closing time", { exact: true })
  ).toHaveValue("23:59");
  await page.getByLabel("Conference", { exact: true }).selectOption("1");
  await page.getByLabel("First day", { exact: true }).fill("2030-08-20");
  const firstDayPicker = page
    .getByLabel("First day timezone", { exact: true })
    .locator("..");
  await firstDayPicker
    .getByText("Choose a specific city", { exact: true })
    .click();
  await firstDayPicker
    .getByLabel("Search timezone cities", { exact: true })
    .fill("Rio Gallegos");
  await firstDayPicker
    .getByLabel("Specific timezone city", { exact: true })
    .selectOption("America/Argentina/Rio_Gallegos");
  await page.getByLabel("Last day", { exact: true }).fill("2030-08-21");
  await page.getByLabel("CFP closes", { exact: true }).fill("2030-07-10");
  await page
    .getByLabel("CFP closing timezone", { exact: true })
    .selectOption("Europe/Zurich");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: "test-results/timezone-edition-form-mobile-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Add edition", exact: true }).click();
  await expect(page).toHaveURL("/editions/11");
  expect(saved).toMatchObject({
    starts_timezone: "America/Argentina/Rio_Gallegos",
    ends_timezone: "America/New_York",
    cfp_opens_timezone: "America/New_York",
    cfp_closes_timezone: "Europe/Zurich",
    cfp_closes_time: "23:59",
  });
  await expect(
    page.getByText(
      /Closes 10 Jul 2030, 23:59 \(Central European Time, UTC\+2\)/
    )
  ).toBeVisible();
  await expect(page.getByText(/17:59/)).toHaveCount(0);
  await expect(page.getByText("Closed", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});

test("winter defaults use a friendly regional name for a summer deadline, with optional city search", async ({
  browser,
}) => {
  const page = await browser.newPage({ timezoneId: "Europe/Zurich" });
  await page.clock.install({ time: new Date("2030-01-15T12:00:00Z") });
  let saved: Record<string, unknown> = {};
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        user: { id: 1, name: "Admin", role: "admin", profile_complete: 1 },
      },
    })
  );
  await page.route("**/api/conferences", (route) =>
    route.fulfill({ json: [conference] })
  );
  await page.route("**/api/editions", async (route) => {
    saved = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, json: { ...baseEdition, ...saved } });
  });
  await page.route("**/api/editions/11", (route) =>
    route.fulfill({
      json: { ...baseEdition, ...saved, cfp_closes_at: "2030-06-27T21:59:00Z" },
    })
  );
  await page.goto("/editions/new");
  const closing = page.getByLabel("CFP closing timezone", { exact: true });
  await expect(closing).toHaveValue("Europe/Zurich");
  await expect(closing.locator("option:checked")).toHaveText(
    "Central European Time"
  );
  expect(await closing.locator("option").count()).toBeLessThan(20);
  await expect(closing.locator("option")).not.toContainText(["CET/CEST"]);
  await page.getByLabel("Conference", { exact: true }).selectOption("1");
  await page.getByLabel("CFP closes", { exact: true }).fill("2030-06-27");
  await expect(closing).toHaveValue("Europe/Zurich");
  const picker = closing.locator("..");
  const summary = picker.getByText("Choose a specific city", { exact: true });
  await summary.focus();
  await page.keyboard.press("Enter");
  const search = picker.getByLabel("Search timezone cities", { exact: true });
  await search.fill("does-not-exist");
  await expect(
    picker
      .getByLabel("Specific timezone city", { exact: true })
      .locator("option")
  ).toHaveText(["No matching cities"]);
  await expect(closing).toHaveValue("Europe/Zurich");
  await search.fill("amsterdam");
  await search.press("Enter");
  await expect(page).toHaveURL("/editions/new");
  await picker
    .getByLabel("Specific timezone city", { exact: true })
    .selectOption("Europe/Amsterdam");
  await expect(closing).toHaveValue("Europe/Amsterdam");
  await expect(closing.locator("option:checked")).toHaveText(
    "Central European Time"
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.getByRole("button", { name: "Add edition", exact: true }).click();
  await expect(page).toHaveURL("/editions/11");
  expect(saved).toMatchObject({
    cfp_closes_timezone: "Europe/Amsterdam",
    cfp_closes_time: "23:59",
    cfp_closes_on: "2030-06-27",
  });
  await expect(
    page.getByText(
      /Closes 27 Jun 2030, 23:59 \(Central European Time, UTC\+2\)/
    )
  ).toBeVisible();
  await page.close();
});

for (const zone of ["Europe/Amsterdam", "America/Phoenix"]) {
  test(`friendly labels preserve saved ${zone} when editing other fields`, async ({
    page,
  }) => {
    let saved: Record<string, unknown> = {};
    await page.route("**/api/me", (route) =>
      route.fulfill({
        json: {
          user: { id: 1, name: "Admin", role: "admin", profile_complete: 1 },
        },
      })
    );
    await page.route("**/api/conferences", (route) =>
      route.fulfill({ json: [conference] })
    );
    await page.route("**/api/editions/11", async (route) => {
      if (route.request().method() === "PATCH")
        saved = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        json: {
          ...baseEdition,
          cfp_closes_timezone: zone,
          cfp_closes_time: "23:59",
          ...saved,
        },
      });
    });
    await page.goto("/editions/11/edit");
    const closing = page.getByLabel("CFP closing timezone", { exact: true });
    await expect(closing).toHaveValue(zone);
    await expect(closing.locator("option:checked")).toHaveText(
      zone === "Europe/Amsterdam" ? "Central European Time" : "America/Phoenix"
    );
    await page
      .getByLabel("Notes for the crew", { exact: true })
      .fill("Keep the exact location-based timezone.");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page).toHaveURL("/editions/11");
    expect(saved.cfp_closes_timezone).toBe(zone);
  });
}

test("editing unrelated legacy fields does not invent a timezone or closing time", async ({
  page,
}) => {
  let saved: Record<string, unknown> = {};
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        user: { id: 1, name: "Admin", role: "admin", profile_complete: 1 },
      },
    })
  );
  await page.route("**/api/conferences", (route) =>
    route.fulfill({ json: [conference] })
  );
  await page.route("**/api/editions/11", async (route) => {
    if (route.request().method() === "PATCH")
      saved = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { ...baseEdition, ...saved } });
  });
  await page.goto("/editions/11/edit");
  await expect(
    page.getByLabel("CFP closing timezone", { exact: true })
  ).toHaveValue("");
  await expect(
    page.getByLabel("First day timezone", { exact: true })
  ).toHaveValue("");
  await expect(
    page.getByLabel("CFP closing time", { exact: true })
  ).toHaveValue("");
  await page
    .getByLabel("Notes for the crew", { exact: true })
    .fill("Keep the dates as originally entered.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL("/editions/11");
  expect(saved).toMatchObject({
    starts_on: "2030-08-20",
    cfp_closes_on: "2030-07-10",
    starts_timezone: "",
    cfp_closes_timezone: "",
    cfp_closes_time: "",
  });
  await expect(page.getByText(/Timezone not set/i)).toBeVisible();
});

test("submission dates have a private timezone selector and preserve it when edited", async ({
  page,
}) => {
  const submission: Record<string, unknown> = {
    id: 7,
    paper_id: null,
    paper_title: null,
    edition_id: 11,
    status: "interested",
    submitted_on: null,
    submitted_timezone: null,
    notes: null,
  };
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        user: { id: 1, name: "Member", role: "member", profile_complete: 1 },
      },
    })
  );
  await page.route("**/api/editions/11", (route) =>
    route.fulfill({ json: { ...baseEdition, my_submissions: [submission] } })
  );
  await page.route("**/api/submissions/7", async (route) => {
    Object.assign(submission, route.request().postDataJSON());
    await route.fulfill({ json: submission });
  });
  await page.goto("/editions/11");
  await page
    .getByRole("button", { name: "Edit submission details", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "The details of this submission",
    exact: true,
  });
  await expect(
    dialog.getByLabel("Submission date timezone", { exact: true })
  ).toHaveValue("America/New_York");
  await dialog.getByLabel("Submitted on", { exact: true }).fill("2030-07-10");
  await dialog
    .getByLabel("Submission date timezone", { exact: true })
    .selectOption("Asia/Tokyo");
  await dialog
    .getByRole("button", { name: "Save submission", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(submission).toMatchObject({
    submitted_on: "2030-07-10",
    submitted_timezone: "Asia/Tokyo",
    status: "interested",
  });
  await page
    .getByRole("button", { name: "Edit submission details", exact: true })
    .click();
  await expect(
    dialog.getByLabel("Submission date timezone", { exact: true })
  ).toHaveValue("Asia/Tokyo");
});
