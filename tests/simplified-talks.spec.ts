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

test("talk page edits details and abstract variants, preserves legacy abstracts and represents historical attended statuses", async ({
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
    duration_minutes: null as number | null,
    duration_max_minutes: null as number | null,
    audience_level: null as string | null,
    language: null as string | null,
    format: null as string | null,
    abstract_variants: [
      { label: "Abstract", text: "Keep my original abstract." },
    ],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    submissions: [submission],
  };
  const paperWrites: Record<string, unknown>[] = [];
  const submissionWrites: Record<string, unknown>[] = [];
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/") && request.method() !== "GET")
      mutations.push(request.method() + " " + request.url());
  });
  await page.route("**/api/papers/1", async (route) => {
    if (route.request().method() === "PATCH") {
      const data = route.request().postDataJSON() as Record<string, unknown>;
      paperWrites.push(data);
      Object.assign(paper, data, {
        abstract: paper.abstract,
        language: data.language || null,
      });
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
  // The talk page is the editor: no modal, no separate Edit step.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit talk", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("option", { name: "Attended (legacy)", exact: true })
  ).toBeDisabled();
  const status = page.getByRole("combobox", { name: /^Status for / });
  await expect(status).toHaveValue("attended");
  await expect(page.getByLabel("Abstract", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Talk title", { exact: true })).toHaveValue(
    "A good idea"
  );
  await expect(
    page.getByLabel("Talk title", { exact: true })
  ).toHaveAccessibleDescription("11 characters · 3 words");
  await expect(page.getByLabel("Abstract variant 1 label")).toHaveValue(
    "Abstract"
  );
  await expect(
    page.getByLabel("Abstract variant 1 text")
  ).toHaveAccessibleDescription("26 characters · 4 words");
  await expect(page.getByLabel("Private notes", { exact: true })).toHaveValue(
    "Previous notes"
  );
  expect(mutations).toEqual([]);
  await page.getByLabel("Abstract variant 1 label").fill("Short");
  await page.getByRole("button", { name: "Add abstract variant" }).click();
  await page.getByLabel("Abstract variant 2 label").fill("Deutsch");
  await page
    .getByLabel("Abstract variant 2 text")
    .fill("Eine gute Idee.\nZweite Zeile.");
  await expect(
    page.getByLabel("Abstract variant 2 text")
  ).toHaveAccessibleDescription("29 characters · 5 words");
  await page.getByLabel("Duration (minutes)").fill("20 – 45");
  await page.getByLabel("Audience level").selectOption("intermediate");
  await page.getByLabel("Language").fill("English");
  await page.getByLabel("Format", { exact: true }).selectOption("talk");
  await page.getByLabel("Private notes", { exact: true }).fill("My new notes");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Your talk is saved.", { exact: true })
  ).toBeVisible();
  expect(paperWrites[0]).toEqual({
    title: "A good idea",
    duration_minutes: 20,
    duration_max_minutes: 45,
    audience_level: "intermediate",
    language: "English",
    format: "talk",
    abstract_variants: [
      { label: "Short", text: "Keep my original abstract." },
      { label: "Deutsch", text: "Eine gute Idee.\nZweite Zeile." },
    ],
    notes: "My new notes",
  });
  expect(paperWrites.some((write) => "abstract" in write)).toBe(false);
  expect(paper.abstract).toBe("Keep my original abstract.");
  await expect(page.getByLabel("Abstract variant 2 label")).toHaveValue(
    "Deutsch"
  );
  await expect(status).toHaveValue("attended");

  const add = page.getByRole("button", { name: "Add abstract variant" });
  for (let i = 2; i < 20; i++) await add.click();
  await expect(page.getByLabel("Abstract variant 20 label")).toBeVisible();
  await expect(add).toBeDisabled();
  await expect(page.getByText("Your talk is saved.")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Remove abstract variant 20", exact: true })
    .click();
  await expect(add).toBeEnabled();
  expect(paperWrites).toHaveLength(1);

  await status.selectOption("confirmed");
  await expect(status).toHaveValue("confirmed");
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
