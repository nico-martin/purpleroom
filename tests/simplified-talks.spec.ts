import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 1,
          name: "Nico",
          avatar_url: null,
          email: "test@example.com",
        },
        cal_url: "https://example.com/calendar",
      },
    })
  );
});

test("Around the room renders only the newest ten supplied entries", async ({
  page,
}) => {
  const activity = Array.from({ length: 15 }, (_, index) => ({
    type: "conference",
    at: new Date(Date.now() - index * 60000).toISOString(),
    user: { id: 1, name: "Nico", avatar_url: null },
    summary: `Activity ${String(index + 1).padStart(2, "0")}`,
    link: `/conferences/${index + 1}`,
  }));
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      json: { open_cfps: [], upcoming: [], recent_activity: activity },
    })
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Around the room", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("link").filter({ hasText: /Activity \d{2}/ })
  ).toHaveCount(10);
  await expect(page.getByText("Activity 10", { exact: false })).toBeVisible();
  await expect(page.getByText("Activity 11", { exact: false })).toHaveCount(0);
});

test("simplified editors preserve legacy abstracts and represent historical attended statuses", async ({
  page,
}) => {
  const submission = {
    id: 3,
    paper_id: 1,
    edition_id: 7,
    status: "attended",
    abstract_override: "Keep my edition abstract.",
    hide_title: 0,
    submitted_on: "2026-01-01",
    notes: "Previous submission notes" as string | null,
    updated_at: "2026-01-01T00:00:00Z",
    edition: { id: 7, year: 2026 },
    conference: { id: 2, name: "A good conference" },
  };
  const paper = {
    id: 1,
    owner_id: 1,
    title: "A good idea",
    abstract: "Keep my original abstract.",
    notes: "Previous notes",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    submissions: [submission],
  };
  const paperWrites: Record<string, unknown>[] = [];
  const submissionWrites: Record<string, unknown>[] = [];
  await page.route("**/api/papers/1", async (route) => {
    if (route.request().method() === "PATCH") {
      const data = route.request().postDataJSON() as Record<string, unknown>;
      paperWrites.push(data);
      paper.title = String(data.title);
      paper.notes = String(data.notes);
    }
    await route.fulfill({ json: paper });
  });
  await page.route("**/api/submissions/3", async (route) => {
    const data = route.request().postDataJSON() as Record<string, unknown>;
    submissionWrites.push(data);
    if (data.status) submission.status = String(data.status);
    if (typeof data.hide_title === "boolean")
      submission.hide_title = Number(data.hide_title);
    if (typeof data.submitted_on === "string")
      submission.submitted_on = data.submitted_on;
    if (typeof data.notes === "string" || data.notes === null)
      submission.notes = data.notes;
    await route.fulfill({ json: submission });
  });
  await page.goto("/talks/1");
  await expect(
    page.getByRole("heading", { name: "A good idea", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Abstract", exact: true })
  ).toHaveCount(0);
  await expect(page.getByText(paper.abstract, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("option", { name: "Attended (legacy)", exact: true })
  ).toBeDisabled();
  await expect(page.getByRole("combobox")).toHaveValue("attended");
  await page.getByRole("button", { name: "Edit talk", exact: true }).click();
  await expect(page.getByLabel("Abstract", { exact: true })).toHaveCount(0);
  await page.getByLabel("Private notes").fill("My new notes");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("My new notes", { exact: true })).toBeVisible();
  expect(paperWrites[0]).toEqual({
    title: "A good idea",
    notes: "My new notes",
  });
  expect(paper.abstract).toBe("Keep my original abstract.");

  await page.getByRole("combobox").selectOption("confirmed");
  await expect(page.getByRole("combobox")).toHaveValue("confirmed");
  await expect(page.locator('option[value="attended"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit submission details", exact: true })
    .click();
  await expect(
    page.getByLabel("Abstract for this edition", { exact: true })
  ).toHaveCount(0);
  await expect(page.getByLabel("Hide talk title from the crew")).toHaveCount(0);
  await expect(
    page.getByLabel("Private notes (optional)", { exact: true })
  ).toHaveValue("Previous submission notes");
  await page
    .getByLabel("Private notes (optional)", { exact: true })
    .fill("Follow up with the organiser.\nDiscuss travel arrangements.");
  await page
    .getByRole("button", { name: "Save submission", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(submissionWrites.at(-1)).toEqual({
    submitted_on: "2026-01-01",
    submitted_timezone: null,
    notes: "Follow up with the organiser.\nDiscuss travel arrangements.",
  });
  await page
    .getByRole("button", { name: "Edit submission details", exact: true })
    .click();
  await expect(
    page.getByLabel("Private notes (optional)", { exact: true })
  ).toHaveValue(submission.notes ?? "");
  await page.getByLabel("Private notes (optional)", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Save submission", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(submissionWrites.at(-1)?.notes).toBeNull();
  expect(submission.abstract_override).toBe("Keep my edition abstract.");
});
