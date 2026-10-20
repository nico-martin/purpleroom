import { expect, test } from "@playwright/test";

const headers = { "X-Requested-With": "green-room" };

test("Shareable uses only published information, exposes crawler metadata, loads toolkit previews on demand, and regenerates from settings", async ({
  page,
  context,
}) => {
  const username = `sharing-${Date.now()}`;
  const auth = await (
    await context.request.post("/api/auth/request", {
      headers,
      data: { email: `${username}@example.com` },
    })
  ).json();
  expect(
    (
      await context.request.post("/api/auth/verify", {
        headers,
        data: { request_id: auth.request_id, code: auth.code },
      })
    ).ok()
  ).toBeTruthy();
  expect(
    (
      await context.request.patch("/api/me", {
        headers,
        data: { name: "Published Speaker", username },
      })
    ).ok()
  ).toBeTruthy();
  const draft = {
    tagline: "Published tagline",
    company: "",
    job_title: "",
    contact_email: "",
    bios: [],
    appearances: [],
  };
  expect(
    (await context.request.put("/api/speaker", { headers, data: draft })).ok()
  ).toBeTruthy();
  expect(
    (
      await context.request.put("/api/speaker/publication", {
        headers,
        data: { publish_all: true },
      })
    ).ok()
  ).toBeTruthy();
  const publicProfile = await (
    await context.request.get(`/api/public/speakers/${username}`)
  ).json();
  const sharing = publicProfile.sharing;
  const requests: string[] = [];
  await page.route("https://shareable.nico.dev/**", (route) => {
    requests.push(route.request().url());
    return requests.length === 1
      ? route.fulfill({ status: 503, body: "Unavailable" })
      : route.fulfill({
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAt8AAAAASUVORK5CYII=",
            "base64"
          ),
        });
  });
  await page.goto("/speaker");
  const preview = page.getByRole("region", { name: "Social sharing preview" });
  await expect(preview).toContainText("only your published name");
  expect(requests).toEqual([]);
  await preview.getByRole("button", { name: "Load sharing preview" }).click();
  await expect(preview.getByRole("alert")).toContainText(
    "Could not load the sharing preview"
  );
  await preview.getByRole("button", { name: "Load sharing preview" }).click();
  await expect(
    preview.getByRole("img", {
      name: "Published speaker profile sharing preview",
    })
  ).toBeVisible();
  expect(requests).toEqual([sharing.image_url, sharing.image_url]);

  expect(
    (
      await context.request.put("/api/speaker", {
        headers,
        data: { ...draft, tagline: "PRIVATE_DRAFT_NOT_SHARED" },
      })
    ).ok()
  ).toBeTruthy();
  expect(
    (
      await context.request.patch("/api/me", {
        headers,
        data: { name: "PRIVATE_ACCOUNT_NAME" },
      })
    ).ok()
  ).toBeTruthy();
  const htmlResponse = await context.request.get(`/u/${username}`);
  const html = await htmlResponse.text();
  expect(htmlResponse.headers()["cache-control"]).toBe("no-store");
  expect(html).toContain(
    '<meta property="og:title" content="Published Speaker — Speaker press kit">'
  );
  expect(html).toContain(sharing.image_url.replaceAll("&", "&amp;"));
  expect(html).not.toContain("PRIVATE_DRAFT_NOT_SHARED");
  expect(html).not.toContain("PRIVATE_ACCOUNT_NAME");
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(new URL(request.url()).pathname);
  });
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto(`/u/${username}#render-shareable`);
  const card = page.locator('[data-testid="speaker-share-card"]:visible');
  await expect(
    card.getByRole("heading", { name: "Published Speaker", exact: true })
  ).toBeVisible();
  await expect(card).toContainText("Published tagline");
  await expect(page.locator("template[data-shareable]")).toHaveCount(1);
  await expect(page.getByText("PRIVATE_DRAFT_NOT_SHARED")).toHaveCount(0);
  await expect(page.getByText("PRIVATE_ACCOUNT_NAME")).toHaveCount(0);
  expect(await card.boundingBox()).toMatchObject({
    x: 0,
    y: 0,
    width: 1200,
    height: 630,
  });
  expect(apiRequests.length).toBeGreaterThan(0);
  expect([...new Set(apiRequests)]).toEqual([
    `/api/public/speakers/${username}`,
  ]);
  expect(requests).toHaveLength(2);
  await page.screenshot({ path: "test-results/speaker-shareable-card.png" });
  await page.setViewportSize({ width: 1200, height: 600 });
  expect(await card.boundingBox()).toMatchObject({ width: 1200, height: 600 });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/settings/speaker");
  const settingsImage = page.getByRole("region", {
    name: "Social sharing image",
  });
  await expect(
    settingsImage.getByRole("img", {
      name: "Published speaker profile sharing image",
    })
  ).toBeVisible();
  expect(requests.slice(2)).toEqual([sharing.image_url]);
  await settingsImage.getByRole("button", { name: "Regenerate image" }).click();
  await expect.poll(() => requests.length).toBe(5);
  const rebuilt = requests.slice(3).map((url) => new URL(url));
  for (const [url, format] of [
    [sharing.image_url, null],
    [sharing.twitter_image_url, "twitter"],
  ] as const) {
    const match = rebuilt.find((r) => r.searchParams.get("format") === format);
    expect(match?.searchParams.get("rebuild")).toBe("true");
    expect(match?.searchParams.get("version")).toBe(
      new URL(url).searchParams.get("version")
    );
    expect(match?.searchParams.get("url")).toBe(sharing.profile_url);
  }
  await expect(
    settingsImage.getByRole("button", { name: "Regenerate image" })
  ).toBeEnabled();

  expect(
    (await context.request.delete("/api/speaker/publication", { headers })).ok()
  ).toBeTruthy();
  await page.goto(`/u/${username}`);
  await expect(
    page.getByText("Speaker profile not found.", { exact: true })
  ).toBeVisible();
  await expect(page.locator("template[data-shareable]")).toHaveCount(0);
  expect(
    await (await context.request.get(`/u/${username}`)).text()
  ).not.toContain('property="og:image"');
  await page.goto("/speaker");
  await expect(preview).toContainText(
    "Private drafts are never sent to Shareable."
  );
  await expect(
    preview.getByRole("button", { name: "Load sharing preview" })
  ).toHaveCount(0);
  await page.goto("/settings/speaker");
  await expect(
    page.getByRole("switch", { name: "Make my profile public" })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Social sharing image" })
  ).toHaveCount(0);
  expect(requests).toHaveLength(5);
});
