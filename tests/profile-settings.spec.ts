import { expect, test } from "@playwright/test";

const linkFields = [
  ["Homepage", "homepage_url", "https://nico.example"],
  ["GitHub", "github_url", "https://github.com/nico"],
  ["LinkedIn", "linkedin_url", "https://www.linkedin.com/in/nico"],
  ["X", "x_url", "https://x.com/nico"],
  ["Bluesky", "bluesky_url", "https://bsky.app/profile/nico.example"],
  ["Instagram", "instagram_url", "https://www.instagram.com/nico"],
  ["YouTube", "youtube_url", "https://www.youtube.com/@nico"],
  ["Mastodon", "mastodon_url", "https://my-instance.example/@nico"],
] as const;

test("local profile images and all social links can be saved, replaced, viewed, and cleared", async ({
  page,
}) => {
  const originalAvatar = "/api/avatars/1/avatar-aaaaaaaaaaaaaaaa.png";
  const replacementAvatar = "/api/avatars/1/avatar-bbbbbbbbbbbbbbbb.png";
  const user: Record<string, unknown> = {
    id: 1,
    name: "Nico",
    email: "private@example.com",
    role: "member",
    profile_complete: 1,
    avatar_url: originalAvatar,
  };
  const writes: Record<string, unknown>[] = [];
  const remoteImageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://images.example/"))
      remoteImageRequests.push(request.url());
  });
  await page.route("**/api/avatars/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAt8AAAAASUVORK5CYII=",
        "base64"
      ),
    })
  );
  await page.route("**/api/me", async (route) => {
    if (route.request().method() === "PATCH") {
      const data = route.request().postDataJSON() as Record<string, unknown>;
      writes.push(data);
      Object.assign(user, data);
      if (data.avatar_url === "https://images.example/new-avatar.png")
        user.avatar_url = replacementAvatar;
    }
    await route.fulfill({ json: { user } });
  });
  await page.route("**/api/users/1", (route) =>
    route.fulfill({ json: { user, relationship: "self", plans: [] } })
  );
  await page.goto("/settings");
  await expect(
    page.getByText("Stored with purpleroom", { exact: true })
  ).toBeVisible();
  const replace = page.getByLabel("Replace profile image from URL (optional)", {
    exact: true,
  });
  await expect(replace).toHaveValue("");
  for (const [label, , url] of linkFields)
    await page.getByLabel(label, { exact: true }).fill(url);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Looking good. Your profile is saved.")
  ).toBeVisible();
  expect(writes[0].avatar_url).toBe(originalAvatar);
  for (const [, field, url] of linkFields) expect(writes[0][field]).toBe(url);
  await replace.fill("https://images.example/new-avatar.png");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Stored with purpleroom", { exact: true })
  ).toBeVisible();
  await expect(
    page.locator(`img[src="${replacementAvatar}"]`).first()
  ).toBeVisible();
  expect(writes.at(-1)?.avatar_url).toBe(
    "https://images.example/new-avatar.png"
  );
  expect(remoteImageRequests).toEqual([]);
  await page.reload();
  await expect(page.getByLabel("GitHub", { exact: true })).toHaveValue(
    "https://github.com/nico"
  );
  await page.goto("/members/1");
  for (const [label, , url] of linkFields) {
    const link = page.getByRole("link", { name: label, exact: true });
    await expect(link).toHaveAttribute("href", url);
    await expect(link).toHaveAttribute("rel", "noreferrer me");
  }
  await expect(
    page.getByText("private@example.com", { exact: true })
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Remove profile image", exact: true })
    .click();
  await page.getByLabel("GitHub", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Looking good. Your profile is saved.")
  ).toBeVisible();
  expect(writes.at(-1)?.avatar_url).toBeNull();
  expect(writes.at(-1)?.github_url).toBeNull();
  expect(writes.at(-1)?.mastodon_url).toBe("https://my-instance.example/@nico");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: "test-results/profile-settings-mobile.png",
    fullPage: true,
  });
});

test("failed profile image imports keep settings editable and show the server error", async ({
  page,
}) => {
  const user = {
    id: 1,
    name: "Nico",
    avatar_url: null,
    role: "member",
    profile_complete: 1,
  };
  await page.route("**/api/me", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 422,
          json: {
            error: {
              code: "avatar_error",
              message: "The image could not be downloaded.",
            },
          },
        })
      : route.fulfill({ json: { user } })
  );
  await page.goto("/settings");
  await page
    .getByLabel("Avatar URL (optional)", { exact: true })
    .fill("https://images.example/missing.png");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("The image could not be downloaded.")
  ).toBeVisible();
  await expect(
    page.getByLabel("Avatar URL (optional)", { exact: true })
  ).toHaveValue("https://images.example/missing.png");
  await expect(
    page.getByText("Looking good. Your profile is saved.")
  ).toHaveCount(0);
});
