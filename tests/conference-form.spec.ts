import { expect, test } from "@playwright/test";

test("stored conference logos can be kept or removed without invalid URL fields or context", async ({ page }) => {
  const logo = "/api/conference-logos/77/jsnation-0123456789abcdef.png";
  const conference = {
    id: 77, name: "JSNation", website: "https://jsnation.com", logo_url: logo, tags: ["javascript", "accessibility"],
    description: "Keep this legacy description.", created_by: { id: 1, name: "Nico", avatar_url: null },
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null,
    review_count: 0, tag_counts: {}, next_edition: null, would_submit_again: { yes: 0, no: 0 },
    reviews: [], editions: [], comments: [],
  };
  const saved: Record<string, unknown>[] = [];
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: { id: 1, name: "Nico", email: "test@example.com", avatar_url: null, role: "admin", profile_complete: 1 } } }));
  await page.route("**/api/conference-logos/77/*.png", (route) => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAt8AAAAASUVORK5CYII=", "base64") }));
  await page.route("**/api/conferences/77", async (route) => {
    if (route.request().method() === "PATCH") saved.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ json: conference });
  });
  await page.goto("/conferences/77/edit");
  await expect(page.getByText("Stored with purpleroom", { exact: true })).toBeVisible();
  await expect(page.getByLabel("A little context")).toHaveCount(0);
  await expect(page.getByLabel("Replace logo from URL (optional)")).toHaveValue("");
  await expect(page.getByLabel("Conference tags", { exact:true })).toHaveValue("javascript, accessibility");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "JSNation", exact: true })).toBeVisible();
  expect(saved[0]).toEqual({ name: "JSNation", website: "https://jsnation.com", logo_url: logo, tags:["javascript","accessibility"] });
  expect(saved[0]).not.toHaveProperty("description");

  await page.goto("/conferences/77/edit");
  await page.getByRole("button", { name: "Remove logo", exact: true }).click();
  await page.getByLabel("Conference tags", { exact:true }).fill("");
  await expect(page.getByText("Stored with purpleroom", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "JSNation", exact: true })).toBeVisible();
  expect(saved[1].logo_url).toBe("");
  expect(saved[1].tags).toEqual([]);
});
