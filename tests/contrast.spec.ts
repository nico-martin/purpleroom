import { expect, test, type Locator } from "@playwright/test";

async function contrast(locator: Locator) {
  return locator.evaluate((element) => {
    const luminance = (color: string) => {
      const channels = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number);
      const linear = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const style = getComputedStyle(element);
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (
      (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05)
    );
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`purple controls and all initials avatars have readable text in ${theme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

    // Render the real shared components, including variants absent from login.
    await page.evaluate(async () => {
      const load = (path: string) => import(path);
      // Use Vite's versioned dependency URL so Link and MemoryRouter share context.
      const linkSource = await (
        await fetch("/src/theme/button/ButtonLink.tsx")
      ).text();
      const routerUrl = linkSource.match(
        /from "([^"]*react-router-dom[^"]*)"/
      )![1];
      const [React, ReactDOM, Router, Button, ButtonLink, Badge, Tag, Avatar] =
        await Promise.all([
          load("/node_modules/.vite/deps/react.js"),
          load("/node_modules/.vite/deps/react-dom_client.js"),
          load(routerUrl),
          load("/src/theme/button/Button.tsx"),
          load("/src/theme/button/ButtonLink.tsx"),
          load("/src/theme/badge/Badge.tsx"),
          load("/src/theme/badge/Tag.tsx"),
          load("/src/theme/identity/Avatar.tsx"),
        ]);
      const h = React.default.createElement;
      const fixture = document.createElement("div");
      fixture.id = "contrast-fixture";
      document.body.append(fixture);
      ReactDOM.default.createRoot(fixture).render(
        h(
          Router.MemoryRouter,
          null,
          h(Button.default, { variant: "primary" }, "Primary button"),
          h(
            ButtonLink.default,
            { variant: "primary", to: "/login" },
            "Primary link"
          ),
          h(Badge.default, { tone: "solid" }, "Solid badge"),
          h(Tag.default, { selected: true }, "Selected tag"),
          // These names cover all four nameColor() buckets.
          ...["A", "B", "C", "D"].map((name) =>
            h(Avatar.default, { name, key: name })
          )
        )
      );
    });

    const fixture = page.locator("#contrast-fixture");
    for (const text of [
      "Primary button",
      "Primary link",
      "Solid badge",
      "Selected tag",
    ]) {
      const control = fixture.getByText(text, { exact: true });
      await expect(control).toBeVisible();
      // Aim for AAA on solid purple; AA is the baseline for all avatar colours.
      expect(await contrast(control), text).toBeGreaterThanOrEqual(7);
      if (text.startsWith("Primary")) {
        const hoverBackground = await control.evaluate(() => {
          const probe = document.createElement("span");
          probe.style.color = "var(--color-green-deep)";
          document.body.append(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        });
        await control.hover();
        await expect(control).toHaveCSS("background-color", hoverBackground);
        expect(await contrast(control), `${text} hover`).toBeGreaterThanOrEqual(
          7
        );
        await page.mouse.move(0, 0);
      }
    }
    const backgrounds = new Set<string>();
    for (const name of ["A", "B", "C", "D"]) {
      const avatar = fixture.getByLabel(name, { exact: true });
      await expect(avatar).toBeVisible();
      expect(await contrast(avatar), `Avatar ${name}`).toBeGreaterThanOrEqual(
        4.5
      );
      backgrounds.add(
        await avatar.evaluate(
          (element) => getComputedStyle(element).backgroundColor
        )
      );
    }
    expect(backgrounds.size).toBe(4);
  });
}
