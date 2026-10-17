import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40" onload="window.svgHandlerRan=true">
  <style>.brand { fill: #2f6b52; }</style><rect class="brand" width="120" height="40"/>
  <script>window.svgScriptRan=true</script>
  <image href="https://svg-security-test.invalid/external.png"/>
  <foreignObject><iframe xmlns="http://www.w3.org/1999/xhtml" src="https://svg-security-test.invalid/frame"/></foreignObject>
</svg>`;
const headers = {
  "Content-Type": "image/svg+xml",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
};

test("sanitized SVGs retain logo styling and load as images without active/external content", async ({ page }) => {
  const result = spawnSync("php", ["-r", "define('GREEN_ROOM', true); require 'api/lib/logos.php'; echo sanitize_svg_logo(stream_get_contents(STDIN));"], { input: svg, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).not.toContain("svg-security-test.invalid");
  expect(result.stdout).not.toContain("onload");
  expect(result.stdout).not.toContain("<script");
  const externalRequests: string[] = [];
  await page.route("https://svg-security-test.invalid/**", (route) => { externalRequests.push(route.request().url()); return route.abort(); });
  await page.route("**/test-sanitized-logo.svg", (route) => route.fulfill({ headers, body: result.stdout }));
  await page.goto("/login");
  await page.evaluate(async () => {
    const image = new Image(); image.alt = "Sanitized SVG logo"; image.src = "/test-sanitized-logo.svg";
    document.body.appendChild(image); await image.decode();
  });
  await expect(page.getByRole("img", { name: "Sanitized SVG logo" })).toHaveJSProperty("naturalWidth", 120);
  await page.goto("/test-sanitized-logo.svg");
  await expect(page.locator("rect")).toHaveCSS("fill", "rgb(47, 107, 82)");
  expect(externalRequests).toEqual([]);
});

test("SVG response CSP also blocks raw scripts, handlers, and external loads as a second layer", async ({ page }) => {
  const externalRequests: string[] = [];
  await page.route("https://svg-security-test.invalid/**", (route) => { externalRequests.push(route.request().url()); return route.abort(); });
  await page.route("**/test-raw-logo.svg", (route) => route.fulfill({ headers, body: svg }));
  await page.goto("/test-raw-logo.svg");
  await expect(page.locator("rect")).toHaveCSS("fill", "rgb(47, 107, 82)");
  const execution = await page.evaluate(() => ({
    script: Object.prototype.hasOwnProperty.call(window, "svgScriptRan"),
    handler: Object.prototype.hasOwnProperty.call(window, "svgHandlerRan"),
  }));
  expect(execution).toEqual({ script: false, handler: false });
  expect(externalRequests).toEqual([]);
});
