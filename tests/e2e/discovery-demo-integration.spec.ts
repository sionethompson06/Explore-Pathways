import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5.1 -- end-to-end interactive Discovery demo integration
 * (PHASE5_1_END_TO_END_DEMO_INTEGRATION.md sections 22-26/34). Unlike
 * tests/e2e/report-demo.spec.ts (the Golden fixture route,
 * /discover/report/demo), every test here starts cold at
 * /discover/demo and drives the actual questionnaire through the UI
 * so the resulting report is proven to come from the REAL Phase 4
 * engine + Phase 5 assembler acting on the answers just entered here
 * -- never a pre-built Golden fixture.
 *
 * The K-4 "more academic support" input path used throughout (2nd
 * grade / Traditional public school / More academic support / Right
 * on level + occasional check-ins / schedule flexibility not
 * important / Regular parent support) is the same stable path already
 * covered by discovery-demo.spec.ts's K-4 test -- it deterministically
 * produces a LIMITED_EXPLORATION-archetype report
 * (contentStatus LIMITED_INFORMATION), which is itself a real,
 * intentional Phase 4 outcome (never a fabricated recommendation),
 * confirmed identical every run since nothing here is random.
 */

const REPORT_HEADLINE = "You're still exploring—and that's a useful place to start.";
const INSIGHT_HEADLINE = "You don't need to know the answer before you start exploring.";
const R03_EMPTY_HEADING = "We're not forcing a recommendation yet";
const R06_PATHWAY_TITLE = "Your next pathway is clarity";
const R07_CONVERSION_HEADLINE = "You don't need to figure this out before asking for help.";
const DEMO_LABEL = "Interactive Discovery demo — answers are not saved";

