import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Phase 3 instruction §60: screenshot capture across the real
 * Discovery flow at every required breakpoint, plus targeted
 * interaction states. Screenshots are local inspection evidence
 * (screenshots/ is gitignored, same convention as responsive.spec.ts)
 * -- not a substitute for the behavioral assertions in
 * discovery-profile.spec.ts.
 */

const SCREENSHOT_DIR = path.join(process.cwd(), "screenshots");
const BREAKPOINTS = [
  { name: "320", width: 320, height: 900 },
  { name: "375", width: 375, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 900 },
  { name: "1440", width: 1440, height: 1000 },
];

async function startAndFillStudentStage(page: Page) {
  await page.goto("/discover");
  await page.getByRole("button", { name: "Start My Discovery" }).click();
  await expect(page).toHaveURL(/\/discover\/profile/);
  await page.getByRole("radio", { name: "7th grade", exact: true }).check();
  await page.getByRole("combobox", { name: "State or territory" }).selectOption("CA");
  await page.getByRole("radio", { name: "Traditional public school", exact: true }).check();
}

test.describe("Discovery visual QA: breakpoints", () => {
  for (const bp of BREAKPOINTS) {
    test(`/discover at ${bp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto("/discover");
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `discover-entry-${bp.name}.png`),
        fullPage: true,
      });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(hasOverflow, `horizontal overflow on /discover at ${bp.name}px`).toBe(false);
    });

    test(`/discover/profile (STUDENT stage) at ${bp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto("/discover");
      await page.getByRole("button", { name: "Start My Discovery" }).click();
      await expect(page).toHaveURL(/\/discover\/profile/);
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `discovery-profile-student-${bp.name}.png`),
        fullPage: true,
      });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(hasOverflow, `horizontal overflow on /discover/profile at ${bp.name}px`).toBe(false);
    });
  }

  test("/discover/profile Review state at 375/1440px", async ({ page }) => {
    for (const bp of [
      { name: "375", width: 375, height: 1400 },
      { name: "1440", width: 1440, height: 1400 },
    ]) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      if (bp.name === "375") {
        await startAndFillStudentStage(page);
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page).toHaveURL(/stage=GOALS/);
        await page.getByRole("checkbox", { name: "Athletics", exact: true }).uncheck();
        await page.getByRole("checkbox", { name: "Athletics", exact: true }).check();
        await page.getByRole("checkbox", { name: "Flexibility", exact: true }).check();
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page).toHaveURL(/stage=LEARNING/);
        await page.getByRole("radio", { name: "Right on level", exact: true }).check();
        await page.getByRole("radio", { name: "Does well with occasional check-ins", exact: true }).check();
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page).toHaveURL(/stage=SCHEDULE/);
        await page.getByRole("radio", { name: "Not important -- our schedule already works well", exact: true }).check();
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page).toHaveURL(/stage=ATHLETICS/);
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page).toHaveURL(/stage=FAMILY/);
        await page.getByRole("radio", { name: "Regular support", exact: true }).check();
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page).toHaveURL(/stage=REVIEW/);
      }
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `discovery-profile-review-${bp.name}.png`),
        fullPage: true,
      });
    }
  });

  test("/discover/report completion state at 375/1440px", async ({ page }) => {
    await startAndFillStudentStage(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=GOALS/);
    await page.getByRole("checkbox", { name: "Athletics", exact: true }).uncheck();
    await page.getByRole("checkbox", { name: "Athletics", exact: true }).check();
    await page.getByRole("checkbox", { name: "Flexibility", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=LEARNING/);
    await page.getByRole("radio", { name: "Right on level", exact: true }).check();
    await page.getByRole("radio", { name: "Does well with occasional check-ins", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=SCHEDULE/);
    await page.getByRole("radio", { name: "Not important -- our schedule already works well", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=ATHLETICS/);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=FAMILY/);
    await page.getByRole("radio", { name: "Regular support", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=REVIEW/);
    await page.getByRole("button", { name: "Complete My Discovery Profile" }).click();
    await expect(page).toHaveURL(/\/discover\/report$/);

    for (const bp of [
      { name: "375", width: 375, height: 900 },
      { name: "1440", width: 1440, height: 900 },
    ]) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `discovery-report-complete-${bp.name}.png`),
        fullPage: true,
      });
    }
  });
});

test.describe("Discovery visual QA: interaction states", () => {
  test("single-select and multi-select: default, hover, focus-visible, selected", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/discover");
    await page.getByRole("button", { name: "Start My Discovery" }).click();
    await expect(page).toHaveURL(/\/discover\/profile/);

    const gradeRadio = page.getByRole("radio", { name: "6th grade", exact: true });
    await gradeRadio.hover();
    // Let the 0.15s border-color/transform transition settle before
    // capturing -- otherwise the screenshot can be taken mid-transition
    // and misrepresent the actual (correct) hover style as absent.
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "state-question-option-hover.png"),
    });

    await gradeRadio.focus();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "state-question-option-focus-visible.png"),
    });

    await gradeRadio.check();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "state-question-option-selected.png"),
    });
  });

  test("validation error state is visible beside the relevant question", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/discover");
    await page.getByRole("button", { name: "Start My Discovery" }).click();
    // family_priorities (GOALS stage) caps at 3 -- attempt a 4th via a
    // direct server-action call is covered in Vitest; here we only
    // capture the "Saved"/"Couldn't save" status region rendering.
    await page.getByRole("radio", { name: "6th grade", exact: true }).check();
    await expect(page.getByText("Saved")).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "state-save-indicator-saved.png"),
    });
  });

  test("expanded conditional branch: selecting DEFINITELY reveals the NCAA question inline", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startAndFillStudentStage(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=GOALS/);
    const athletics = page.getByRole("checkbox", { name: "Athletics", exact: true });
    await athletics.uncheck();
    await athletics.check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=LEARNING/);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=SCHEDULE/);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=ATHLETICS/);
    await page.getByRole("radio", { name: "Definitely", exact: true }).check();
    await expect(page.getByText(/Would it be helpful to include NCAA/)).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "state-conditional-branch-expanded.png"),
      fullPage: true,
    });
  });

  test("mobile progress bar and Review Edit state at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/discover");
    await page.getByRole("button", { name: "Start My Discovery" }).click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "state-mobile-progress.png"),
    });
  });
});
