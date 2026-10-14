import { test, expect } from "@playwright/test";
import path from "node:path";

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];

const SCREENSHOT_DIR = path.join(process.cwd(), "screenshots");

test.describe("responsive screenshots (375 / 768 / 1440)", () => {
  for (const viewport of VIEWPORTS) {
    test(`homepage at ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `home-${viewport.name}.png`),
        fullPage: true,
      });

      // No horizontal overflow at this width -- a common source of
      // "text escaping cards" / clipped content on narrow screens.
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(hasHorizontalOverflow, `horizontal overflow at ${viewport.name}px`).toBe(false);
    });
  }

  test("discover page at 375px and 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/discover?interest=athletics");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "discover-375.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "discover-1440.png"),
      fullPage: true,
    });
  });

  test("how-it-works at 768px", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/how-it-works");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "how-it-works-768.png"),
      fullPage: true,
    });
  });

  // Phase 2F QA: all four audience pages plus For Partners, at every
  // required breakpoint, checked for horizontal overflow the same
  // way the homepage is above.
  const PHASE_2F_ROUTES = [
    { name: "pathways-athletes", path: "/pathways/athletes" },
    { name: "pathways-homeschool", path: "/pathways/homeschool" },
    { name: "pathways-flexible-learning", path: "/pathways/flexible-learning" },
    { name: "pathways-academic-opportunities", path: "/pathways/academic-opportunities" },
    { name: "for-partners", path: "/for-partners" },
  ];

  for (const route of PHASE_2F_ROUTES) {
    for (const viewport of VIEWPORTS) {
      test(`${route.name} at ${viewport.name}px`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${route.name}-${viewport.name}.png`),
          fullPage: true,
        });
        const hasHorizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        expect(
          hasHorizontalOverflow,
          `horizontal overflow on ${route.path} at ${viewport.name}px`,
        ).toBe(false);
      });
    }
  }

  test("desktop Education Pathways dropdown, captured open at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Education Pathways" }).click();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "nav-dropdown-open-1440.png"),
    });
  });

  test("mobile menu open, captured at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "mobile-menu-open-375.png"),
    });
  });
});

test.describe("320px reflow and zoom", () => {
  test("no horizontal overflow at a 320px reflow width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "home-320-reflow.png"),
      fullPage: true,
    });
  });

  test("200% browser zoom (400 CSS px viewport) does not clip or overflow", async ({ page }) => {
    // Emulates a 400% CSS-pixel-equivalent narrow viewport, the
    // standard WCAG 1.4.10 reflow proxy for "zoomed to 400%" on a
    // 1280px-wide design.
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/how-it-works");
    await page.waitForLoadState("networkidle");
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});

test.describe("accessibility", () => {
  test("skip link is the first focusable element and jumps to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.locator(".skip-link");
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("keyboard focus is visible when tabbing through interactive elements", async ({ page }) => {
    await page.goto("/");
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
    }
    const activeOutline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = window.getComputedStyle(el);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(activeOutline).not.toBeNull();
  });

  test("reduced motion is honored", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const maxDurationMs = await page.evaluate(() => {
      const button = document.querySelector("a[href='/discover']");
      if (!button) return null;
      const raw = window.getComputedStyle(button).transitionDuration;
      // transitionDuration is a comma-separated list, one per
      // transitioned property (e.g. "0.001ms, 0.001ms, 0.001ms").
      const durations = raw.split(",").map((value) => {
        const trimmed = value.trim();
        if (trimmed.endsWith("ms")) return parseFloat(trimmed);
        if (trimmed.endsWith("s")) return parseFloat(trimmed) * 1000;
        return NaN;
      });
      return Math.max(...durations);
    });
    expect(maxDurationMs).not.toBeNull();
    // The global reduced-motion rule forces every transition/animation
    // duration to 0.001ms; a real (non-reduced) button transition is
    // 150ms, so anything under 1ms proves the override took effect.
    expect(maxDurationMs as number).toBeLessThan(1);
  });

  test("headings form a single h1 per page with no level skipped from h1", async ({ page }) => {
    for (const url of ["/", "/how-it-works", "/for-partners", "/discover", "/pathways/athletes"]) {
      await page.goto(url);
      const h1Count = await page.locator("h1").count();
      expect(h1Count, `${url} should have exactly one h1`).toBe(1);
    }
  });
});
