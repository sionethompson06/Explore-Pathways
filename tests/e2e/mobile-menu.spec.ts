import { test, expect } from "@playwright/test";

// A mobile-sized viewport only -- not the full devices["iPhone 13"]
// preset, which also forces `defaultBrowserType: "webkit"`. WebKit
// isn't installed in this sandbox (only the pre-installed Chromium
// this config's executablePath points at), so spreading that preset
// would make every test in this file fail to launch a browser at all.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.describe("mobile navigation", () => {
  test("the menu is closed by default, opens on tap, and its links are reachable", async ({
    page,
  }) => {
    await page.goto("/");

    // Scoped to <header> throughout: the footer independently renders
    // its own "How It Works" link (always present, any viewport), so
    // an unscoped query would count that too.
    const header = page.locator("header");
    const toggle = header.getByRole("button", { name: "Menu" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Closed: the panel's links must not be present in the DOM at all
    // (not just visually hidden), so assistive tech can't reach them.
    await expect(header.getByRole("link", { name: "How It Works", exact: true })).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(header.getByRole("button", { name: "Close menu" })).toBeVisible();

    const panelLink = header.getByRole("link", { name: "How It Works", exact: true });
    await expect(panelLink).toBeVisible();
    await panelLink.click();

    await expect(page).toHaveURL(/\/how-it-works$/);
  });

  test("Escape closes the open mobile menu", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    await header.getByRole("button", { name: "Menu" }).click();
    await expect(header.getByRole("link", { name: "How It Works", exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(header.getByRole("link", { name: "How It Works", exact: true })).toHaveCount(0);
  });

  test("the mobile menu's primary CTA reaches Discover", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    await header.getByRole("button", { name: "Menu" }).click();
    await header.getByRole("link", { name: "Find My Pathway", exact: true }).click();
    await expect(page).toHaveURL(/\/discover$/);
  });

  test("the four Education Pathways destinations are exposed directly in the mobile panel", async ({
    page,
  }) => {
    await page.goto("/");
    const header = page.locator("header");
    await header.getByRole("button", { name: "Menu" }).click();
    // Scoped to a <p>: the desktop dropdown's own trigger button (with
    // the same "Education Pathways" text) is still present in the DOM
    // at this viewport, just CSS-hidden, so an unscoped query is ambiguous.
    await expect(header.locator("p", { hasText: "Education Pathways" })).toBeVisible();
    for (const label of [
      "Student Athletes",
      "Flexible Learning",
      "Homeschool Support",
      "Academic Opportunities",
    ]) {
      await expect(header.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
  });
});
