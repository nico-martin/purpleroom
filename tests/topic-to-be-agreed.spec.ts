import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

const headers = { "X-Requested-With": "green-room" };
async function signIn(
  request: APIRequestContext,
  email: string,
  name?: string
) {
  const response = await request.post("/api/auth/request", {
    headers,
    data: { email },
  });
  const { link } = await response.json();
  expect(link).toBeTruthy();
  expect(
    (
      await request.post("/api/auth/verify", {
        headers,
        data: { token: link.split("/").at(-1) },
      })
    ).ok()
  ).toBeTruthy();
  if (name)
    expect(
      (await request.patch("/api/me", { headers, data: { name } })).ok()
    ).toBeTruthy();
}

test("a topic can be tracked without a talk, then attached to a new or existing proposal", async ({
  page,
  browser,
  baseURL,
}) => {
  const admin = await browser.newContext({ baseURL });
  try {
    await signIn(admin.request, "ui-test@example.com");
    await signIn(
      page.request,
      `topic-${Date.now()}@example.com`,
      "Topic Speaker"
    );
    const conference = await (
      await admin.request.post("/api/conferences", {
        headers,
        data: { name: `Open conversation ${Date.now()}` },
      })
    ).json();
    const future = new Date(Date.now() + 60 * 86400000)
      .toISOString()
      .slice(0, 10);
    const createEdition = async (title: string) =>
      await (
        await admin.request.post("/api/editions", {
          headers,
          data: { conference_id: conference.id, title, starts_on: future },
        })
      ).json();
    const first = await createEdition("A conversation in Berlin");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/editions/${first.id}`);
    await page
      .getByRole("button", { name: "Add my talk", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Topic to be agreed", exact: true })
      .click();
    await expect(dialog.getByLabel("Talk title", { exact: true })).toHaveCount(
      0
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await dialog
      .getByLabel("Submission status", { exact: true })
      .selectOption("submitted");
    await page.screenshot({
      path: "test-results/topic-to-be-agreed-mobile.png",
      fullPage: true,
    });
    await dialog
      .getByRole("button", { name: "Add opportunity", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText("Topic to be agreed", { exact: true })
    ).toBeVisible();
    expect(await (await page.request.get("/api/papers")).json()).toEqual([]);
    const [original] = await (
      await page.request.get("/api/submissions?unassigned=1")
    ).json();
    expect(original.paper_id).toBeNull();
    expect(original.status).toBe("submitted");
    expect(original.submitted_on).toBeTruthy();
    await expect(
      page.getByRole("button", { name: "Going", exact: true })
    ).toHaveAttribute("aria-pressed", "false");
    await page.goto("/talks");
    await expect(
      page.getByRole("heading", { name: "Topics to be agreed", exact: false })
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Attach a talk", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "New talk", exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "Topic to be agreed", exact: true })
    ).toHaveCount(0);
    await dialog
      .getByLabel("Talk title", { exact: true })
      .fill("The topic we chose");
    await dialog
      .getByRole("button", { name: "Attach talk", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "The topic we chose", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Topics to be agreed", exact: false })
    ).toHaveCount(0);
    const [attached] = await (
      await page.request.get("/api/submissions")
    ).json();
    expect(attached.id).toBe(original.id);
    expect(attached.status).toBe(original.status);
    expect(attached.submitted_on).toBe(original.submitted_on);
    const library = await (await page.request.get("/api/papers")).json();
    expect(library).toHaveLength(1);
    expect(library[0].submissions[0].id).toBe(original.id);

    const second = await createEdition("A conversation in London");
    await page.goto(`/editions/${second.id}`);
    await page
      .getByRole("button", { name: "Add my talk", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Topic to be agreed", exact: true })
      .click();
    await dialog
      .getByLabel("Submission status", { exact: true })
      .selectOption("accepted");
    await dialog
      .getByRole("button", { name: "Add opportunity", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("button", { name: "Edit submission details", exact: true })
      .click();
    await dialog.getByLabel("Submitted on", { exact: true }).fill("2026-05-01");
    await dialog
      .getByLabel("Private notes (optional)", { exact: true })
      .fill("Discuss a workshop format with the organiser.");
    await dialog
      .getByRole("button", { name: "Save submission", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("button", { name: "Attach a talk", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "From my library", exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await dialog
      .getByLabel("Your talk", { exact: true })
      .selectOption(String(library[0].id));
    await dialog
      .getByRole("button", { name: "Attach talk", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText("The topic we chose", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", {
        name: "Status for The topic we chose",
        exact: true,
      })
    ).toHaveValue("accepted");
    const all = await (await page.request.get("/api/submissions")).json();
    const secondSubmission = all.find(
      (submission: { edition_id: number }) =>
        submission.edition_id === second.id
    );
    expect(secondSubmission.paper_id).toBe(library[0].id);
    expect(secondSubmission.submitted_on).toBe("2026-05-01");
    expect(secondSubmission.status).toBe("accepted");
    expect(secondSubmission.notes).toBe(
      "Discuss a workshop format with the organiser."
    );
    await page.goto("/talks");
    await expect(
      page.getByRole("img", {
        name: "Current submission statuses: Submitted 1, Accepted 1",
        exact: true,
      })
    ).toBeVisible();
    expect(await (await page.request.get("/api/papers")).json()).toHaveLength(
      1
    );
    expect(
      await (await page.request.get("/api/submissions?unassigned=1")).json()
    ).toEqual([]);
  } finally {
    await admin.close();
  }
});
