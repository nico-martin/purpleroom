import { expect, test } from "@playwright/test";

test("talk cards show three per desktop row, current status counts, and editable submissions", async ({
  page,
}) => {
  const statuses = [
    "interested",
    "submitted",
    "submitted",
    "accepted",
    "accepted",
    "rejected",
    "waitlisted",
    "confirmed",
    "declined",
    "attended",
  ];
  const papers = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    owner_id: 1,
    title:
      index === 0
        ? "A talk with a long life"
        : index === 1
          ? "An idea looking for its first stage"
          : `Talk ${index + 1}`,
    abstract: null,
    notes: null,
    duration_minutes: null,
    audience_level: null,
    language: null,
    format: null,
    abstract_variants: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    submissions: (index === 0
      ? statuses
      : index === 1
        ? []
        : ["submitted"]
    ).map((status, submissionIndex) => ({
      id: index * 100 + submissionIndex + 1,
      paper_id: index + 1,
      edition_id: submissionIndex + 1,
      status,
      abstract_override: null,
      hide_title: 0,
      submitted_on: null,
      updated_at: "2026-05-01T00:00:00Z",
      edition: {
        id: submissionIndex + 1,
        title: `Conference ${submissionIndex + 1}`,
        deleted_at: submissionIndex === 9 ? "2026-05-01T00:00:00Z" : null,
      },
      conference: { id: 1, name: "Conference", deleted_at: null },
    })),
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
  await page.route("**/api/papers", (route) => route.fulfill({ json: papers }));
  await page.route("**/api/submissions?unassigned=1", (route) =>
    route.fulfill({
      json: [
        {
          id: 900,
          paper_id: null,
          edition_id: 900,
          status: "interested",
          submitted_on: null,
          notes: null,
          edition: { id: 900, title: "Future Product Days", deleted_at: null },
          conference: {
            id: 900,
            name: "Future Product Days",
            deleted_at: null,
          },
        },
      ],
    })
  );
  await page.route("**/api/submissions/2", async (route) => {
    papers[0].submissions[1].status = route.request().postDataJSON().status;
    await route.fulfill({ json: papers[0].submissions[1] });
  });
  await page.goto("/talks");
  await expect(
    page
      .getByRole("region", { name: "Talk library", exact: true })
      .getByRole("heading", { name: /^Talk library/ })
  ).toBeVisible();
  const grid = page.getByRole("list", { name: "My talks", exact: true });
  const opportunitySection = page.getByRole("region", {
    name: "Speaking opportunities",
    exact: true,
  });
  const librarySection = page.getByRole("region", {
    name: "Talk library",
    exact: true,
  });
  await expect(
    opportunitySection.getByRole("link", {
      name: "Future Product Days",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    librarySection.getByRole("link", {
      name: "Future Product Days",
      exact: true,
    })
  ).toHaveCount(0);
  await expect(
    opportunitySection.getByRole("list", { name: "My talks", exact: true })
  ).toHaveCount(0);
  const opportunityBox = await opportunitySection.boundingBox();
  const libraryBox = await librarySection.boundingBox();
  expect(libraryBox!.y).toBeGreaterThan(
    opportunityBox!.y + opportunityBox!.height
  );
  const cards = grid.getByRole("listitem");
  await expect(cards).toHaveCount(7);
  const boxes = await Promise.all(
    [0, 1, 2, 3].map((index) => cards.nth(index).boundingBox())
  );
  expect(boxes.slice(0, 3).every((box) => box?.y === boxes[0]?.y)).toBe(true);
  expect(boxes[3]!.y).toBeGreaterThan(boxes[0]!.y);
  const first = cards.nth(0);
  expect(
    await first.locator("dl > div").evaluateAll((groups) =>
      groups.every((group) => {
        const label = group.querySelector("dt")!.getBoundingClientRect();
        const count = group.querySelector("dd")!.getBoundingClientRect();
        return count.left >= label.right && count.left - label.right <= 12;
      })
    )
  ).toBe(true);
  await expect(
    first.getByRole("link", { name: "A talk with a long life", exact: true })
  ).toHaveAttribute("href", "/talks/1");
  await expect(first.getByText("10", { exact: true })).toBeVisible();
  await expect(
    first.getByRole("img", {
      name: "Current submission statuses: Interested 1, Submitted 2, Accepted 2, Rejected 1, Waitlisted 1, Confirmed 1, Declined 1, Attended (legacy) 1",
      exact: true,
    })
  ).toBeVisible();
  await expect(first.locator("dl dd")).toHaveText([
    "1",
    "2",
    "2",
    "1",
    "1",
    "1",
    "1",
    "1",
  ]);
  const empty = cards.nth(1);
  await expect(empty.getByText("0", { exact: true })).toBeVisible();
  await expect(empty.getByRole("img")).toHaveCount(0);
  await expect(
    empty.getByRole("link", { name: "Find a stage", exact: true })
  ).toHaveAttribute("href", "/");
  await expect(
    cards.nth(2).getByText("submission", { exact: true })
  ).toBeVisible();
  await first
    .getByRole("button", {
      name: "Expand submissions for A talk with a long life",
      exact: true,
    })
    .click();
  await expect(first.getByText("Archived", { exact: true })).toBeVisible();
  await first
    .getByRole("combobox", { name: "Status for Conference 2", exact: true })
    .selectOption("confirmed");
  await expect(
    first.getByRole("img", {
      name: /Current submission statuses: Interested 1, Submitted 1, Accepted 2, Rejected 1, Waitlisted 1, Confirmed 2/,
    })
  ).toBeVisible();
  await first
    .getByRole("button", {
      name: "Collapse submissions for A talk with a long life",
      exact: true,
    })
    .click();
  await page.screenshot({
    path: "test-results/talk-cards-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await Promise.all(
    [0, 1].map((index) => cards.nth(index).boundingBox())
  );
  expect(mobile[1]!.y).toBeGreaterThan(mobile[0]!.y);
  await first
    .getByRole("button", {
      name: "Expand submissions for A talk with a long life",
      exact: true,
    })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "test-results/talk-cards-mobile-dark.png",
    fullPage: true,
  });
});
