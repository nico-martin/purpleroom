import { expect, test } from "@playwright/test";
import type { BrowserContext, Locator } from "@playwright/test";
import { spawnSync } from "node:child_process";

const headers = { "X-Requested-With": "green-room" };
async function expectCopyIconCentered(control: Locator) {
  const icon = await control.locator("svg").boundingBox();
  const text = await control.locator("span").boundingBox();
  expect(icon).not.toBeNull();
  expect(text).not.toBeNull();
  expect(
    Math.abs(icon!.y + icon!.height / 2 - text!.y - text!.height / 2)
  ).toBeLessThan(1);
}
async function expectCopyFitsContent(control: Locator) {
  const dimensions = await control.evaluate((element) => {
    const button = element.getBoundingClientRect();
    const icon = element.querySelector("svg")!.getBoundingClientRect();
    const text = element.querySelector("span")!.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      actual: button.width,
      content:
        icon.width +
        text.width +
        parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight) +
        parseFloat(style.columnGap),
    };
  });
  expect(dimensions.actual).toBeLessThanOrEqual(dimensions.content + 1);
}
async function signup(context: BrowserContext, name: string) {
  const response = await context.request.post("/api/auth/request", {
    headers,
    data: {
      email: `speaker-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
    },
  });
  const { request_id, code } = await response.json();
  expect(
    (
      await context.request.post("/api/auth/verify", {
        headers,
        data: { request_id, code },
      })
    ).ok()
  ).toBeTruthy();
  expect(
    (await context.request.patch("/api/me", { headers, data: { name } })).ok()
  ).toBeTruthy();
}

// Settings load the published Shareable image; keep tests off the hosted renderer.
test.beforeEach(({ context }) =>
  context.route("https://shareable.nico.dev/**", (route) => route.abort())
);

test("username typeahead validates four characters, debounces checks, treats reserved names as taken and ignores stale results", async ({
  page,
}) => {
  const user = {
    id: 1,
    name: "Username Test",
    email: "private@example.com",
    role: "member",
    profile_complete: 1,
    avatar_url: null,
    username: "owned-name",
  };
  await page.route("**/api/me", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 409,
          json: {
            error: {
              code: "username_taken",
              message: "This username is already taken.",
              fields: { username: "taken" },
            },
          },
        })
      : route.fulfill({ json: { user } })
  );
  await page.route("**/api/speaker", (route) =>
    route.fulfill({
      json: {
        draft: {
          tagline: "",
          company: "",
          job_title: "",
          contact_email: "",
          bios: [],
          appearances: [],
        },
        pictures: [],
        published: false,
        username: user.username,
      },
    })
  );
  const checked: string[] = [];
  let releaseSlow: (() => void) | undefined;
  let finishSlow: (() => void) | undefined;
  const slowFinished = new Promise<void>((resolve) => {
    finishSlow = resolve;
  });
  await page.route(/\/api\/speaker\/username-availability\?/, async (route) => {
    const username = new URL(route.request().url()).searchParams.get(
      "username"
    )!;
    checked.push(username);
    if (username === "slow-name") {
      await new Promise<void>((resolve) => {
        releaseSlow = resolve;
      });
      await route
        .fulfill({ json: { username, available: false } })
        .catch(() => {});
      finishSlow!();
      return;
    }
    if (username === "error-name") {
      await route.fulfill({
        status: 503,
        json: { error: { code: "unavailable", message: "Try again." } },
      });
      return;
    }
    await route.fulfill({
      json: { username, available: username !== "purple-room" },
    });
  });
  await page.clock.install();
  await page.goto("/settings/speaker");
  const input = page.getByLabel("Username", { exact: true });
  const feedback = page.getByTestId("username-availability");
  const save = page.getByRole("button", {
    name: "Save username and links",
    exact: true,
  });
  await expect(feedback).toHaveText("This is your current username.");
  await expect(
    page.getByText("Reserved names cannot be claimed.", { exact: false })
  ).toHaveCount(0);
  await input.fill("abc");
  await expect(feedback).toHaveText("Use at least 4 characters.");
  await expect(input).toHaveAttribute("minlength", "4");
  await expect(save).toBeDisabled();
  await page.clock.runFor(1000);
  expect(checked).toEqual([]);
  await input.fill("first-name");
  await page.clock.runFor(200);
  await input.fill("fresher-name");
  await page.clock.runFor(349);
  expect(checked).toEqual([]);
  await page.clock.runFor(1);
  await expect(feedback).toHaveText("This username is available.");
  expect(checked).toEqual(["fresher-name"]);
  await expect(save).toBeEnabled();
  await input.fill("purple-room");
  await page.clock.runFor(350);
  await expect(feedback).toHaveText("This username is already taken.");
  await expect(save).toBeDisabled();
  await input.fill("slow-name");
  await page.clock.runFor(350);
  await expect.poll(() => checked.includes("slow-name")).toBe(true);
  await input.fill("fast-name");
  await page.clock.runFor(350);
  await expect(feedback).toHaveText("This username is available.");
  releaseSlow!();
  await slowFinished;
  await expect(feedback).toHaveText("This username is available.");
  await input.fill("error-name");
  await page.clock.runFor(350);
  await expect(feedback).toContainText("Could not check availability.");
  await expect(save).toBeEnabled();
  await input.fill("race-name");
  await page.clock.runFor(350);
  await expect(feedback).toHaveText("This username is available.");
  await save.click();
  await expect(page.getByRole("alert")).toContainText(
    "This username is already taken."
  );
  await expect(input).toHaveValue("race-name");
  await input.fill("");
  await page.clock.runFor(1000);
  await expect(feedback).toHaveCount(0);
  await expect(save).toBeEnabled();
  expect(checked).not.toContain("");
});

test("sliding public toggle publishes all saved speaker information directly without preview or sharing checklists", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signup(context, "Speaker Consent Test");
  const username = `consent-${Date.now()}`;
  await page.goto("/settings");
  await expect(page.getByLabel("Username", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Homepage", { exact: true })).toHaveCount(0);
  await page
    .getByRole("link", { name: "Open speaker settings", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings\/speaker$/);
  await expect(
    page.locator('aside a[href="/settings"] + a[href="/settings/speaker"]')
  ).toHaveText("Speaker settings");
  const publicToggle = page.getByRole("switch", {
    name: "Make my profile public",
  });
  await expect(publicToggle).toHaveJSProperty("tagName", "BUTTON");
  await expect(publicToggle).not.toBeChecked();
  await expect(publicToggle).toBeEnabled();
  await publicToggle.click();
  await expect(page.getByRole("alert")).toContainText(
    "Claim a username in Speaker settings first."
  );
  await expect(publicToggle).not.toBeChecked();
  await page.getByLabel("Username", { exact: true }).fill("purple-room");
  await expect(page.getByTestId("username-availability")).toHaveText(
    "This username is already taken."
  );
  await expect(
    page.getByRole("button", { name: "Save username and links", exact: true })
  ).toBeDisabled();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page
    .getByLabel("Homepage", { exact: true })
    .fill("https://speaker.example/original");
  await page
    .getByRole("button", { name: "Save username and links", exact: true })
    .click();
  await expect(
    page.getByText("Your username and links are saved.")
  ).toBeVisible();
  await expect(publicToggle).not.toBeChecked();
  await expect(publicToggle).toBeEnabled();
  await page
    .getByLabel("Tagline", { exact: true })
    .fill("Building a better web");
  await page.getByLabel("Company", { exact: true }).fill("Speaker company");
  await page.getByLabel("Job title", { exact: true }).fill("Engineer");
  await page
    .getByLabel("Public contact email", { exact: true })
    .fill("speaker-contact@example.com");
  await page.getByRole("button", { name: "Add bio variant" }).click();
  await page.getByLabel("Bio 1 label").fill("Short English");
  await page
    .getByLabel("Bio 1 text")
    .fill("Public first line.\nSecond line stays intact.");
  await page.getByRole("button", { name: "Add bio variant" }).click();
  await page.getByLabel("Bio 2 label").fill("Long English");
  await page.getByLabel("Bio 2 text").fill("The complete long biography.");
  await page
    .getByRole("button", {
      name: "Save speaker information",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Your speaker information is saved. Public sharing is unchanged."
    )
  ).toBeVisible();
  await expect(publicToggle).not.toBeChecked();
  await expect(
    page.getByText("Choose what to share", { exact: true })
  ).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  let previewRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/speaker/preview")
      previewRequests++;
  });
  const visitor = await browser.newContext({ baseURL });
  const publicPage = await visitor.newPage();
  const privateRequests: string[] = [];
  publicPage.on("request", (request) => {
    if (/\/api\/(me|users|speaker)(\/|$)/.test(new URL(request.url()).pathname))
      privateRequests.push(request.url());
  });
  try {
    await publicPage.goto(`/u/${username}`);
    await expect(
      publicPage.getByText("Speaker profile not found.")
    ).toBeVisible();
    const thumb = publicToggle.locator('span[aria-hidden="true"] > span');
    const privateThumb = await thumb.boundingBox();
    await publicToggle.focus();
    await page.keyboard.press("Space");
    await expect(publicToggle).toBeChecked();
    await expect(
      page.getByText("Your complete speaker profile is now public.")
    ).toBeVisible();
    expect(previewRequests).toBe(0);
    expect((await thumb.boundingBox())!.x).toBeGreaterThan(
      privateThumb!.x + 19
    );
    await page
      .getByRole("region", { name: "Public speaker profile", exact: true })
      .screenshot({ path: "test-results/speaker-public-sliding-toggle.png" });
    await publicPage.reload();
    await expect(
      publicPage.getByRole("heading", {
        name: "Speaker Consent Test",
        exact: true,
      })
    ).toBeVisible();
    await expect(
      publicPage.getByText("Building a better web", { exact: true })
    ).toBeVisible();
    await expectCopyIconCentered(
      publicPage.getByRole("button", { name: "Copy speaker name", exact: true })
    );
    await expectCopyIconCentered(
      publicPage.getByRole("button", { name: "Copy Tagline", exact: true })
    );
    await expectCopyFitsContent(
      publicPage.getByRole("button", { name: "Copy Company", exact: true })
    );
    await expect(
      publicPage.getByText("Speaker company", { exact: true })
    ).toBeVisible();
    await expect(
      publicPage.getByText("The complete long biography.", { exact: true })
    ).toHaveCount(0);
    await publicPage
      .getByRole("combobox", { name: "Bio variant", exact: true })
      .selectOption("1");
    await expect(
      publicPage.getByText("The complete long biography.", { exact: true })
    ).toBeVisible();
    await expect(
      publicPage.getByText("Public first line.\nSecond line stays intact.", {
        exact: true,
      })
    ).toHaveCount(0);
    await visitor.grantPermissions(["clipboard-read", "clipboard-write"]);
    const publicBio = publicPage.getByRole("button", {
      name: "Copy Long English bio",
      exact: true,
    });
    await publicBio.click();
    await expect(publicBio.locator("svg.lucide-check")).toBeVisible();
    await expectCopyIconCentered(publicBio);
    await expectCopyFitsContent(publicBio);
    expect(
      await publicPage.evaluate(() => navigator.clipboard.readText())
    ).toBe("The complete long biography.");
    await expect(
      publicPage.getByText("Engineer", { exact: true })
    ).toBeVisible();
    await expect(
      publicPage.getByText("speaker-contact@example.com", { exact: true })
    ).toBeVisible();
    await expect(
      publicPage.getByRole("link", { name: "Public JSON API" })
    ).toHaveAttribute("href", `/api/public/speakers/${username}`);
    await expect(
      publicPage.getByRole("link", { name: "Homepage", exact: true })
    ).toHaveAttribute("href", "https://speaker.example/original");
    const copyHomepage = publicPage.getByRole("button", {
      name: "Copy Homepage URL",
      exact: true,
    });
    await copyHomepage.click();
    await expect(copyHomepage.locator("svg.lucide-check")).toBeVisible();
    expect(
      await publicPage.evaluate(() => navigator.clipboard.readText())
    ).toBe("https://speaker.example/original");
    await expect(
      publicPage.getByRole("link", { name: "Homepage", exact: true })
    ).toHaveAttribute("target", "_blank");
    await visitor.route("https://speaker.example/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>External link fixture</h1>",
      })
    );
    const popupPromise = publicPage.waitForEvent("popup");
    await publicPage
      .getByRole("link", { name: "Homepage", exact: true })
      .click();
    const popup = await popupPromise;
    await popup.waitForURL("https://speaker.example/original");
    await popup.close();
    await page
      .getByLabel("Homepage", { exact: true })
      .fill("https://speaker.example/new-private-link");
    await expect(publicToggle).toBeEnabled();
    await page
      .getByRole("button", { name: "Update public profile", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Public speaker profile" })
        .getByRole("alert")
    ).toContainText(
      "Save your changes above before publishing your speaker profile."
    );
    await page
      .getByRole("button", { name: "Save username and links", exact: true })
      .click();
    await expect(
      page.getByText("Your username and links are saved.")
    ).toBeVisible();
    await expect(publicToggle).toBeChecked();
    await publicPage.reload();
    await expect(
      publicPage.getByRole("link", { name: "Homepage", exact: true })
    ).toHaveAttribute("href", "https://speaker.example/original");
    await page.reload();
    await expect(publicToggle).toBeChecked();
    await page
      .getByLabel("Tagline", { exact: true })
      .fill("Changed only in private");
    await page
      .getByRole("button", {
        name: "Save speaker information",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        "Your speaker information is saved. Public sharing is unchanged."
      )
    ).toBeVisible();
    await publicPage.reload();
    await expect(
      publicPage.getByText("Building a better web", { exact: true })
    ).toBeVisible();
    await expect(
      publicPage.getByText("Changed only in private", { exact: true })
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Update public profile", exact: true })
      .click();
    await expect(
      page.getByText("Your complete speaker profile is now public.")
    ).toBeVisible();
    await publicPage.reload();
    await expect(
      publicPage.getByText("Changed only in private", { exact: true })
    ).toBeVisible();
    await expect(
      publicPage.getByRole("link", { name: "Homepage", exact: true })
    ).toHaveAttribute("href", "https://speaker.example/new-private-link");
    for (const theme of ["Light", "Dark"] as const) {
      await publicPage
        .getByRole("group", { name: "Colour theme" })
        .getByRole("button", { name: theme, exact: true })
        .click();
      await publicPage.setViewportSize({ width: 390, height: 844 });
      await expect(publicPage.locator("html")).toHaveAttribute(
        "data-theme",
        theme.toLowerCase()
      );
      await expect(
        publicPage.getByRole("button", { name: "Copy Tagline", exact: true })
      ).toHaveCSS(
        "color",
        theme === "Dark" ? "rgb(239, 231, 245)" : "rgb(48, 38, 56)"
      );
      await expect(
        publicPage.getByRole("button", {
          name: "Copy speaker name",
          exact: true,
        })
      ).toHaveCSS("font-size", "36px");
      await expectCopyIconCentered(
        publicPage.getByRole("button", {
          name: "Copy speaker name",
          exact: true,
        })
      );
      await expectCopyFitsContent(
        publicPage.getByRole("button", { name: "Copy Company", exact: true })
      );
      expect(
        await publicPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true);
    }
    await publicPage.screenshot({
      path: "test-results/public-speaker-dark-mobile.png",
      fullPage: true,
    });
    await page
      .getByLabel("Company", { exact: true })
      .fill("Unsaved company stays editable");
    await publicToggle.click();
    await expect(publicToggle).not.toBeChecked();
    await expect(page.getByText("Your profile is now private.")).toBeVisible();
    await publicPage.reload();
    await expect(
      publicPage.getByText("Speaker profile not found.")
    ).toBeVisible();
    expect(privateRequests).toEqual([]);
    await page.reload();
    await expect(publicToggle).not.toBeChecked();
    await expect(publicToggle).toBeEnabled();
    await page
      .getByRole("button", { name: "Preview public profile", exact: true })
      .click();
    await expect(
      page.getByText("This optional preview is private.", { exact: false })
    ).toBeVisible();
    await expect(publicToggle).not.toBeChecked();
    await publicPage.reload();
    await expect(
      publicPage.getByText("Speaker profile not found.")
    ).toBeVisible();
  } finally {
    await visitor.close();
  }
});

test("toolkit is read-only and copies text, links and icons with persistent content, keyboard support and failure feedback", async ({
  page,
  context,
}) => {
  await signup(context, "Private Toolkit Speaker");
  const homepage = `https://speaker.example/${"long-path".repeat(35)}`;
  await context.request.patch("/api/me", {
    headers,
    data: { homepage_url: homepage, github_url: "https://github.com/speaker" },
  });
  const response = await context.request.put("/api/speaker", {
    headers,
    data: {
      tagline: "A sentence ready to copy.",
      company: "Private company",
      job_title: "Engineer",
      contact_email: "public-contact@example.com",
      bios: [
        { label: "Short English", text: "A private bio.\nA second line." },
        { label: "Long English", text: "A different long bio." },
      ],
      appearances: [
        {
          kind: "talk",
          title: "Reusable talk title",
          url: "https://speaker.example/talk",
          description: "A reusable talk description.",
        },
      ],
    },
  });
  expect(response.ok()).toBeTruthy();
  const saved = await response.json();
  const media = "/api/speaker/pictures/999";
  await page.route("**/api/speaker", (route) =>
    route.fulfill({
      json: {
        ...saved,
        pictures: ["Private portrait", "Stage one", "Stage two"].map(
          (label, index) => ({
            id: 999 + index,
            label,
            credit: "Credit the photographer",
            url: media,
            download_url: `${media}/download`,
          })
        ),
      },
    })
  );
  await page.route(`**${media}`, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAt8AAAAASUVORK5CYII=",
        "base64"
      ),
    })
  );
  await page.route(`**${media}/download`, (route) =>
    route.fulfill({
      contentType: "image/png",
      headers: {
        "Content-Disposition": 'attachment; filename="private-portrait.png"',
      },
      body: Buffer.from("picture fixture"),
    })
  );
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/") && request.method() !== "GET")
      mutations.push(request.method() + " " + request.url());
  });
  await page.goto("/speaker");
  await expect(
    page.getByRole("heading", { name: "Speaker toolkit", exact: true })
  ).toBeVisible();
  await expect(
    page.locator("main form, main input, main textarea")
  ).toHaveCount(0);
  await expect(
    page.getByRole("switch", { name: "Make my profile public" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /save|remove|publish|preview/i })
  ).toHaveCount(0);
  await expect(
    page.getByText("Private company", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("A private bio.\nA second line.", { exact: true })
  ).toBeVisible();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const tagline = page.getByRole("button", {
    name: "Copy Tagline",
    exact: true,
  });
  await expect(tagline.locator("svg.lucide-copy")).toBeVisible();
  await tagline.getByText("A sentence ready to copy.", { exact: true }).click();
  await expect(tagline.locator("svg.lucide-check")).toBeVisible();
  await expect(tagline).toHaveText("A sentence ready to copy.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "A sentence ready to copy."
  );
  const company = page.getByRole("button", {
    name: "Copy Company",
    exact: true,
  });
  await company.locator("svg").click();
  await expect(company.locator("svg.lucide-check")).toBeVisible();
  await expectCopyIconCentered(company);
  await expectCopyFitsContent(company);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Private company"
  );
  const iconBox = await company.locator("svg").boundingBox();
  const textBox = await company.locator("span").boundingBox();
  expect(textBox!.x - iconBox!.x - iconBox!.width).toBeGreaterThanOrEqual(11);
  expect(
    await company.evaluate((element) => getComputedStyle(element).paddingLeft)
  ).toBe("12px");
  const link = page.getByRole("button", { name: "Copy Homepage", exact: true });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(link.locator("svg.lucide-check")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    homepage
  );
  await expect(page).toHaveURL(/\/speaker$/);
  const bio = page.getByRole("button", {
    name: "Copy Short English bio",
    exact: true,
  });
  await expect(
    page.getByText("A different long bio.", { exact: true })
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Bio variant", exact: true })
    .selectOption("1");
  await expect(bio).toHaveCount(0);
  const longBio = page.getByRole("button", {
    name: "Copy Long English bio",
    exact: true,
  });
  await longBio.click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "A different long bio."
  );
  await page
    .getByRole("combobox", { name: "Bio variant", exact: true })
    .selectOption("0");
  await bio.click();
  await expect(bio.locator("svg.lucide-check")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "A private bio.\nA second line."
  );
  const work = page.getByRole("button", {
    name: "Copy work 1 title",
    exact: true,
  });
  await work.focus();
  await page.keyboard.press("Space");
  await expect(work.locator("svg.lucide-check")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Reusable talk title"
  );
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download Private portrait", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "private-portrait.png"
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () => Promise.reject(new Error("denied")),
    });
  });
  await bio.click();
  const fallback = page.getByRole("dialog", {
    name: "Copy Short English bio",
    exact: true,
  });
  await expect(fallback).toBeVisible();
  await expect(
    fallback.getByRole("textbox", { name: "Short English bio", exact: true })
  ).toHaveValue("A private bio.\nA second line.");
  await expect(
    fallback.getByText(
      "Clipboard unavailable. Select the text below and copy it manually."
    )
  ).toBeVisible();
  await fallback.getByRole("button", { name: "Done", exact: true }).click();
  await expect(bio.locator("svg.lucide-copy")).toBeVisible();
  for (const theme of ["Light", "Dark"] as const) {
    await page.goto("/settings");
    await page
      .getByRole("group", { name: "Colour theme" })
      .getByRole("button", { name: theme, exact: true })
      .click();
    await page.goto("/speaker");
    await page.setViewportSize({ width: 1440, height: 1000 });
    const pictureCards = page.getByRole("article", { name: /^Picture:/ });
    await expect(pictureCards).toHaveCount(3);
    const desktopRows = await pictureCards.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().y)
    );
    expect(desktopRows[0]).toBe(desktopRows[1]);
    expect(desktopRows[2]).toBe(desktopRows[0]);
    const links = page
      .getByRole("region", { name: "Reusable links" })
      .locator(".grid > div");
    const linkRows = await links.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().y)
    );
    expect(linkRows).toHaveLength(2);
    expect(linkRows[0]).toBe(linkRows[1]);
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileRows = await pictureCards.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().y)
    );
    expect(mobileRows[1]).toBeGreaterThan(mobileRows[0]);
    expect(mobileRows[2]).toBeGreaterThan(mobileRows[1]);
    const mobileLinks = await links.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().y)
    );
    expect(mobileLinks[1]).toBeGreaterThan(mobileLinks[0]);
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      theme.toLowerCase()
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/speaker-toolkit-dark-mobile.png",
    fullPage: true,
  });
  expect(mutations).toEqual([]);
});

