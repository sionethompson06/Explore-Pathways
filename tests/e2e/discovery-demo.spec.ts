import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 3C end-to-end coverage for Preview Demo Mode (/discover/demo).
 * Unlike tests/e2e/discovery-profile.spec.ts, nothing here ever
 * touches a real Discovery session/cookie/draft -- every test starts
 * cold at /discover/demo, and each proves some part of the "database-
 * free, in-memory only" contract alongside the actual questionnaire
 * flow.
 */

async function fillStudentStage(page: Page, gradeLabel: string) {
  await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
  await page.getByRole("radio", { name: gradeLabel, exact: true }).check();
  await page.getByRole("combobox", { name: "State or territory" }).selectOption("UNKNOWN");
  await page.getByRole("radio", { name: "Traditional public school", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillGoalsStage(page: Page, reason: string) {
  await expect(page.getByText("What brought you to Pathways?")).toBeVisible();
  await page.getByRole("checkbox", { name: reason, exact: true }).check();
  await page.getByRole("checkbox", { name: "Flexibility", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillLearningStage(page: Page) {
  await expect(page.getByText(/which best describes how learning is going overall right now/i)).toBeVisible();
  await page.getByRole("radio", { name: "Right on level", exact: true }).check();
  await page.getByRole("radio", { name: "Does well with occasional check-ins", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillScheduleStage(
  page: Page,
  flexibility: "Not important -- our schedule already works well" | "Essential for our family" = "Not important -- our schedule already works well",
) {
  await expect(page.getByText("How much schedule flexibility would be helpful for your family?")).toBeVisible();
  await page.getByRole("radio", { name: flexibility, exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillFamilyStage(page: Page) {
  await expect(page.getByText("What role would you ideally like to have in your student's day-to-day learning?")).toBeVisible();
  await page.getByRole("radio", { name: "Regular support", exact: true }).check();
  await page.getByRole("button", { name: /Complete My Discovery Profile|Continue/ }).click();
}

test.describe("Preview Demo Mode: route + isolation guarantees", () => {
  test("loads without a real Discovery session and shows the demo notice", async ({ page }) => {
    await page.goto("/discover/demo");
    await expect(page.getByText("DEMO PREVIEW")).toBeVisible();
    await expect(
      page.getByText(
        "Use sample information only. This preview lets you experience the Pathways Discovery questionnaire, but your answers are not saved.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Refreshing this page will restart the demo.")).toBeVisible();

    // No real Discovery session was created for this visit.
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name === "pathways_guest_session")).toBe(false);
  });

  test("never writes to localStorage or sessionStorage while answering", async ({ page }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "6th grade");
    await fillGoalsStage(page, "Academic support");

    const storageCounts = await page.evaluate(() => ({
      local: window.localStorage.length,
      session: window.sessionStorage.length,
    }));
    expect(storageCounts.local).toBe(0);
    expect(storageCounts.session).toBe(0);
  });

  test("never carries an answer in the URL -- the page URL never changes while answering", async ({
    page,
  }) => {
    await page.goto("/discover/demo");
    const urlBefore = page.url();
    await fillStudentStage(page, "6th grade");
    await fillGoalsStage(page, "Academic support");
    expect(page.url()).toBe(urlBefore);
  });

  test("a page refresh restarts the demo -- nothing carries over", async ({ page }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "6th grade");
    await expect(page.getByText("What brought you to Pathways?")).toBeVisible();

    await page.reload();
    await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
    const grade6 = page.getByRole("radio", { name: "6th grade", exact: true });
    await expect(grade6).not.toBeChecked();
  });
});

test.describe("Preview Demo Mode: K-4 sample profile", () => {
  test("completes the demo with an elementary profile -- no athletics/NCAA/graduation questions ever appear", async ({
    page,
  }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "2nd grade");
    await fillGoalsStage(page, "Academic support");
    await fillLearningStage(page);
    await fillScheduleStage(page);
    await fillFamilyStage(page);

    await expect(page.getByRole("heading", { name: "Student" })).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Is competing in college something your student may want to explore in the future?");
    expect(bodyText).not.toContain("is your student on track for graduation?");

    await page.getByRole("button", { name: "Complete My Discovery Profile" }).click();
    await expect(page.getByRole("heading", { name: "Discovery Demo Complete" })).toBeVisible();
    await expect(
      page.getByText(
        "You've reached the end of the current Pathways Discovery experience. In the live system, these answers will be securely saved and used to prepare the next stage of your Pathways Discovery.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "REVIEW MY ANSWERS" })).toBeVisible();
    await expect(page.getByRole("button", { name: "START DEMO AGAIN" })).toBeVisible();
    await expect(page.getByRole("link", { name: "RETURN TO PATHWAYS" })).toBeVisible();

    // Honest demo boundary: no recommendation/ranking language anywhere.
    expect(bodyText).not.toMatch(/best school|top match|ranked|score:|% fit/i);
  });
});

test.describe("Preview Demo Mode: middle-school athlete sample profile", () => {
  test("shows the athletics branch and the NCAA follow-up only after a DEFINITELY/POSSIBLY answer, through to completion", async ({
    page,
  }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "7th grade");
    await fillGoalsStage(page, "Athletics");
    await fillLearningStage(page);
    await fillScheduleStage(page);

    await expect(page.getByText("What sport or athletic activity is your student most involved in?")).toBeVisible();
    await page.getByRole("textbox").first().fill("Soccer");
    await expect(page.getByText("Is competing in college something your student may want to explore in the future?")).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain("How much do you know about NCAA");

    await page.getByRole("radio", { name: "Definitely", exact: true }).check();
    await expect(page.getByText(/NCAA/i).first()).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await fillFamilyStage(page);
    await expect(page.getByRole("heading", { name: "Athletics" })).toBeVisible();

    await page.getByRole("button", { name: "Complete My Discovery Profile" }).click();
    await expect(page.getByRole("heading", { name: "Discovery Demo Complete" })).toBeVisible();
  });
});

test.describe("Preview Demo Mode: high-school sample profile", () => {
  test("shows graduation status and the credit-recovery branch, through Review/Edit, to completion", async ({
    page,
  }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "10th grade");
    await fillGoalsStage(page, "Academic support");
    await fillLearningStage(page);
    await fillScheduleStage(page);

    await expect(page.getByText("How clear does your student's path to graduation feel right now?")).toBeVisible();
    const graduationGroup = page.getByRole("group", { name: /how clear does your student.s path to graduation feel/i });
    await graduationGroup.getByLabel("We may need help getting back on track", { exact: true }).check();
    await expect(page.getByText("Would reviewing or recovering credits be helpful as part of the plan?")).toBeVisible();
    const creditGroup = page.getByRole("group", { name: /reviewing or recovering credits/i });
    await creditGroup.getByLabel("Yes", { exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();

    await fillFamilyStage(page);

    // Review, then Edit the Student section, change the grade, confirm the HS-only
    // questions disappear once the branch closes (hidden answers are not deleted, just no longer effective).
    await expect(page.getByRole("heading", { name: "Planning" })).toBeVisible();
    await page.getByRole("button", { name: "Edit Student" }).click();
    await page.getByRole("radio", { name: "4th grade", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click(); // Goals (unchanged)
    await page.getByRole("button", { name: "Continue" }).click(); // Learning (unchanged)
    await page.getByRole("button", { name: "Continue" }).click(); // Schedule (unchanged)

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Would reviewing or recovering credits be helpful as part of the plan?");
  });
});
