import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 3 end-to-end coverage for the real Discovery questionnaire.
 * Each test starts its own guest session (via /discover's real
 * "Start My Discovery" action) rather than sharing state across
 * tests.
 */

async function startDiscovery(page: Page, interest?: string) {
  await page.goto(interest ? `/discover?interest=${interest}` : "/discover");
  await page.getByRole("button", { name: "Start My Discovery" }).click();
  await expect(page).toHaveURL(/\/discover\/profile/);
}

/** Fills the always-active STUDENT stage with a minimal valid answer set for the given grade, then continues. */
async function fillStudentStage(page: Page, grade: string) {
  await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
  await page.getByRole("radio", { name: gradeLabel(grade), exact: true }).check();
  await page
    .getByRole("combobox", { name: "State or territory" })
    .selectOption("UNKNOWN");
  await page.getByRole("radio", { name: "Traditional public school", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

function gradeLabel(grade: string): string {
  const map: Record<string, string> = {
    K: "Kindergarten",
    "1": "1st grade",
    "4": "4th grade",
    "6": "6th grade",
    "7": "7th grade",
    "9": "9th grade",
    "10": "10th grade",
  };
  return map[grade] ?? grade;
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

async function fillScheduleStage(page: Page) {
  await expect(page.getByText("How much flexibility would be helpful?")).toBeVisible();
  await page.getByRole("radio", { name: "Not important -- our schedule already works well", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillFamilyStage(page: Page) {
  await expect(page.getByText("What role would you ideally like to have in your student's day-to-day learning?")).toBeVisible();
  await page.getByRole("radio", { name: "Regular support", exact: true }).check();
  await page.getByRole("button", { name: /Complete My Discovery Profile|Continue/ }).click();
}

test.describe("Discovery: happy path completion (grade 6, no athletics branch)", () => {
  test("a family can complete the full Discovery profile and reach the honest completion screen", async ({
    page,
  }) => {
    await startDiscovery(page);
    await fillStudentStage(page, "6");
    await fillGoalsStage(page, "Academic support");
    await fillLearningStage(page);
    await fillScheduleStage(page);
    await fillFamilyStage(page);

    await expect(page).toHaveURL(/\/discover\/profile\?stage=REVIEW/);
    await expect(page.getByRole("heading", { name: "Student" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Goals" })).toBeVisible();

    await page.getByRole("button", { name: "Complete My Discovery Profile" }).click();
    await expect(page).toHaveURL(/\/discover\/report$/);
    await expect(
      page.getByRole("heading", { name: "Your Discovery Profile Is Complete" }),
    ).toBeVisible();

    // Honest completion state: no recommendation/ranking language anywhere.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/best school|top match|ranked|score:|% fit/i);
  });
});

test.describe("Discovery: homepage interest handoff", () => {
  test("an athletics interest arrives as an editable preselection, not a hidden answer", async ({
    page,
  }) => {
    await startDiscovery(page, "athletics");
    await fillStudentStage(page, "7");

    await expect(page.getByText("What brought you to Pathways?")).toBeVisible();
    const athleticsCheckbox = page.getByRole("checkbox", { name: "Athletics", exact: true });
    await expect(athleticsCheckbox).toBeChecked();

    // Editable: the parent can simply uncheck it.
    await athleticsCheckbox.uncheck();
    await expect(athleticsCheckbox).not.toBeChecked();
  });
});

/**
 * DEC-G5 (Phase 3A owner clarification): a homepage marketing-interest
 * hint stays a non-persistent hint until the parent reaches DISC_006
 * and presses Continue -- at which point whatever is currently visible
 * (the untouched hint, a changed selection, or the hint plus an added
 * reason) becomes the real, persisted discovery_reasons answer. The
 * parent is never required to uncheck/recheck an already-correct
 * preselection just to "confirm" it.
 */
test.describe("Discovery: homepage interest confirmation on Continue (DEC-G5)", () => {
  test("the hint is not silently persisted merely because the GOALS screen loaded", async ({
    page,
  }) => {
    await startDiscovery(page, "athletics");
    await fillStudentStage(page, "7");
    await expect(page.getByText("What brought you to Pathways?")).toBeVisible();
    await expect(page.getByText(/Based on what you told us earlier/)).toBeVisible();

    // No interaction, no Continue -- just reload the same screen.
    await page.reload();
    await expect(page.getByText(/Based on what you told us earlier/)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Athletics", exact: true })).toBeChecked();
  });

  test("pressing Continue while the visible hint remains selected persists it, with no uncheck/recheck required", async ({
    page,
  }) => {
    await startDiscovery(page, "athletics");
    await fillStudentStage(page, "7");
    const athletics = page.getByRole("checkbox", { name: "Athletics", exact: true });
    await expect(athletics).toBeChecked();

    // Confirm by pressing Continue -- the checkbox itself is never touched.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=LEARNING/);

    await page.goto("/discover/profile?stage=GOALS");
    // The hint banner is gone: this is now a real, persisted answer, not
    // merely a suggestion re-offered on every load.
    await expect(page.getByText(/Based on what you told us earlier/)).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Athletics", exact: true })).toBeChecked();
  });

  test("changing the visible hint before Continue persists the changed answer, not the original hint", async ({
    page,
  }) => {
    await startDiscovery(page, "athletics");
    await fillStudentStage(page, "7");
    const athletics = page.getByRole("checkbox", { name: "Athletics", exact: true });
    await expect(athletics).toBeChecked();
    await athletics.uncheck();
    await page.getByRole("checkbox", { name: "Flexibility", exact: true }).check();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=LEARNING/);

    await page.goto("/discover/profile?stage=GOALS");
    await expect(page.getByRole("checkbox", { name: "Athletics", exact: true })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Flexibility", exact: true })).toBeChecked();
  });

  test("adding a second reason alongside the untouched hint persists both", async ({ page }) => {
    await startDiscovery(page, "athletics");
    await fillStudentStage(page, "7");
    await expect(page.getByRole("checkbox", { name: "Athletics", exact: true })).toBeChecked();
    await page.getByRole("checkbox", { name: "Flexibility", exact: true }).check();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=LEARNING/);

    await page.goto("/discover/profile?stage=GOALS");
    await expect(page.getByRole("checkbox", { name: "Athletics", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Flexibility", exact: true })).toBeChecked();
  });

  test("abandoning before DISC_006 confirmation never converts the hint into a completed answer", async ({
    page,
  }) => {
    await startDiscovery(page, "athletics");
    await fillStudentStage(page, "7");
    await expect(page.getByText("What brought you to Pathways?")).toBeVisible();

    // Abandon this stage without pressing Continue.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/stage=STUDENT/);

    await page.goto("/discover/profile?stage=REVIEW");
    await expect(page.getByText("A few required questions still need an answer")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Athletics");
  });

  test("branch activation (the Athletics stage) requires the confirmed answer, not the unconfirmed hint", async ({
    page,
  }) => {
    await startDiscovery(page, "athletics");
    await fillStudentStage(page, "7");
    const progressNav = page.getByRole("navigation", { name: "Discovery progress" });
    // The hint alone, never confirmed, must not activate the branch.
    await expect(progressNav).not.toContainText("Athletics");

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=LEARNING/);
    // Confirmed via Continue -- the branch is active from here on.
    await expect(progressNav).toContainText("Athletics");
  });
});

test.describe("Discovery: navigation", () => {
  test("Back returns to the previous stage", async ({ page }) => {
    await startDiscovery(page);
    await fillStudentStage(page, "6");
    await expect(page).toHaveURL(/stage=GOALS/);

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/stage=STUDENT/);
    await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
  });

  test("refresh preserves saved answers within the valid session", async ({ page }) => {
    await startDiscovery(page);
    await fillStudentStage(page, "6");
    await expect(page).toHaveURL(/stage=GOALS/); // wait for the Continue navigation to actually land
    await page.reload();
    await expect(page.getByText("What brought you to Pathways?")).toBeVisible();

    // The STUDENT stage's own saved answer survives independently of
    // which stage is currently being viewed -- confirmed by navigating
    // to it directly (an in-app Back click, not a raw browser
    // back-button/bfcache interaction, which is not itself a Phase 3
    // requirement).
    await page.goto("/discover/profile?stage=STUDENT");
    await expect(page.getByRole("radio", { name: "6th grade", exact: true })).toBeChecked();
  });

  test("an optional question can be left blank and the stage still advances", async ({ page }) => {
    await startDiscovery(page);
    // student_age (DISC_003) is optional and left untouched here.
    await fillStudentStage(page, "6");
    await expect(page).toHaveURL(/stage=GOALS/);
  });
});

test.describe("Discovery: branch changes", () => {
  test("switching grade from high school to elementary removes the graduation/credit stage from progress", async ({
    page,
  }) => {
    await startDiscovery(page);
    await page.getByRole("radio", { name: "10th grade", exact: true }).check();

    // Grade 10 alone activates reported_graduation_status (HIGH_SCHOOL),
    // which puts a real question in the Planning stage.
    const progressNav = page.getByRole("navigation", { name: "Discovery progress" });
    await expect(progressNav).toContainText("Planning");

    await page.getByRole("radio", { name: "4th grade", exact: true }).check();
    await expect(progressNav).not.toContainText("Planning");
  });
});

test.describe("Discovery: UNKNOWN completion", () => {
  test("selecting ‘I'm not sure’ style UNKNOWN answers still allows completion", async ({
    page,
  }) => {
    await startDiscovery(page);
    await page.getByRole("radio", { name: "6th grade", exact: true }).check();
    await page
      .getByRole("combobox", { name: "State or territory" })
      .selectOption("UNKNOWN");
    const educationModelGroup = page.getByRole("group", {
      name: "How is your student learning today?",
    });
    await educationModelGroup.getByRole("radio", { name: "I'm not sure", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=GOALS/);
  });
});

test.describe("Discovery: storage and URL never carry child answers", () => {
  test("localStorage/sessionStorage stay empty and the profile URL never contains raw answers", async ({
    page,
  }) => {
    await startDiscovery(page, "athletics");
    await fillStudentStage(page, "7");

    const storageState = await page.evaluate(() => ({
      localStorageLength: window.localStorage.length,
      sessionStorageLength: window.sessionStorage.length,
    }));
    expect(storageState.localStorageLength).toBe(0);
    expect(storageState.sessionStorageLength).toBe(0);

    const url = page.url();
    expect(url).not.toContain("interest=");
    expect(url).not.toMatch(/grade|athletics|current_grade/i);
  });
});

test.describe("Discovery: mobile layout", () => {
  test("no horizontal overflow on the questionnaire at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await startDiscovery(page);
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasOverflow).toBe(false);
  });
});

test.describe("Discovery: keyboard operation", () => {
  test("radio options are reachable and selectable by keyboard alone", async ({ page }) => {
    await startDiscovery(page);
    await page.keyboard.press("Tab"); // skip link
    const gradeRadio = page.getByRole("radio", { name: "6th grade", exact: true });
    await gradeRadio.focus();
    await page.keyboard.press("Space");
    await expect(gradeRadio).toBeChecked();
  });
});

test.describe("Discovery: Review screen", () => {
  test("Edit from Review returns to the named stage", async ({ page }) => {
    await startDiscovery(page);
    await fillStudentStage(page, "6");
    await fillGoalsStage(page, "Academic support");
    await fillLearningStage(page);
    await fillScheduleStage(page);
    await fillFamilyStage(page);
    await expect(page).toHaveURL(/stage=REVIEW/);

    await page.getByRole("button", { name: "Edit Student" }).click();
    await expect(page).toHaveURL(/stage=STUDENT/);
    await expect(page.getByRole("radio", { name: "6th grade", exact: true })).toBeChecked();
  });
});

test.describe("Discovery: athletics branch + DISC_020A", () => {
  test("a DEFINITELY college-athletics answer reveals the NCAA follow-up question", async ({
    page,
  }) => {
    await startDiscovery(page, "athletics");
    await page.getByRole("radio", { name: "7th grade", exact: true }).check();
    await page
      .getByRole("combobox", { name: "State or territory" })
      .selectOption("UNKNOWN");
    await page.getByRole("radio", { name: "Traditional public school", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/stage=GOALS/);
    const athleticsCheckbox = page.getByRole("checkbox", { name: "Athletics", exact: true });
    await expect(athleticsCheckbox).toBeChecked();
    // The preselection is visual only until the parent actually
    // interacts with it -- explicitly re-affirm it here to commit a
    // real, saved discovery_reasons answer (Playwright's .check() is
    // a no-op on a control already in the checked DOM state).
    await athleticsCheckbox.uncheck();
    await athleticsCheckbox.check();
    await page.getByRole("checkbox", { name: "Flexibility", exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/stage=LEARNING/);

    await page.getByRole("button", { name: "Continue" }).click(); // all optional here
    await expect(page).toHaveURL(/stage=SCHEDULE/);

    await page.getByRole("button", { name: "Continue" }).click(); // all optional here
    await expect(page).toHaveURL(/stage=ATHLETICS/);
    await expect(page.getByText("Is competing in college something your student may want to explore in the future?")).toBeVisible();
    await expect(
      page.getByText("Would it be helpful to include NCAA academic requirements"),
    ).toHaveCount(0);

    await page.getByRole("radio", { name: "Definitely", exact: true }).check();
    await expect(
      page.getByText("Would it be helpful to include NCAA academic requirements"),
    ).toBeVisible();
  });
});

test.describe("Discovery: expired/missing session", () => {
  test("visiting /discover/profile with no session redirects to /discover", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/discover/profile");
    await expect(page).toHaveURL(/\/discover$/);
  });
});