test("toolkit Papers picker shows the selected talk's details for copying without changing it", async ({
  page,
  context,
}) => {
  await signup(context, "Talk Picker Speaker");
  for (const data of [
    {
      title: "Older talk",
      abstract_variants: [{ label: "Short", text: "Older abstract." }],
    },
    {
      title: "Newest talk",
      duration_minutes: 20,
      duration_max_minutes: 45,
      audience_level: "intermediate",
      language: "English",
      format: "workshop",
      notes: "Never in the toolkit.",
      abstract_variants: [
        { label: "Short", text: "Newest short abstract." },
        { label: "Deutsch", text: "Neueste Kurzfassung." },
      ],
    },
  ])
    expect(
      (await context.request.post("/api/papers", { headers, data })).ok()
    ).toBeTruthy();
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/") && request.method() !== "GET")
      mutations.push(request.method() + " " + request.url());
  });
  await page.goto("/speaker");
  const papers = page.getByRole("region", { name: "Papers", exact: true });
  const picker = papers.getByLabel("Talk", { exact: true });
  // The first talk in library order opens by default.
  await expect(picker).toHaveValue(
    (await picker.locator("option").first().getAttribute("value")) ?? ""
  );
  await picker.selectOption({ label: "Newest talk" });
  await expect(
    papers.getByText("20–45 minutes", { exact: true })
  ).toBeVisible();
  await expect(papers.getByText("Intermediate", { exact: true })).toBeVisible();
  await expect(papers.getByText("Workshop", { exact: true })).toBeVisible();
  await expect(
    papers.getByRole("heading", { name: "Deutsch", exact: true })
  ).toBeVisible();
  await expect(papers.getByText("Never in the toolkit.")).toHaveCount(0);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await papers
    .getByRole("button", { name: "Copy duration in minutes", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "20–45"
  );
  await papers
    .getByRole("button", { name: "Copy Deutsch abstract", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Neueste Kurzfassung."
  );
  await picker.selectOption({ label: "Older talk" });
  await expect(
    papers.getByRole("button", { name: "Copy title", exact: true })
  ).toContainText("Older talk");
  await expect(
    papers.getByText("Older abstract.", { exact: true })
  ).toBeVisible();
  await expect(papers.getByText("Newest short abstract.")).toHaveCount(0);
  await expect(papers.getByText("20–45 minutes")).toHaveCount(0);
  const edit = papers.getByRole("link", {
    name: "Edit this talk",
    exact: true,
  });
  await expect(edit).toHaveAttribute("href", /^\/talks\/\d+$/);
  expect(mutations).toEqual([]);
  await edit.click();
  await expect(page.getByLabel("Talk title", { exact: true })).toHaveValue(
    "Older talk"
  );
});

