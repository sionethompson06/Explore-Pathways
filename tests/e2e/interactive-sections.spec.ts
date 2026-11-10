import { test, expect } from "@playwright/test";

/**
 * Phase 2E: the homepage sections that replaced Asset Pack 2's
 * flattened infographics with real interactive components. These
 * tests exercise the actual interaction, not just presence of markup.
 */

test.describe("Goal cards (What Are You Hoping to Make Possible?)", () => {
  test("keyboard focus reaches a card and Enter navigates to its destination", async ({ page }) => {
    await page.goto("/");
    const goalsSection = page.locator('section[aria-labelledby="goals-heading"]');
    const athleticsCard = goalsSection.getByRole("link", { name: /^More Time for Athletics/ });
    await athleticsCard.focus();
    await expect(athleticsCard).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/discover\?interest=athletics$/);
  });

  test("a category with no functional selector links plainly to /discover, never a fabricated answer", async ({
    page,
  }) => {
    await page.goto("/");
    const goalsSection = page.locator('section[aria-labelledby="goals-heading"]');
    const creditRecoveryCard = goalsSection.getByRole("link", { name: /^Credit Recovery/ });
    const href = await creditRecoveryCard.getAttribute("href");
    expect(href).toBe("/discover");
  });
});

test.describe("Expandable reason tiles (Why Families Explore a Different Path)", () => {
  test("clicking a tile expands its detail and toggles aria-expanded", async ({ page }) => {
    await page.goto("/");
    const tile = page.getByRole("button", { name: /Practice starts before school ends/ });
    await expect(tile).toHaveAttribute("aria-expanded", "false");
    await tile.click();
    await expect(tile).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/protect both training time and academic progress/)).toBeVisible();
    await tile.click();
    await expect(tile).toHaveAttribute("aria-expanded", "false");
  });

  test("tiles are operable by keyboard", async ({ page }) => {
    await page.goto("/");
    const tile = page.getByRole("button", { name: /My child is ready for more academic challenge/ });
    await tile.focus();
    await page.keyboard.press("Enter");
    await expect(tile).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("Discovery Report preview tabs", () => {
  test("clicking a different tab changes the visible panel and aria-selected", async ({ page }) => {
    await page.goto("/");
    const directionsTab = page.getByRole("tab", { name: /Directions Worth Exploring/ });
    const mattersTab = page.getByRole("tab", { name: /What Matters to Your Family/ });
    await expect(mattersTab).toHaveAttribute("aria-selected", "true");
    await directionsTab.click();
    await expect(directionsTab).toHaveAttribute("aria-selected", "true");
    await expect(mattersTab).toHaveAttribute("aria-selected", "false");
    await expect(page.getByRole("tabpanel", { name: /Directions Worth Exploring/ })).toBeVisible();
    await expect(page.getByText("Flexible Online Education")).toBeVisible();
  });

  test("arrow keys move focus and activate the adjacent tab", async ({ page }) => {
    await page.goto("/");
    const mattersTab = page.getByRole("tab", { name: /What Matters to Your Family/ });
    const directionsTab = page.getByRole("tab", { name: /Directions Worth Exploring/ });
    await mattersTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(directionsTab).toBeFocused();
    await expect(directionsTab).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Pathway process timeline", () => {
  test("clicking a step changes the active step and its detail", async ({ page }) => {
    await page.goto("/");
    const planStep = page.getByRole("button", { name: "Plan", exact: true });
    await planStep.click();
    await expect(planStep).toHaveAttribute("aria-expanded", "true");
    // Both the desktop panel and the mobile per-step panel render the
    // same text (CSS decides which is visible per breakpoint), so
    // scope to the desktop panel's id, which is what's visible at
    // this test's default (desktop) viewport.
    await expect(page.locator("#process-detail-plan")).toContainText(
      "Student Success Blueprint is a deeper, separately scoped engagement",
    );
  });

  test("steps are operable by keyboard", async ({ page }) => {
    await page.goto("/");
    const supportStep = page.getByRole("button", { name: "Support", exact: true });
    await supportStep.focus();
    await page.keyboard.press("Enter");
    await expect(supportStep).toHaveAttribute("aria-expanded", "true");
  });

  test("renders a vertical layout on mobile with no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    const discoverStep = page.getByRole("button", { name: "Discover" });
    await discoverStep.scrollIntoViewIfNeeded();
    await expect(discoverStep).toBeVisible();
  });
});

test.describe("Find Your Path in Minutes", () => {
  test("the primary CTA routes to /discover", async ({ page }) => {
    await page.goto("/");
    const findYourPathSection = page.locator('section[aria-labelledby="find-your-path-heading"]');
    await findYourPathSection.getByRole("link", { name: /Take the Pathway Assessment/ }).click();
    await expect(page).toHaveURL(/\/discover$/);
  });

  test("a reason chip with a real interest links to the correct allowlisted value", async ({ page }) => {
    await page.goto("/");
    const findYourPathSection = page.locator('section[aria-labelledby="find-your-path-heading"]');
    await findYourPathSection.getByRole("link", { name: "Get ahead academically" }).click();
    await expect(page).toHaveURL(/\/discover\?interest=academic_challenge$/);
  });

  test("a reason chip with no functional selector links plainly to /discover", async ({ page }) => {
    await page.goto("/");
    const findYourPathSection = page.locator('section[aria-labelledby="find-your-path-heading"]');
    const href = await findYourPathSection.getByRole("link", { name: "Credit recovery" }).getAttribute("href");
    expect(href).toBe("/discover");
  });
});