async function fillStudentStage(page: Page, options: { gradeLabel: string; studentName?: string | undefined }) {
  await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
  if (options.studentName) {
    const nameField = page.getByRole("textbox", { name: /what should we call your student/i });
    await nameField.fill(options.studentName);
    await nameField.blur();
    // Lets the debounced autosave for the name field settle before the
    // next field's own state change, avoiding a race between the two.
    await page.waitForTimeout(400);
  }
  await page.getByRole("radio", { name: options.gradeLabel, exact: true }).check();
  await page.getByRole("combobox", { name: "State or territory" }).selectOption("UNKNOWN");
  await page.getByRole("radio", { name: "Traditional public school", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillGoalsStage(page: Page) {
  await expect(page.getByText("What brought you to Pathways?")).toBeVisible();
  await page.getByRole("checkbox", { name: "More academic support or help getting back on track", exact: true }).check();
  await page.getByRole("checkbox", { name: "Flexibility", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillLearningStage(page: Page) {
  await expect(page.getByText(/how is your student.s learning going now/i)).toBeVisible();
  await page.getByRole("radio", { name: "Right on level", exact: true }).check();
  await page.getByRole("radio", { name: "With occasional check-ins", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillScheduleStage(page: Page) {
  await expect(page.getByText("How much flexibility would be helpful?")).toBeVisible();
  await page.getByRole("radio", { name: "Not important -- our schedule already works well", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillFamilyStageAndReachReview(page: Page) {
  await expect(page.getByText("What role would you ideally like to have in your student's day-to-day learning?")).toBeVisible();
  await page.getByRole("radio", { name: "Regular support", exact: true }).check();
  await page.getByRole("button", { name: /See My Personalized Discovery Report|Continue/ }).click();
}

/** Drives the full stable K-4 input path from a cold /discover/demo load through to Review. */
async function completeToReview(page: Page, studentName?: string) {
  await page.goto("/discover/demo");
  await fillStudentStage(page, { gradeLabel: "2nd grade", studentName });
  await fillGoalsStage(page);
  await fillLearningStage(page);
  await fillScheduleStage(page);
  await fillFamilyStageAndReachReview(page);
}

async function generateReport(page: Page) {
  await page.getByRole("button", { name: "See My Personalized Discovery Report" }).click();
}

function expectReportSectionsVisible(page: Page) {
  return {
    async assertAll() {
      // Hero (R01) -- excludes the page's own pre-existing visually-hidden
      // landmark H1 (the same pattern already used by the golden-fixture
      // demo route, see discovery-demo.spec.ts).
      const hero = page.locator("h1:not(#discovery-demo-heading)");
      await expect(hero).toHaveCount(1);
      await expect(hero).toHaveText(REPORT_HEADLINE);

      // What We Heard (R02).
      await expect(page.getByText("What stands out", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: INSIGHT_HEADLINE })).toBeVisible();

      // Directions Worth Exploring (R03) -- present (as its LIMITED_EXPLORATION empty-state variant) for this stable input.
      await expect(page.locator("#r03-heading")).toHaveText(R03_EMPTY_HEADING);

      // Support/opportunity map (R04) -- this stable input's clarify-topics variant.
      await expect(page.locator("#r04-heading")).toHaveText("Areas to clarify");

      // Preliminary pathway (R06).
      await expect(page.locator("#r06-heading")).toHaveText(R06_PATHWAY_TITLE);

      // Conversion (R07).
      await expect(page.locator("#r07-heading")).toHaveText(R07_CONVERSION_HEADLINE);
    },
  };
}

test.describe("Interactive Discovery demo -> real Phase 5 report (Phase 5.1 section 22)", () => {
  test("answering the questionnaire through the UI and generating the report renders the real, personalized Phase 5 report", async ({
    page,
  }) => {
    await completeToReview(page, "Alex");
    await generateReport(page);

    await expectReportSectionsVisible(page).assertAll();

    // Never the old dead-end completion screen.
    await expect(page.getByRole("heading", { name: "Discovery Demo Complete" })).toHaveCount(0);
    await expect(page.getByText("Discovery Demo Complete")).toHaveCount(0);

    // Never the Golden fixture selector -- these are two separate demos.
    await expect(page.getByRole("navigation", { name: "Golden report fixture selector" })).toHaveCount(0);
    await expect(page.getByText("Synthetic report demo")).toHaveCount(0);

    // The interactive demo's own subordinate, non-overwhelming notice.
    await expect(page.getByText(DEMO_LABEL)).toBeVisible();

    // Section 15: CTA safety -- consultationState stays UNCONFIGURED, so
    // the primary action is always the safe informational link, never an
    // operationally-live "Build My Student's Pathway" pretense.
    const cta = page.getByRole("link", { name: "See What Comes Next" }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/how-it-works");
    await expect(page.getByText("Build My Student's Pathway")).toHaveCount(0);

    // Honest demo boundary: no ranking/urgency language anywhere.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/best school|top match|ranked|score:|% fit/i);
  });

  test("the questionnaire's final Review CTA is reachable and operable by keyboard alone", async ({ page }) => {
    await completeToReview(page, "Alex");
    const cta = page.getByRole("button", { name: "See My Personalized Discovery Report" });
    await cta.focus();
    await expect(cta).toBeFocused();
    await page.keyboard.press("Enter");
    await expectReportSectionsVisible(page).assertAll();
  });

  test("no horizontal overflow at 375px once the report is showing", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await completeToReview(page, "Alex");
    await generateReport(page);
    await expect(page.locator("h1:not(#discovery-demo-heading)")).toBeVisible();
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasOverflow, "horizontal overflow on the interactive demo report at 375px").toBe(false);
  });
});

test.describe("Editing answers and regenerating reflects the updated answers, not a cached/fixture result (Phase 5.1 section 23)", () => {
  test("changing the student's name and regenerating produces a report with the new name, not the old one", async ({
    page,
  }) => {
    await completeToReview(page, "Alex");
    await generateReport(page);
    await expect(page.getByText("Alex's Discovery Report", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Review or Edit My Answers" }).click();
    await expect(page.getByRole("heading", { name: "Student" })).toBeVisible();
    await expect(page.getByText("Alex's Discovery Report")).toHaveCount(0);

    await page.getByRole("button", { name: "Edit Student" }).click();
    await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
    const nameField = page.getByRole("textbox", { name: /what should we call your student/i });
    await nameField.fill("Jordan");
    await nameField.blur();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Continue" }).click(); // Student -> Goals
    await page.getByRole("button", { name: "Continue" }).click(); // Goals (unchanged)
    await page.getByRole("button", { name: "Continue" }).click(); // Learning (unchanged)
    await page.getByRole("button", { name: "Continue" }).click(); // Schedule (unchanged)
    await page.getByRole("button", { name: "Continue" }).click(); // Family (unchanged) -> Review

    await generateReport(page);
    await expect(page.getByText("Jordan's Discovery Report", { exact: true })).toBeVisible();
    await expect(page.getByText("Alex's Discovery Report")).toHaveCount(0);
  });
});

test.describe("Start Demo Again clears everything and restarts (Phase 5.1 section 24)", () => {
  test("Start Demo Again from the generated report returns to the initial stage with no report or prior answers", async ({
    page,
  }) => {
    await completeToReview(page, "Alex");
    await generateReport(page);
    await expect(page.getByText("Alex's Discovery Report", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Start Demo Again" }).click();

    await expect(page.getByText("DEMO PREVIEW")).toBeVisible();
    await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
    await expect(page.getByRole("radio", { name: "2nd grade", exact: true })).not.toBeChecked();
    await expect(page.getByText("Alex's Discovery Report")).toHaveCount(0);
    await expect(page.locator("h1:not(#discovery-demo-heading)")).toHaveCount(0);
    await expect(page.getByText(DEMO_LABEL)).toHaveCount(0);
  });
});

test.describe("A page refresh restarts the demo even after a report has been generated (Phase 5.1 section 25)", () => {
  test("reloading after generating a report restarts the demo from scratch -- no answers or report persist", async ({
    page,
  }) => {
    await completeToReview(page, "Alex");
    await generateReport(page);
    await expect(page.getByText("Alex's Discovery Report", { exact: true })).toBeVisible();

    await page.reload();

    await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
    await expect(page.getByRole("radio", { name: "2nd grade", exact: true })).not.toBeChecked();
    await expect(page.getByText("Alex's Discovery Report")).toHaveCount(0);
    await expect(page.locator("h1:not(#discovery-demo-heading)")).toHaveCount(0);
  });
});

test.describe("No client-side persistence of interactive-demo answers, even once a report exists (Phase 5.1 section 26)", () => {
  test("localStorage/sessionStorage stay empty and no demo session cookie is set after generating a report", async ({
    page,
  }) => {
    const cookiesBefore = await page.context().cookies();

    await completeToReview(page, "Alex");
    await generateReport(page);
    await expect(page.getByText("Alex's Discovery Report", { exact: true })).toBeVisible();

    const storageCounts = await page.evaluate(() => ({
      local: window.localStorage.length,
      session: window.sessionStorage.length,
    }));
    expect(storageCounts.local).toBe(0);
    expect(storageCounts.session).toBe(0);

    const cookiesAfter = await page.context().cookies();
    expect(cookiesAfter.some((c) => c.name === "pathways_guest_session")).toBe(false);
    expect(cookiesAfter.some((c) => /demo/i.test(c.name))).toBe(false);
    // No new cookie of any kind was set by generating the report.
    expect(cookiesAfter.length).toBe(cookiesBefore.length);
  });
});