test("toolkit handles loading failures and empty saved information without offering edits", async ({
  page,
}) => {
  const user = {
    id: 1,
    name: "Empty Toolkit",
    email: "private@example.com",
    role: "member",
    profile_complete: 1,
    username: null,
    avatar_url: null,
  };
  await page.route("**/api/me", (route) => route.fulfill({ json: { user } }));
  await page.route("**/api/papers", (route) => route.fulfill({ json: [] }));
  let failed = true;
  await page.route("**/api/speaker", (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: "unavailable",
              message: "Toolkit temporarily unavailable.",
            },
          },
        })
      : route.fulfill({
          json: {
            draft: {
              tagline: "",
              company: "",
              job_title: "",
              contact_email: "",
              bios: [],
              appearances: [],
            },
            pictures: [],
            published: false,
            username: null,
          },
        })
  );
  await page.goto("/speaker");
  await expect(page.getByRole("alert")).toContainText(
    "Toolkit temporarily unavailable."
  );
  failed = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Speaker toolkit", exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Your bios, ready to go.", { exact: true })
  ).toBeVisible();
  const papers = page.getByRole("region", { name: "Papers", exact: true });
  await expect(
    papers.getByRole("heading", { name: "Papers", exact: true })
  ).toBeVisible();
  await expect(
    papers.getByText("No talks in your private library yet.", { exact: true })
  ).toBeVisible();
  await expect(papers.getByRole("link")).toHaveCount(1);
  await expect(
    papers.getByRole("link", { name: "Create a talk", exact: true })
  ).toHaveAttribute("href", "/talks/new");
  await expect(papers.getByRole("button")).toHaveCount(0);
  await expect(
    page.getByText("No links saved yet.", { exact: false })
  ).toBeVisible();
  await expect(
    page.getByText("No speaker pictures saved yet.", { exact: false })
  ).toBeVisible();
  await expect(
    page.locator("main form, main input, main textarea, main select")
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Copy speaker name", exact: true })
  ).toHaveText("Empty Toolkit");
  await expect(
    page.getByRole("link", { name: "Open speaker settings", exact: true })
  ).toHaveAttribute("href", "/settings/speaker");
});

