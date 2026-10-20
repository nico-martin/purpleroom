import { expect, test } from "@playwright/test";

test("CFP deadlines, friend activity, and actions align across different submission states", async ({
  page,
}) => {
  const names = [
    "Voxxed Days Zürich 27",
    "Voxxed Days Ticino 27",
    "A conference edition with a longer title that wraps naturally",
  ];
  const openCfps = names.map((title, index) => ({
    conference: { id: index + 1, name: title, logo_url: null },
    edition: {
      id: index + 1,
      conference_id: index + 1,
      title,
      starts_on: "2027-03-09",
      ends_on: "2027-03-09",
      cfp_closes_on: "2026-10-23",
      city: "Zurich",
      country: "CH",
      online: 0,
    },
    days_left: index === 2 ? 10 : 3,
    submitters:
      index === 1 ? [{ id: 2, name: "Friend", avatar_url: null }] : [],
    my_submissions: index === 1 ? [] : [{ id: index + 1 }],
  }));
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 1,
          name: "Speaker",
          role: "member",
          profile_complete: 1,
          avatar_url: null,
        },
      },
    })
  );
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      json: { open_cfps: openCfps, upcoming: [], recent_activity: [] },
    })
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  const rows = names.map((name) =>
    page.getByRole("link", { name: new RegExp(name) }).locator("..")
  );
  const deadlineBoxes = await Promise.all(
    rows.map((row) =>
      row.getByText("closes 23 Oct", { exact: true }).boundingBox()
    )
  );
  const friendBoxes = await Promise.all(
    rows.map((row, index) =>
      row
        .getByText(
          index === 1 ? "1 friend submitted" : "No friends submitted yet",
          { exact: true }
        )
        .locator("..")
        .boundingBox()
    )
  );
  const actionBoxes = await Promise.all(
    rows.map((row) => row.getByRole("button").boundingBox())
  );
  for (const boxes of [deadlineBoxes, friendBoxes, actionBoxes]) {
    expect(
      boxes.every((box) => box !== null && Math.abs(box.x - boxes[0]!.x) < 1)
    ).toBe(true);
  }
  expect(
    actionBoxes.every(
      (box) => box !== null && Math.abs(box.width - actionBoxes[0]!.width) < 1
    )
  ).toBe(true);
  for (let index = 0; index < rows.length; index++) {
    const titleBox = await rows[index].getByRole("link").boundingBox();
    const actionBox = actionBoxes[index]!;
    expect(
      Math.abs(
        titleBox!.y + titleBox!.height / 2 - actionBox.y - actionBox.height / 2
      )
    ).toBeLessThan(1);
  }
  await page.screenshot({
    path: "test-results/cfp-columns-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    for (const row of rows) await expect(row.getByRole("button")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: "test-results/cfp-columns-mobile-dark.png",
    fullPage: true,
    animations: "disabled",
  });
});
