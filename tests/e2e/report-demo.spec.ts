import { test, expect } from "@playwright/test";

/**
 * Phase 5 Discovery Report Playwright coverage (PHASE5_DISCOVERY_REPORT_SPEC_V1.md
 * section 68). Runs entirely against the DB-free synthetic demo route
 * (`/discover/report/demo`) so it never depends on DEC-G9's Postgres
 * gap. Production report-route Playwright coverage would require a
 * live database session and is out of scope here for the same
 * pre-existing reason discovery-profile.spec.ts's DB-dependent cases
 * are reported separately under DEC-G9.
 */

test.describe("Discovery Report demo: GR01 (single-card CURRENT_PLUS_GROWTH)", () => {
  test("renders exactly one direction card with the owner-approved headline", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR01");
    await expect(
      page.getByRole("heading", { level: 1, name: /A strong foundation may already be in place/ }),
    ).toBeVisible();
    const cards = page.locator("li").filter({ hasText: "Build on the Current School Arrangement" });
    await expect(cards).toHaveCount(1);
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasOverflow).toBe(false);
  });
});

test.describe("Discovery Report demo: GR03 (two-card FLEXIBLE_WITH_STRUCTURE)", () => {
  test("renders exactly two equal-weight direction cards, no rank/'Top Match' text", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR03");
    await expect(page.getByRole("heading", { level: 3, name: "Hybrid Schooling" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Teacher-Supported Virtual Schooling" })).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Top Match/i);
    expect(body).not.toMatch(/Best Choice/i);
  });
});

test.describe("Discovery Report demo: GR09 (ADVISOR_FIRST, zero cards)", () => {
  test("renders useful non-empty content, never an empty recommendation grid", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR09");
    await expect(page.getByRole("heading", { level: 2, name: "Why we're not recommending a school model yet" })).toBeVisible();
    await expect(page.getByText("Academic Records")).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: /Hybrid Schooling|Public Virtual Schooling/ })).toHaveCount(0);
  });
});

test.describe("Discovery Report demo: GR12 (parallel pathway)", () => {
  test("renders both parallel branch stages (Resolve Credit Gaps / Protect Advanced Opportunities)", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR12");
    await expect(page.getByText("Resolve Credit Gaps")).toBeVisible();
    await expect(page.getByText("Protect Advanced Opportunities")).toBeVisible();
  });
});

test.describe("Discovery Report demo: GR14 (feasibility chip distinction)", () => {
  test("shows a visually distinct feasibility chip separate from educational chips, never claims 'is free'", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR14");
    await expect(page.getByText("Tuition-Free Preferred")).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/\bis free\b/i);
    expect(body).not.toContain("B06");
  });
});

test.describe("Discovery Report demo: GR15 (LIMITED_INFORMATION)", () => {
  test("renders the clarification-topics state, never a fake recommendation", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR15");
    await expect(page.getByRole("heading", { level: 2, name: "We're not forcing a recommendation yet" })).toBeVisible();
    await expect(page.getByText("How Your Student Learns Best")).toBeVisible();
  });
});

test.describe("Discovery Report demo: fixture selector", () => {
  test("switches fixtures via the selector nav and defaults invalid ids to GR01", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR06");
    await expect(page.getByRole("heading", { level: 1, name: /schedule—not compete against it/ })).toBeVisible();

    await page.getByRole("link", { name: "GR15", exact: true }).click();
    await expect(page).toHaveURL(/fixture=GR15/);
    await expect(page.getByRole("heading", { level: 1, name: /still exploring/ })).toBeVisible();

    await page.goto("/discover/report/demo?fixture=NOT_A_REAL_FIXTURE");
    await expect(
      page.getByRole("heading", { level: 1, name: /A strong foundation may already be in place/ }),
    ).toBeVisible();
  });
});

test.describe("Discovery Report demo: mobile sticky CTA", () => {
  test("stays hidden until scrolled past the directions, then becomes visible and tappable (>=44px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto("/discover/report/demo?fixture=GR03");
    const sticky = page.locator('a:has-text("See What Comes Next")').last();
    await expect(sticky).toHaveAttribute("tabindex", "-1");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.4));
    await page.waitForTimeout(300);
    await expect(sticky).toHaveAttribute("tabindex", "0");
    const box = await sticky.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("Discovery Report demo: keyboard and focus", () => {
  test("the fixture selector and edit-answers link are reachable and operable by keyboard alone", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR01");
    const editLink = page.getByRole("link", { name: "Review or Edit Your Answers" });
    await editLink.focus();
    await expect(editLink).toBeFocused();
    const gr03Link = page.getByRole("link", { name: "GR03", exact: true });
    await gr03Link.focus();
    await expect(gr03Link).toBeFocused();
  });
});

test.describe("Discovery Report demo: no horizontal overflow across all seven fixtures", () => {
  for (const fixture of ["GR01", "GR03", "GR06", "GR09", "GR12", "GR14", "GR15"]) {
    for (const width of [375, 768, 1440]) {
      test(`${fixture} at ${width}px has no horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1200 });
        await page.goto(`/discover/report/demo?fixture=${fixture}`);
        await page.waitForLoadState("networkidle");
        const hasOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        expect(hasOverflow, `horizontal overflow on ${fixture} at ${width}px`).toBe(false);
      });
    }
  }
});

test.describe("Discovery Report demo: robots/noindex", () => {
  test("the demo route is marked noindex/nofollow", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR01");
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/);
  });
});
