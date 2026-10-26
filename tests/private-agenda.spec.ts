import { expect, test } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";

const headers = { "X-Requested-With": "green-room" };
async function login(context: BrowserContext, email: string, name?: string) {
  const response = await context.request.post("/api/auth/request", {
    headers,
    data: { email },
  });
  const { request_id, code } = await response.json();
  expect(code).toMatch(/^[0-9]{6}$/);
  const verify = await context.request.post("/api/auth/verify", {
    headers,
    data: { request_id, code },
  });
  expect(verify.ok()).toBeTruthy();
  const { user } = await verify.json();
  if (name)
    expect(
      (await context.request.patch("/api/me", { headers, data: { name } })).ok()
    ).toBeTruthy();
  return user;
}

// Browser-local dates, like the calendar's default month; UTC dates drift a
// month near midnight at month boundaries outside UTC.
const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

test("private agenda shows statuses, overlap warnings, unknown dates and an empty state", async ({
  browser,
  baseURL,
}) => {
  const adminContext = await browser.newContext({ baseURL });
  const memberContext = await browser.newContext({ baseURL });
  const emptyContext = await browser.newContext({ baseURL });
  try {
    await login(adminContext, "ui-test@example.com");
    const unique = Date.now();
    await login(memberContext, `agenda-${unique}@example.com`, "Agenda Member");
    await login(emptyContext, `agenda-empty-${unique}@example.com`, "No Plans");
    const conference = await (
      await adminContext.request.post("/api/conferences", {
        headers,
        data: { name: `AgendaConf ${unique}` },
      })
    ).json();
    const editions: Record<string, { id: number }> = {};
    for (const [key, data] of Object.entries({
      // Inclusive boundary: "first" ends on the day "second" starts.
      first: {
        title: `Agenda First ${unique}`,
        starts_on: day(40),
        ends_on: day(42),
      },
      second: {
        title: `Agenda Second ${unique}`,
        starts_on: day(42),
        ends_on: day(43),
      },
      later: {
        title: `Agenda Later ${unique}`,
        starts_on: day(60),
        ends_on: day(61),
      },
      undated: { title: `Agenda Undated ${unique}` },
    })) {
      const response = await adminContext.request.post("/api/editions", {
        headers,
        data: { conference_id: conference.id, ...data },
      });
      expect(response.ok()).toBeTruthy();
      editions[key] = await response.json();
    }
    for (const [key, status] of [
      ["first", "going"],
      ["second", "maybe"],
      ["later", "going"],
      ["undated", "maybe"],
    ])
      expect(
        (
          await memberContext.request.put(
            `/api/editions/${editions[key].id}/attendance`,
            { headers, data: { status } }
          )
        ).ok()
      ).toBeTruthy();

    const page = await memberContext.newPage();
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "My agenda" })
      .click();
    await expect(page).toHaveURL(/\/agenda$/);

    // Calendar is the default view and opens on the browser's current month.
    const monthTitle = (month: string) =>
      new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${month}-01T00:00:00Z`));
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const viewToggle = page.getByRole("group", { name: "Agenda view" });
    await expect(
      viewToggle.getByRole("button", { name: "Calendar" })
    ).toHaveAttribute("aria-pressed", "true");
    const calendar = page.getByRole("region", { name: monthTitle(current) });
    await expect(
      calendar.getByRole("heading", { name: monthTitle(current) })
    ).toBeVisible();

    const monthHeading = page
      .getByRole("region")
      .filter({ has: page.getByRole("button", { name: "Next month" }) })
      .getByRole("heading", { level: 2 });
    const nextMonth = (month: string) => {
      const date = new Date(`${month}-01T00:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + 1);
      return date.toISOString().slice(0, 7);
    };
    let shownMonth = current;
    // Click forward one month at a time, waiting for each re-render before the next click.
    async function showMonth(month: string) {
      while (shownMonth < month) {
        await page.getByRole("button", { name: "Next month" }).click();
        shownMonth = nextMonth(shownMonth);
        await expect(monthHeading).toHaveText(monthTitle(shownMonth));
      }
      await expect(monthHeading).toHaveText(monthTitle(month));
    }
    const overlapMonth = day(42).slice(0, 7);
    await showMonth(overlapMonth);
    if (overlapMonth !== current)
      await expect(page).toHaveURL(new RegExp(`month=${overlapMonth}`));
    await expect(
      page.getByRole("link", {
        name: new RegExp(
          `^Agenda First ${unique}, Going, .*overlaps with Agenda Second ${unique}$`
        ),
      })
    ).toHaveAttribute("href", `/editions/${editions.first.id}`);
    await expect(
      page.getByRole("link", {
        name: new RegExp(
          `^Agenda Second ${unique}, Maybe \\(tentative\\), .*overlaps with Agenda First ${unique}$`
        ),
      })
    ).toHaveAttribute("href", `/editions/${editions.second.id}`);
    const overlapDay = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${day(42)}T00:00:00Z`));
    await expect(
      page.getByText(`${overlapDay}, overlapping plans`, { exact: true })
    ).toBeAttached();
    const undatedList = page.getByRole("list", { name: "Dates unknown" });
    await expect(
      undatedList.getByRole("link", { name: `Agenda Undated ${unique}` })
    ).toBeVisible();
    await expect(
      undatedList.getByText("Dates unknown, conflicts can't be checked")
    ).toBeVisible();
    await expect(
      undatedList.getByText("Maybe (tentative)", { exact: true })
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 720 });

    await showMonth(day(60).slice(0, 7));
    const laterBar = page.getByRole("link", {
      name: new RegExp(`^Agenda Later ${unique}, Going, `),
    });
    await expect(laterBar).toHaveAttribute(
      "href",
      `/editions/${editions.later.id}`
    );
    await expect(laterBar).not.toHaveAccessibleName(/overlaps with/);

    const shown = (await monthHeading.textContent()) ?? "";
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(monthHeading).not.toHaveText(shown);
    const previous = new Date(`${day(60).slice(0, 7)}-01T00:00:00Z`);
    previous.setUTCMonth(previous.getUTCMonth() - 1);
    const previousMonth = previous.toISOString().slice(0, 7);
    await expect(monthHeading).toHaveText(monthTitle(previousMonth));
    if (previousMonth === current) await expect(page).not.toHaveURL(/month=/);
    else await expect(page).toHaveURL(new RegExp(`month=${previousMonth}`));

    await viewToggle.getByRole("button", { name: "List" }).click();
    await expect(page).toHaveURL(/view=list/);
    const list = page.getByRole("list", { name: "My agenda" });
    // Rows are picked by server order, not by link name: an "Overlaps with"
    // link shares its name with the other row's title link.
    const [first, second, later, undated] = [0, 1, 2, 3].map((index) =>
      list.getByRole("listitem").nth(index)
    );
    await expect(list.getByRole("listitem")).toHaveCount(4);
    for (const [item, title] of [
      [first, "First"],
      [second, "Second"],
      [later, "Later"],
      [undated, "Undated"],
    ] as const)
      await expect(item.getByRole("link").first()).toHaveText(
        `Agenda ${title} ${unique}`
      );

    await expect(first.getByText("Going", { exact: true })).toBeVisible();
    await expect(
      second.getByText("Maybe (tentative)", { exact: true })
    ).toBeVisible();
    await expect(first.getByText(/Overlaps with/)).toBeVisible();
    await expect(
      first.getByRole("link", { name: `Agenda Second ${unique}` })
    ).toHaveAttribute("href", `/editions/${editions.second.id}`);
    await expect(
      second.getByRole("link", { name: `Agenda First ${unique}` })
    ).toHaveAttribute("href", `/editions/${editions.first.id}`);
    await expect(later.getByText(/Overlaps with/)).toHaveCount(0);
    await expect(
      undated.getByText("Dates unknown, conflicts can't be checked")
    ).toBeVisible();
    await expect(undated.getByText(/Overlaps with/)).toHaveCount(0);
    await expect(list.getByRole("listitem").last()).toContainText(
      `Agenda Undated ${unique}`
    );

    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);

    const emptyPage = await emptyContext.newPage();
    await emptyPage.goto("/agenda");
    await expect(
      emptyPage.getByRole("heading", { name: "Nothing on your agenda yet." })
    ).toBeVisible();
    await expect(emptyPage.getByText(`Agenda First ${unique}`)).toHaveCount(0);
  } finally {
    await adminContext.close();
    await memberContext.close();
    await emptyContext.close();
  }
});