test("picture uploads generate selectable sizes with themed landscape previews, public URLs, metadata, image copying and downloads", async ({
  page,
  context,
}) => {
  await signup(context, "Picture Sizes Speaker");
  function photo(width: number, height: number) {
    const result = spawnSync("php", [
      "-r",
      `$image=imagecreatetruecolor(${width},${height});imagefill($image,0,0,imagecolorallocate($image,102,51,153));imagepng($image);imagedestroy($image);`,
    ]);
    expect(result.status).toBe(0);
    return result.stdout;
  }
  await page.goto("/settings/speaker");
  const file = page.getByLabel("Speaker picture file", { exact: true });
  await file.setInputFiles({
    name: "too-small.png",
    mimeType: "image/png",
    buffer: photo(1999, 1000),
  });
  await page.getByLabel("Picture label", { exact: true }).fill("My portrait");
  await page.getByRole("button", { name: "Save picture", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "at least 2000 pixels wide"
  );
  const original = photo(3000, 2000);
  // Supply a saved account-avatar response; backend ownership/publication is covered by the API suite.
  const avatarUrl = "/api/avatars/123/avatar-0123456789abcdef.png";
  await page.route("**" + avatarUrl, (route) =>
    route.fulfill({ contentType: "image/png", body: photo(400, 400) })
  );
  await page.route(/\/api\/speaker(?:\/branding\/header)?$/, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    if (data.branding) data.branding.profile_url = avatarUrl;
    await route.fulfill({ response, json: data });
  });
  await file.setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: original,
  });
  await page
    .getByLabel("Picture credit and usage instructions", { exact: true })
    .fill("Photo by Example");
  const uploadResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/speaker/pictures") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Save picture", exact: true }).click();
  const uploaded = await uploadResponse;
  expect(uploaded.status()).toBe(201);
  expect(uploaded.request().headers()["content-type"]).toMatch(
    /^multipart\/form-data; boundary=/
  );
  const information = await uploaded.json();
  expect(information.published).toBe(false);
  const picture = information.pictures[0];
  expect(picture.url).toMatch(/^\/api\/speaker-pictures\/[a-f0-9]{48}$/);
  expect(
    await (await context.request.get(picture.variants.full.url)).body()
  ).toEqual(original);
  const coverUploadRequests: number[] = [];
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/speaker/branding/header") &&
      request.method() === "POST"
    )
      coverUploadRequests.push(request.postDataBuffer()!.length);
  });
  await page.getByLabel("Header image", { exact: true }).setInputFiles({
    name: "unreadable-cover.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not an image"),
  });
  await page
    .getByRole("button", { name: "Save cover image", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Your browser could not read this cover."
  );
  await expect(
    page.getByRole("button", { name: "Save cover image", exact: true })
  ).toBeEnabled();
  expect(coverUploadRequests).toEqual([]);
  await page.getByLabel("Header image", { exact: true }).setInputFiles({
    name: "large-original.png",
    mimeType: "image/png",
    buffer: Buffer.concat([photo(3000, 2000), Buffer.alloc(17191511)]),
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save cover image", exact: true })
  ).toBeEnabled();
  await expect(page.getByLabel("Profile image", { exact: true })).toHaveCount(
    0
  );
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      callback(null);
    };
  });
  await page
    .getByRole("button", { name: "Save cover image", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Your browser could not resize this cover."
  );
  expect(coverUploadRequests).toEqual([]);
  await page
    .getByRole("button", { name: "Save cover image", exact: true })
    .click();
  await expect(
    page.getByText("Your cover is saved. Public sharing is unchanged.")
  ).toBeVisible();
  expect(coverUploadRequests).toHaveLength(1);
  expect(coverUploadRequests[0]).toBeLessThan(5 * 1024 * 1024);
  const savedBranding = await (
    await context.request.get("/api/speaker")
  ).json();
  expect(savedBranding.branding.header_image.url).toMatch(
    /^\/api\/speaker\/branding-assets\//
  );
  expect(savedBranding.pictures).toHaveLength(1);
  expect(savedBranding.published).toBe(false);
  const coverBytes = await (
    await context.request.get(savedBranding.branding.header_image.url)
  ).body();
  const coverDimensions = spawnSync("php", [
    "-r",
    `$d=getimagesizefromstring(base64_decode('${coverBytes.toString("base64")}'));echo json_encode([$d[0],$d[1]]);`,
  ]);
  expect(JSON.parse(coverDimensions.stdout.toString())).toEqual([1600, 400]);
  const cover = page.getByRole("img", {
    name: "Picture Sizes Speaker cover image",
    exact: true,
  });
  const portrait = page.getByRole("img", {
    name: "Picture Sizes Speaker profile image",
    exact: true,
  });
  await expect(cover).toBeVisible();
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveAttribute("src", avatarUrl);
  const coverBox = await cover.boundingBox();
  const portraitBox = await portrait.boundingBox();
  expect(portraitBox!.y).toBeLessThan(coverBox!.y + coverBox!.height);
  expect(portraitBox!.y + portraitBox!.height).toBeGreaterThan(
    coverBox!.y + coverBox!.height
  );
  await expect(portrait).toHaveCSS("object-fit", "cover");
  await page.getByLabel("Header image", { exact: true }).setInputFiles({
    name: "too-small-cover.png",
    mimeType: "image/png",
    buffer: photo(799, 400),
  });
  await page
    .getByRole("button", { name: "Save cover image", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "at least 800 pixels wide"
  );
  await expect(cover).toBeVisible();
  await page
    .getByRole("button", { name: "Remove cover image", exact: true })
    .click();
  await expect(cover).toHaveCount(0);
  await expect(portrait).toHaveAttribute("src", avatarUrl);
  expect(
    (await (await context.request.get("/api/speaker")).json()).pictures
  ).toHaveLength(1);
  await page.goto("/speaker");
  await expect(
    page.getByText("This older picture has only its original.", {
      exact: false,
    })
  ).toHaveCount(0);
  await expect(
    page.getByText("This URL requires your sign-in.", { exact: false })
  ).toHaveCount(0);
  const card = page.getByRole("article", {
    name: "Picture: My portrait",
    exact: true,
  });
  await expect(
    card.getByRole("img", { name: "My portrait", exact: true })
  ).toBeVisible();
  const sizes = card.getByRole("group", {
    name: "Size for My portrait",
    exact: true,
  });
  await expect(
    sizes.getByRole("button", { name: "Full", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByText("3000px", { exact: true })).toBeVisible();
  await expect(card.getByText("2000px", { exact: true })).toBeVisible();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  for (const [label, key, width, height] of [
    ["S", "s", 400, 267],
    ["M", "m", 720, 480],
    ["L", "l", 1080, 720],
    ["XL", "xl", 1900, 1267],
    ["Full", "full", 3000, 2000],
  ] as const) {
    await sizes.getByRole("button", { name: label, exact: true }).click();
    await expect(
      sizes.getByRole("button", { name: label, exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByText(`${width}px`, { exact: true })).toBeVisible();
    await expect(card.getByText(`${height}px`, { exact: true })).toBeVisible();
    await expect(
      card.getByRole("link", { name: "Download My portrait", exact: true })
    ).toHaveAttribute("href", picture.variants[key].download_url);
    await expect(
      card.getByRole("img", { name: "My portrait", exact: true })
    ).toHaveAttribute("src", picture.variants.m.url);
  }
  await sizes.getByRole("button", { name: "M", exact: true }).click();
  await card
    .getByRole("button", { name: "Copy image URL: My portrait", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    new URL(picture.variants.m.url, page.url()).href
  );
  await card
    .getByRole("button", { name: "Copy image: My portrait", exact: true })
    .click();
  await expect(
    card.getByRole("status").filter({ hasText: "My portrait image copied." })
  ).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      const bitmap = await createImageBitmap(
        await items[0].getType("image/png")
      );
      const dimensions = [bitmap.width, bitmap.height];
      bitmap.close();
      return dimensions;
    })
  ).toEqual([720, 480]);
  const downloadPromise = page.waitForEvent("download");
  await card
    .getByRole("link", { name: "Download My portrait", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /-m\.(webp|png)$/
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "write", {
      configurable: true,
      value: () => Promise.reject(new Error("denied")),
    })
  );
  await card
    .getByRole("button", { name: "Copy image: My portrait", exact: true })
    .click();
  await expect(card.getByRole("alert")).toContainText(
    "The image could not be copied."
  );
  for (const theme of ["Light", "Dark"] as const) {
    await page.goto("/settings");
    await page
      .getByRole("group", { name: "Colour theme" })
      .getByRole("button", { name: theme, exact: true })
      .click();
    await page.goto("/speaker");
    await page.setViewportSize({ width: 390, height: 844 });
    const stage = card.locator(".aspect-landscape");
    const box = await stage.boundingBox();
    expect(Math.abs(box!.width / box!.height - 1.5)).toBeLessThan(0.01);
    expect(
      await stage.evaluate(
        (element) => getComputedStyle(element).backgroundColor
      )
    ).toBe(theme === "Light" ? "rgb(240, 234, 244)" : "rgb(58, 44, 68)");
    await expect(
      card.getByRole("img", { name: "My portrait", exact: true })
    ).toHaveCSS("object-fit", "contain");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
  }
  await card.screenshot({
    path: "test-results/speaker-picture-sizes-dark-mobile.png",
  });
});

test("published picture previews, usage credits and downloads work without leaking private member data", async ({
  page,
}) => {
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAt8AAAAASUVORK5CYII=",
    "base64"
  );
  const rolePicture = (id: number, size: "s" | "xl") => {
    const url = `/api/public/speakers/picture-speaker/media/revision/${id}`;
    const width = size === "s" ? 400 : 1900;
    return {
      id,
      label: `Portrait ${id}`,
      credit: "Photo credit",
      url,
      download_url: `${url}/download`,
      variants: {
        [size]: {
          width,
          height: Math.round((width * 2) / 3),
          file_size: pixel.length,
          mime_type: "image/png",
          url: `${url}/sizes/${size}`,
          download_url: `${url}/sizes/${size}/download`,
        },
      },
    };
  };
  const avatarRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/avatars/"))
      avatarRequests.push(request.url());
  });
  await page.route("**/api/public/speakers/picture-speaker", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        speaker_id: "spk_aabbccddeeff00112233445566778899",
        username: "picture-speaker",
        name: "Picture Speaker",
        profile_url: "https://example.test/u/picture-speaker",
        api_url: "https://example.test/api/public/speakers/picture-speaker",
        bios: [],
        links: [
          { field: "homepage_url", url: "https://speaker.example/" },
          { field: "github_url", url: "https://github.com/speaker" },
          { field: "linkedin_url", url: "https://linkedin.com/in/speaker" },
        ],
        appearances: [],
        header_image: rolePicture(1, "xl"),
        profile_image: rolePicture(2, "s"),
        pictures: [1, 2, 3].map((id) => {
          const url = `/api/public/speakers/picture-speaker/media/revision/${id}`;
          return {
            id,
            label: id === 1 ? "Portrait" : `Portrait ${id}`,
            credit:
              id === 1
                ? "Photo by Example; attribution required"
                : `Credit ${id}`,
            url,
            download_url: `${url}/download`,
            variants: Object.fromEntries(
              Object.entries({
                s: 400,
                m: 720,
                l: 1080,
                xl: 1900,
                full: 3000,
              }).map(([size, width]) => {
                const source = size === "full" ? url : `${url}/sizes/${size}`;
                return [
                  size,
                  {
                    width,
                    height: Math.round((width * 2) / 3),
                    file_size: size === "full" ? 1048473 : pixel.length,
                    mime_type: "image/png",
                    url: source,
                    download_url: `${source}/download`,
                  },
                ];
              })
            ),
          };
        }),
      },
    })
  );
  await page.route(
    /\/api\/public\/speakers\/picture-speaker\/media\/revision\/[123](?:\/sizes\/(?:s|m|l|xl))?(?:\/download)?$/,
    (route) =>
      route.fulfill({
        contentType: "image/png",
        headers: route.request().url().endsWith("/download")
          ? {
              "Content-Disposition": 'attachment; filename="portrait.png"',
            }
          : {},
        body: pixel,
      })
  );
  await page.goto("/u/picture-speaker");
  const integrations = page.getByRole("region", {
    name: "Profile data and integrations",
  });
  await expect(
    integrations.getByRole("heading", { name: "Profile data and integrations" })
  ).toBeVisible();
  await expect(integrations).toContainText(
    "Reuse this speaker’s published profile as structured data."
  );
  await expect(
    integrations.getByRole("link", { name: "Public JSON API", exact: true })
  ).toHaveAttribute("href", "/api/public/speakers/picture-speaker");
  await expect(
    integrations.getByRole("link", {
      name: "OpenAPI documentation",
      exact: true,
    })
  ).toHaveAttribute("href", "/speaker-openapi.json");
  await expect(
    page.getByRole("link", { name: "Sign in to purpleroom", exact: true })
  ).toHaveCount(0);
  const header = page.getByRole("img", {
    name: "Picture Speaker cover image",
    exact: true,
  });
  const profile = page.getByRole("img", {
    name: "Picture Speaker profile image",
    exact: true,
  });
  await expect(header).toHaveAttribute(
    "src",
    "/api/public/speakers/picture-speaker/media/revision/1/sizes/xl"
  );
  await expect(profile).toHaveAttribute(
    "src",
    "/api/public/speakers/picture-speaker/media/revision/2/sizes/s"
  );
  const headerBox = await header.boundingBox();
  const profileBox = await profile.boundingBox();
  expect(Math.abs(headerBox!.width / headerBox!.height - 4)).toBeLessThan(0.01);
  expect(profileBox!.y).toBeLessThan(headerBox!.y + headerBox!.height);
  expect(profileBox!.y + profileBox!.height).toBeGreaterThan(
    headerBox!.y + headerBox!.height
  );
  const portraitShape = await profile.locator("..").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      radius: parseFloat(getComputedStyle(element).borderRadius),
    };
  });
  expect(portraitShape.width).toBe(portraitShape.height);
  expect(portraitShape.radius).toBeGreaterThanOrEqual(portraitShape.width / 2);
  await expect(
    page.getByRole("img", { name: "Portrait", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Portrait", exact: true })
  ).toHaveAttribute(
    "src",
    "/api/public/speakers/picture-speaker/media/revision/1/sizes/m"
  );
  const cards = page.getByRole("article", { name: /^Picture:/ });
  await expect(cards).toHaveCount(3);
  const desktop = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y };
    })
  );
  expect(desktop[0].y).toBe(desktop[1].y);
  expect(desktop[2].y).toBe(desktop[0].y);
  expect(desktop[0].x).toBeLessThan(desktop[1].x);
  expect(desktop[1].x).toBeLessThan(desktop[2].x);
  const publicLinks = page
    .getByRole("region", { name: "Speaker links" })
    .getByRole("listitem");
  const linkRows = await publicLinks.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().y)
  );
  expect(linkRows).toHaveLength(3);
  expect(linkRows[0]).toBe(linkRows[1]);
  expect(linkRows[2]).toBeGreaterThan(linkRows[0]);
  const sizeRows = await cards
    .first()
    .getByRole("group", { name: "Size for Portrait", exact: true })
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().y)
    );
  expect(new Set(sizeRows).size).toBe(1);
  for (const label of ["Copy image: Portrait", "Copy image URL: Portrait"]) {
    await expect(
      cards.first().getByRole("button", { name: label, exact: true })
    ).toHaveCSS("white-space", "nowrap");
    await expect(
      cards.first().getByRole("button", { name: label, exact: true })
    ).toHaveCSS("height", "44px");
  }
  const values = cards.first().locator("dd");
  for (const value of await values.all()) {
    await expect(value).toHaveCSS("white-space", "nowrap");
    await expect(value).toHaveCSS("height", "20px");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: "test-results/speaker-pictures-three-columns.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 800, height: 1000 });
  const tablet = await cards.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().y)
  );
  expect(tablet[0]).toBe(tablet[1]);
  expect(tablet[2]).toBeGreaterThan(tablet[0]);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await cards.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().y)
  );
  expect(mobile[1]).toBeGreaterThan(mobile[0]);
  expect(mobile[2]).toBeGreaterThan(mobile[1]);
  const mobileLinkRows = await publicLinks.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().y)
  );
  expect(mobileLinkRows[1]).toBeGreaterThan(mobileLinkRows[0]);
  expect(mobileLinkRows[2]).toBeGreaterThan(mobileLinkRows[1]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await expect(
    page.getByText("Photo by Example; attribution required")
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download Portrait", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe("portrait.png");
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto("/u/picture-speaker#render-shareable");
  const shareCard = page.locator('[data-testid="speaker-share-card"]:visible');
  await expect(
    shareCard.getByRole("heading", { name: "Picture Speaker", exact: true })
  ).toBeVisible();
  const shareImages = shareCard.locator("img");
  await expect(shareImages).toHaveCount(2);
  await expect(shareImages.nth(0)).toHaveAttribute(
    "src",
    "/api/public/speakers/picture-speaker/media/revision/1/sizes/xl"
  );
  await expect(shareImages.nth(1)).toHaveAttribute(
    "src",
    "/api/public/speakers/picture-speaker/media/revision/2/sizes/s"
  );
  await page.screenshot({
    path: "test-results/speaker-shareable-with-images.png",
  });
  expect(avatarRequests).toEqual([]);
});
