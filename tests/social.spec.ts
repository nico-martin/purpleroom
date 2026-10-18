import { expect, test } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";

const headers = { "X-Requested-With": "green-room" };
async function login(context: BrowserContext, email: string, name?: string) {
  const response = await context.request.post("/api/auth/request", {
    headers,
    data: { email },
  });
  const { link } = await response.json();
  expect(link).toBeTruthy();
  const verify = await context.request.post("/api/auth/verify", {
    headers,
    data: { token: link.split("/").at(-1) },
  });
  expect(verify.ok()).toBeTruthy();
  const { user } = await verify.json();
  if (name)
    expect(
      (await context.request.patch("/api/me", { headers, data: { name } })).ok()
    ).toBeTruthy();
  return user;
}

test("public signup requires verification and a display name; members cannot access admin screens", async ({
  page,
}) => {
  await page.goto("/conferences");
  await expect(
    page.getByRole("heading", { name: "Welcome to the room." })
  ).toBeVisible();
  await page
    .getByLabel("Email address")
    .fill(`onboarding-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Send me a sign-in link" }).click();
  const link = await page
    .getByRole("link", { name: "Open your sign-in link" })
    .getAttribute("href");
  await page.goto(new URL(link!).pathname);
  await expect(
    page.getByRole("heading", { name: "What should we call you?" })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" })
  ).toHaveCount(0);
  await page.getByLabel("Display name").fill("New speaker");
  await page.getByRole("button", { name: "Complete my profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Good stages, worth sharing." })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Add a conference", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Manage members", exact: true })
  ).toHaveCount(0);
  await page.goto("/conferences/new");
  await expect(
    page.getByText("Only admins can manage the catalog and accounts.")
  ).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByLabel("Your private calendar feed")).toHaveCount(0);
});

test("crew requests, friends-only plans and reviews, private CFP counts, unfriend and block", async ({
  browser,
  baseURL,
}) => {
  const adminContext = await browser.newContext({ baseURL });
  const aliceContext = await browser.newContext({ baseURL });
  const bobContext = await browser.newContext({ baseURL });
  try {
    await login(adminContext, "ui-test@example.com");
    const unique = Date.now();
    const alice = await login(
      aliceContext,
      `alice-${unique}@example.com`,
      "Alice Social"
    );
    const bob = await login(
      bobContext,
      `bob-${unique}@example.com`,
      "Bob Social"
    );
    const conference = await (
      await adminContext.request.post("/api/conferences", {
        headers,
        data: { name: `SocialConf ${unique}` },
      })
    ).json();
    const future = new Date(Date.now() + 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    const edition = await (
      await adminContext.request.post("/api/editions", {
        headers,
        data: {
          conference_id: conference.id,
          title: "SocialConf Berlin 26",
          starts_on: future,
        },
      })
    ).json();
    for (const title of ["Secret talk one", "Secret talk two"]) {
      const paper = await (
        await bobContext.request.post("/api/papers", {
          headers,
          data: { title },
        })
      ).json();
      expect(
        (
          await bobContext.request.post("/api/submissions", {
            headers,
            data: {
              paper_id: paper.id,
              edition_id: edition.id,
              status: "rejected",
            },
          })
        ).ok()
      ).toBeTruthy();
    }
    await bobContext.request.put(`/api/editions/${edition.id}/attendance`, {
      headers,
      data: { status: "going" },
    });
    await bobContext.request.put(`/api/conferences/${conference.id}/review`, {
      headers,
      data: { tags: ["covers_travel"], text: "A friends-only review" },
    });
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();
    await alicePage.goto(`/editions/${edition.id}`);
    await expect(
      alicePage.getByText("0 friends have submitted a CFP.")
    ).toBeVisible();
    await expect(
      alicePage.getByText("Bob Social", { exact: true })
    ).toHaveCount(0);
    await alicePage.goto("/crew");
    await alicePage
      .getByRole("button", { name: "All members", exact: true })
      .click();
    await alicePage.getByLabel("Search members").fill("Bob Social");
    await alicePage
      .getByRole("button", { name: "Add to crew", exact: true })
      .click();
    await expect(
      alicePage.getByRole("button", { name: "Cancel request" })
    ).toBeVisible();
    await bobPage.goto("/crew");
    await bobPage
      .getByRole("button", { name: "Requests (1)", exact: true })
      .click();
    await expect(
      bobPage.getByRole("link", {
        name: "Alice Social Wants to join your crew",
      })
    ).toBeVisible();
    await bobPage.getByRole("button", { name: "Accept", exact: true }).click();
    await alicePage.goto(`/editions/${edition.id}`);
    await expect(
      alicePage.getByText("1 friend has submitted a CFP.")
    ).toBeVisible();
    await expect(
      alicePage.getByText("Bob Social", { exact: true })
    ).toHaveCount(2);
    await expect(
      alicePage.getByText("Secret talk one", { exact: true })
    ).toHaveCount(0);
    await expect(alicePage.getByText("Rejected", { exact: true })).toHaveCount(
      0
    );
    await expect(
      alicePage.getByText("Notes from the crew", { exact: true })
    ).toHaveCount(0);
    await alicePage.goto(`/conferences/${conference.id}`);
    await expect(
      alicePage.getByText("A friends-only review", { exact: true })
    ).toBeVisible();
    await alicePage.goto(`/members/${bob.id}`);
    await expect(
      alicePage.getByRole("link", { name: /SocialConf Berlin 26/ })
    ).toBeVisible();
    alicePage.once("dialog", (dialog) => dialog.accept());
    await alicePage
      .getByRole("button", { name: "Unfriend", exact: true })
      .click();
    await expect(
      alicePage.getByRole("link", { name: /SocialConf Berlin 26/ })
    ).toHaveCount(0);
    await alicePage.goto(`/conferences/${conference.id}`);
    await expect(
      alicePage.getByText("A friends-only review", { exact: true })
    ).toHaveCount(0);
    await alicePage.goto(`/members/${bob.id}`);
    alicePage.once("dialog", (dialog) => dialog.accept());
    await alicePage.getByRole("button", { name: "Block", exact: true }).click();
    await expect(alicePage.getByText("Member not found.")).toBeVisible();
    await alicePage.goto("/crew");
    await alicePage
      .getByRole("button", { name: "Blocked", exact: true })
      .click();
    await expect(
      alicePage.getByText("Bob Social", { exact: true })
    ).toBeVisible();
    await alicePage
      .getByRole("button", { name: "Unblock", exact: true })
      .click();
    await expect(alicePage.getByText("No blocked members.")).toBeVisible();
    await alicePage.setViewportSize({ width: 390, height: 844 });
    await alicePage
      .getByRole("button", { name: "All members", exact: true })
      .click();
    expect(
      await alicePage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await alicePage.screenshot({
      path: "test-results/social-directory-mobile.png",
      fullPage: true,
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin");
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage
      .getByRole("button", { name: "Demote", exact: true })
      .click();
    await expect(
      adminPage.getByText(
        "The last active admin cannot be demoted or suspended."
      )
    ).toBeVisible();
    const bobControls = adminPage.getByRole("group", {
      name: "Manage Bob Social",
      exact: true,
    });
    adminPage.once("dialog", (dialog) => dialog.accept());
    await bobControls
      .getByRole("button", { name: "Promote", exact: true })
      .click();
    await expect(
      bobControls.getByRole("button", { name: "Demote", exact: true })
    ).toBeVisible();
    adminPage.once("dialog", (dialog) => dialog.accept());
    await bobControls
      .getByRole("button", { name: "Suspend", exact: true })
      .click();
    await expect(
      bobControls.getByText("Suspended", { exact: true })
    ).toBeVisible();
    expect((await bobContext.request.get("/api/me")).status()).toBe(401);
    adminPage.once("dialog", (dialog) => dialog.accept());
    await bobControls
      .getByRole("button", { name: "Restore access", exact: true })
      .click();
    await expect(
      bobControls.getByRole("button", { name: "Suspend", exact: true })
    ).toBeVisible();
    expect((await bobContext.request.get("/api/me")).status()).toBe(401);
    await adminPage.screenshot({
      path: "test-results/social-admin-desktop.png",
      fullPage: true,
    });
    expect(alice.id).not.toBe(bob.id);
  } finally {
    await Promise.all([
      adminContext.close(),
      aliceContext.close(),
      bobContext.close(),
    ]);
  }
});
