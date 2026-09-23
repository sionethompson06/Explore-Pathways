import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 3D: after Continue/Back/Edit-from-Review, the new Discovery
 * stage must come back into view near the top of the questionnaire --
 * never leave the parent scrolled near the bottom of the PREVIOUS
 * stage. Covers both /discover/demo and the real /discover/profile,
 * since both use the same `useScrollStageAnchor` hook.
 */

async function fillStudentStage(page: Page, gradeLabel: string) {
  await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
  await page.getByRole("radio", { name: gradeLabel, exact: true }).check();
  await page.getByRole("combobox", { name: "State or territory" }).selectOption("UNKNOWN");
  await page.getByRole("radio", { name: "Traditional public school", exact: true }).check();
}

async function fillGoalsStage(page: Page, reason: string) {
  await expect(page.getByText("What brought you to Pathways?")).toBeVisible();
  await page.getByRole("checkbox", { name: reason, exact: true }).check();
  await page.getByRole("checkbox", { name: "Flexibility", exact: true }).check();
}

/** Simulates the parent having scrolled down to reach the Continue/Back button on a long stage. */
async function scrollToBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
}

/**
 * Polls (rather than a single fixed-delay read) since the scroll
 * itself animates -- asserts the eventual, settled position, not a
 * timing-dependent snapshot mid-animation.
 */
async function expectProgressNavNearTop(page: Page, headerLikelyMax = 220) {
  const nav = page.getByRole("navigation", { name: "Discovery progress" });
  await expect(async () => {
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(-2);
    expect(box!.y).toBeLessThan(headerLikelyMax);
  }).toPass({ timeout: 4000 });
}

test.describe("Preview Demo Mode: scroll/focus after stage navigation", () => {
  test("Continue from a long stage scrolls the new stage back into view", async ({ page }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "6th grade");
    await scrollToBottom(page);
    const beforeY = await page.evaluate(() => window.scrollY);

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("What brought you to Pathways?")).toBeVisible();

    await expectProgressNavNearTop(page);
    const afterY = await page.evaluate(() => window.scrollY);
    expect(afterY).toBeLessThan(beforeY);
  });

  test("Back scrolls the previous stage back into view", async ({ page }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "6th grade");
    await page.getByRole("button", { name: "Continue" }).click();
    await fillGoalsStage(page, "Athletics");
    await scrollToBottom(page);

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("What grade is your student currently in?")).toBeVisible();

    await expectProgressNavNearTop(page);
  });

  test("advancing into Review scrolls the Review content into view", async ({ page }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "2nd grade");
    await page.getByRole("button", { name: "Continue" }).click();
    await fillGoalsStage(page, "Academic support");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText(/which best describes how learning is going overall right now/i)).toBeVisible();
    await page.getByRole("radio", { name: "Right on level", exact: true }).check();
    await page.getByRole("radio", { name: "Does well with occasional check-ins", exact: true }).check();
    await scrollToBottom(page);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("How much schedule flexibility would be helpful for your family?")).toBeVisible();
    await page.getByRole("radio", { name: "Not important -- our schedule already works well", exact: true }).check();
    await scrollToBottom(page);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("What role would you ideally like to have in your student's day-to-day learning?")).toBeVisible();
    await page.getByRole("radio", { name: "Regular support", exact: true }).check();
    await scrollToBottom(page);
    await page.getByRole("button", { name: /Complete My Discovery Profile|Continue/ }).click();

    await expect(page.getByRole("heading", { name: "Student" })).toBeVisible();
    await expectProgressNavNearTop(page);
  });

  test("Edit from Review returns the edited section into view", async ({ page }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "6th grade");
    await page.getByRole("button", { name: "Continue" }).click();
    await fillGoalsStage(page, "Academic support");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/which best describes how learning is going overall right now/i)).toBeVisible();
    await page.getByRole("radio", { name: "Right on level", exact: true }).check();
    await page.getByRole("radio", { name: "Does well with occasional check-ins", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("How much schedule flexibility would be helpful for your family?")).toBeVisible();
    await page.getByRole("radio", { name: "Not important -- our schedule already works well", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("What role would you ideally like to have in your student's day-to-day learning?")).toBeVisible();
    await page.getByRole("radio", { name: "Regular support", exact: true }).check();
    await page.getByRole("button", { name: /Complete My Discovery Profile|Continue/ }).click();

    await expect(page.getByRole("heading", { name: "Student" })).toBeVisible();
    await scrollToBottom(page);
    await page.getByRole("button", { name: "Edit Student" }).click();

    await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
    await expectProgressNavNearTop(page);
  });

  test("Demo Complete and Start Demo Again both scroll to the beginning of their content", async ({
    page,
  }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "2nd grade");
    await page.getByRole("button", { name: "Continue" }).click();
    await fillGoalsStage(page, "Academic support");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/which best describes how learning is going overall right now/i)).toBeVisible();
    await page.getByRole("radio", { name: "Right on level", exact: true }).check();
    await page.getByRole("radio", { name: "Does well with occasional check-ins", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("How much schedule flexibility would be helpful for your family?")).toBeVisible();
    await page.getByRole("radio", { name: "Not important -- our schedule already works well", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("What role would you ideally like to have in your student's day-to-day learning?")).toBeVisible();
    await page.getByRole("radio", { name: "Regular support", exact: true }).check();
    await page.getByRole("button", { name: /Complete My Discovery Profile|Continue/ }).click();
    await expect(page.getByRole("heading", { name: "Student" })).toBeVisible();
    await scrollToBottom(page);
    await page.getByRole("button", { name: "Complete My Discovery Profile" }).click();

    const heading = page.getByRole("heading", { name: "Discovery Demo Complete" });
    await expect(heading).toBeVisible();
    await expect(async () => {
      const box = await heading.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(-2);
      expect(box!.y).toBeLessThan(300);
    }).toPass({ timeout: 4000 });

    await scrollToBottom(page);
    await page.getByRole("button", { name: "START DEMO AGAIN" }).click();
    await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
    await expectProgressNavNearTop(page);
  });
});

