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
  await expect(page.getByText(/how is your student.s learning going now/i)).toBeVisible();
  await page.getByRole("radio", { name: "Right on level", exact: true }).check();
  await page.getByRole("radio", { name: "With occasional check-ins", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillScheduleStage(
  page: Page,
  flexibility: "Not important -- our schedule already works well" | "Essential for our family" = "Not important -- our schedule already works well",
) {
  await expect(page.getByText("How much flexibility would be helpful?")).toBeVisible();
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
    await fillGoalsStage(page, "More academic support or help getting back on track");

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
    await fillGoalsStage(page, "More academic support or help getting back on track");
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
    await fillGoalsStage(page, "More academic support or help getting back on track");
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
    await fillGoalsStage(page, "More time for athletics");
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
    await fillGoalsStage(page, "More academic support or help getting back on track");
    await fillLearningStage(page);
    await fillScheduleStage(page);

    await expect(page.getByText("How clear is your student's path to graduation?")).toBeVisible();
    const graduationGroup = page.getByRole("group", { name: /how clear is your student.s path to graduation/i });
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

test.describe("Preview Demo Mode: Learning section order (Phase 3F)", () => {
  test("\"How does your student learn best?\" (DISC_012) appears before \"How does your student work best?\" (DISC_011)", async ({
    page,
  }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "6th grade");
    await fillGoalsStage(page, "More academic support or help getting back on track");

    await expect(page.getByText("How is your student's learning going now?")).toBeVisible();
    const learnBestY = await page.getByText("How does your student learn best?").boundingBox();
    const workBestY = await page.getByText("How does your student work best?").boundingBox();
    expect(learnBestY).not.toBeNull();
    expect(workBestY).not.toBeNull();
    expect(learnBestY!.y).toBeLessThan(workBestY!.y);

    // A self-paced learner still sees the work-best follow-up (never hidden).
    await page.getByRole("checkbox", { name: "Self-paced", exact: true }).check();
    await expect(page.getByText("How does your student work best?")).toBeVisible();
  });
});

test.describe("Preview Demo Mode: inline \"Other\" free text (Phase 3F, required-before-Continue since Phase 3F.1)", () => {
  test("selecting Other reveals a text box; blank text blocks Continue with an inline error; filling it in allows Continue; Review shows it; unchecking Other clears and hides it", async ({
    page,
  }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "6th grade");

    await expect(page.getByText("What brought you to Pathways?")).toBeVisible();
    await page.getByRole("checkbox", { name: "Something else", exact: true }).check();
    const otherInput = page.getByLabel("Please describe", { exact: true });
    await expect(otherInput).toBeVisible();
    await page.getByRole("checkbox", { name: "Flexibility", exact: true }).check();

    // Blank Other text blocks Continue itself, with a clear, field-specific
    // inline error next to the Other input -- not only at final Submit.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/please add a short description for "other"/i)).toBeVisible();
    await expect(page.getByText("What brought you to Pathways?", { exact: true })).toBeVisible();

    // Whitespace-only text is treated as blank and still blocks Continue.
    await otherInput.fill("   ");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/please add a short description for "other"/i)).toBeVisible();
    await expect(page.getByText("What brought you to Pathways?", { exact: true })).toBeVisible();

    // Valid text allows Continue.
    await otherInput.fill("We split time between two homes.");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/how is your student.s learning going now/i)).toBeVisible();

    await fillLearningStage(page);
    await fillScheduleStage(page);
    await fillFamilyStage(page);

    await expect(page.getByRole("heading", { name: "Student" })).toBeVisible();
    await expect(page.getByText(/Something else.*Other:.*We split time between two homes\./)).toBeVisible();

    // Review/Edit still round-trips the valid text correctly.
    await page.getByRole("button", { name: "Edit Goals" }).click();
    await expect(page.getByLabel("Please describe", { exact: true })).toHaveValue(
      "We split time between two homes.",
    );
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click(); // Learning (unchanged)
    await page.getByRole("button", { name: "Continue" }).click(); // Schedule (unchanged)
    await page.getByRole("button", { name: "Continue" }).click(); // Family (unchanged)
    await page.getByRole("button", { name: "Complete My Discovery Profile" }).click();
    await expect(page.getByRole("heading", { name: "Discovery Demo Complete" })).toBeVisible();

    // Unchecking Other removes it from Review's line entirely.
    await page.getByRole("button", { name: "REVIEW MY ANSWERS" }).click();
    await page.getByRole("button", { name: "Edit Goals" }).click();
    await page.getByRole("checkbox", { name: "Something else", exact: true }).uncheck();
    await expect(page.getByLabel("Please describe", { exact: true })).toHaveCount(0);
    await page.getByRole("checkbox", { name: "More academic support or help getting back on track", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("We split time between two homes.");

    await page.getByRole("button", { name: "Complete My Discovery Profile" }).click();
    await expect(page.getByRole("heading", { name: "Discovery Demo Complete" })).toBeVisible();
  });

  test("the same required-before-Continue rule applies to a second Other-sidecar field (reported_support_needs), proving the behavior is shared, not DISC_006-only", async ({
    page,
  }) => {
    await page.goto("/discover/demo");
    await fillStudentStage(page, "6th grade");
    await fillGoalsStage(page, "More academic support or help getting back on track");

    await expect(page.getByText(/how is your student.s learning going now/i)).toBeVisible();
    await page.getByRole("radio", { name: "Right on level", exact: true }).check();
    const supportNeedsGroup = page.getByRole("group", { name: /Where would you need the most support/i });
    await supportNeedsGroup.getByRole("checkbox", { name: "Other", exact: true }).check();
    const otherInput = page.getByLabel("Please describe", { exact: true });
    await expect(otherInput).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/please add a short description for "other"/i)).toBeVisible();
    await expect(page.getByText(/how is your student.s learning going now/i)).toBeVisible();

    await otherInput.fill("Needs help with executive functioning.");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("How much flexibility would be helpful?")).toBeVisible();
  });
});