test.describe("Preview Demo Mode: mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test("Continue on a long stage still returns the new stage to the top at 375px", async ({ page }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "6th grade");
    await scrollToBottom(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("What brought you to Pathways?")).toBeVisible();
    await expectProgressNavNearTop(page);
  });
});

test.describe("Preview Demo Mode: reduced motion", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 1024, height: 900 } });

  test("Continue scrolls the new stage into view without relying on a smooth animation", async ({
    page,
  }) => {
    await page.goto("/discover/demo");
    // The dev-mode-only Next.js overlay portal can sit over the first
    // control at this viewport; force here bypasses that unrelated
    // dev-server artifact, not the scroll behavior under test.
    await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
    await page.getByRole("radio", { name: "6th grade", exact: true }).click({ force: true });
    await page.getByRole("combobox", { name: "State or territory" }).selectOption("UNKNOWN");
    await page.getByRole("radio", { name: "Traditional public school", exact: true }).click({ force: true });
    await scrollToBottom(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("What brought you to Pathways?")).toBeVisible();
    // With reduced motion, the scroll should already be settled almost
    // immediately -- a short, fixed wait here is asserting the absence
    // of a lingering animation, not standing in for the poll above.
    await page.waitForTimeout(150);
    const nav = page.getByRole("navigation", { name: "Discovery progress" });
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(-2);
    expect(box!.y).toBeLessThan(220);
  });
});

test.describe("Real Discovery (/discover/profile): equivalent scroll/focus behavior", () => {
  async function startDiscovery(page: Page) {
    await page.goto("/discover");
    await page.getByRole("button", { name: "Start My Discovery" }).click();
    await expect(page).toHaveURL(/\/discover\/profile/);
  }

  test("Continue scrolls the new stage back into view", async ({ page }) => {
    await startDiscovery(page);
    await fillStudentStage(page, "6th grade");
    await scrollToBottom(page);
    const beforeY = await page.evaluate(() => window.scrollY);

    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/stage=GOALS/);
    await expect(page.getByText("What brought you to Pathways?")).toBeVisible();

    await expectProgressNavNearTop(page);
    const afterY = await page.evaluate(() => window.scrollY);
    expect(afterY).toBeLessThan(beforeY);
  });

  test("Back scrolls the previous stage back into view", async ({ page }) => {
    await startDiscovery(page);
    await fillStudentStage(page, "6th grade");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/stage=GOALS/);
    await expect(page.getByText("What brought you to Pathways?")).toBeVisible();
    await scrollToBottom(page);

    await page.getByRole("button", { name: "Back" }).click();
    await page.waitForURL(/stage=STUDENT/);
    await expect(page.getByText("What grade is your student currently in?")).toBeVisible();

    await expectProgressNavNearTop(page);
  });
});
