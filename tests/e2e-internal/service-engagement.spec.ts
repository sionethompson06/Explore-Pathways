import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Phase 6F end-to-end Service Engagement coverage (docs/pathways
 * PHASE6F_SERVICE_ENGAGEMENT.md "Required browser tests"): once a
 * Blueprint reaches READY_FOR_CLIENT, an assigned advisor records the
 * family's decision and (for CONTINUE_WITH_PATHWAYS) the consulting/
 * payment arrangement, confirms the engagement, and the case moves
 * into ACTIVE CONSULTANCY -- covering the Continue, Blueprint Only,
 * and Follow-Up decision branches, a security denial, and admin
 * read access to the confirmed engagement -- all against real
 * PostgreSQL via this suite's SCHEDULER_MODE=INTERNAL webServer.
 */

function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
}

async function completeDiscoveryToReport(page: Page, studentName: string) {
  await page.goto("/discover");
  await page.getByRole("button", { name: "Start My Discovery" }).click();
  await expect(page).toHaveURL(/\/discover\/profile/);

  await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
  const nameField = page.getByRole("textbox", { name: /what should we call your student/i });
  await nameField.fill(studentName);
  await nameField.blur();
  await page.waitForTimeout(400);
  await page.getByRole("radio", { name: "6th grade", exact: true }).check();
  await page.getByRole("combobox", { name: "State or territory" }).selectOption("UNKNOWN");
  await page.getByRole("radio", { name: "Traditional public school", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("What brought you to Pathways?")).toBeVisible();
  await page
    .getByRole("checkbox", { name: "More academic support or help getting back on track", exact: true })
    .check();
  await page.getByRole("checkbox", { name: "Flexibility", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText(/how is your student.s learning going now/i)).toBeVisible();
  await page.getByRole("radio", { name: "Right on level", exact: true }).check();
  await page.getByRole("radio", { name: "With occasional check-ins", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("How much flexibility would be helpful?")).toBeVisible();
  await page
    .getByRole("radio", { name: "Not important -- our schedule already works well", exact: true })
    .check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByText("What role would you ideally like to have in your student's day-to-day learning?"),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Regular support", exact: true }).check();
  await page.getByRole("button", { name: /See My Personalized Discovery Report|Continue/ }).click();

  await expect(page).toHaveURL(/\/discover\/profile\?stage=REVIEW/);
  await page.getByRole("button", { name: "See My Personalized Discovery Report" }).click();
  await expect(page).toHaveURL(/\/discover\/report$/);
}

async function bookPlanningCall(page: Page, email: string) {
  const cta = page.getByRole("link", { name: "Schedule My Free Pathways Planning Call" });
  await cta.first().click();
  await expect(page).toHaveURL(/\/discover\/consultation$/);

  await page.getByLabel("Parent/Guardian Name").fill("Pat Guardian");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile Phone").fill("555-123-4567");
  await page.getByLabel(/By continuing, you agree/).check();
  await page.getByRole("button", { name: "Continue to Scheduling" }).click();
  await expect(page).toHaveURL(/\/discover\/consultation\/schedule$/);

  let selectable = page.locator('button[class*="dateButton"]:not([disabled])').first();
  for (let attempt = 0; attempt < 4 && (await selectable.count()) === 0; attempt++) {
    const nextButton = page.getByRole("button", { name: "Next month" });
    if (!(await nextButton.isEnabled())) break;
    await nextButton.click();
    selectable = page.locator('button[class*="dateButton"]:not([disabled])').first();
  }
  await selectable.click();
  const firstTime = page.locator("button[data-slot-iso]").first();
  await expect(firstTime).toBeVisible();
  await firstTime.click();

  await page.getByRole("button", { name: "Confirm Planning Call" }).click();
  await expect(page).toHaveURL(/\/discover\/consultation\/confirmed$/);
}

async function signInAsStaff(context: BrowserContext, email: string, staffRole?: "ADMIN" | "ADVISOR") {
  const response = await context.request.post("/api/test-only/staff-session", {
    data: staffRole ? { email, staffRole } : { email },
  });
  expect(response.ok()).toBe(true);
}

/**
 * Drives one full family+advisor journey from Discovery through a
 * READY_FOR_CLIENT Blueprint, reusing the exact same steps
 * tests/e2e-internal/blueprint-workspace.spec.ts proves work. Returns
 * the case id so the caller can continue into the Phase 6F engagement
 * section on the advisor's own Blueprint page.
 */
async function takeCaseToReadyForClientBlueprint(
  browser: import("@playwright/test").Browser,
  adminPage: Page,
  studentName: string,
  parentEmail: string,
  advisorEmail: string,
  advisorContext: BrowserContext,
): Promise<{ caseId: string; advisorPage: Page }> {
  const familyContext = await browser.newContext();
  const familyPage = await familyContext.newPage();
  await completeDiscoveryToReport(familyPage, studentName);
  await bookPlanningCall(familyPage, parentEmail);
  await familyContext.close();

  await adminPage.goto("/admin/cases");
  const row = adminPage.getByRole("row", { name: new RegExp(studentName) });
  await row.getByRole("link", { name: "View" }).click();
  await expect(adminPage.getByRole("heading", { name: studentName })).toBeVisible();
  const caseId = adminPage.url().split("/admin/cases/")[1]!;
  await adminPage.getByLabel("Assign to").selectOption({ label: `${advisorEmail} (ADVISOR)` });
  await adminPage.getByRole("button", { name: "Assign" }).click();
  await expect(adminPage.getByText("Advisor assigned.")).toBeVisible();

  const advisorPage = await advisorContext.newPage();
  await advisorPage.goto(`/advisor/cases/${caseId}`);
  await expect(advisorPage.getByRole("heading", { name: studentName })).toBeVisible();
  await advisorPage.getByLabel(/^Attended$/i).check();
  await advisorPage.getByLabel(/Continue To Blueprint/i).check();
  await advisorPage.getByRole("button", { name: "Complete Planning Call" }).click();
  await expect(advisorPage.getByText("Planning call completed.")).toBeVisible();

  await advisorPage.getByRole("link", { name: "Open Student Success Blueprint" }).click();
  await advisorPage.getByRole("button", { name: "Start Student Success Blueprint" }).click();
  await expect(advisorPage.getByRole("heading", { name: "B01. Student Snapshot" })).toBeVisible();

  await advisorPage.locator("#b01StatedGoals").fill("Wants more flexibility for travel.");
  await advisorPage.locator("#b02ConfirmedPrimaryGoal").fill("Flexible schedule that supports travel.");
  await advisorPage.getByLabel("Current school with support").first().check();
  await advisorPage.locator("#b04AlignmentRationale").fill("Keeps current school with added flexibility.");
  await advisorPage.getByPlaceholder("Action").first().fill("Enroll in recommended model.");
  await advisorPage.locator("#b12Summary").fill("Recommend staying with added flexible support.");
  await advisorPage.getByRole("button", { name: "Save Draft" }).click();
  await expect(advisorPage.getByText("Draft saved.")).toBeVisible();

  await advisorPage.getByRole("button", { name: "Move to Internal Review" }).click();
  await expect(advisorPage.getByText("Moved to internal review.")).toBeVisible();
  await advisorPage.getByRole("button", { name: "Mark Ready for Client" }).click();
  await expect(advisorPage.getByText("Marked ready for client.")).toBeVisible();

  return { caseId, advisorPage };
}

test.describe("Phase 6F Service Engagement", () => {
  test("Continue With Pathways: advisor confirms installments, case reaches Active Consultancy; admin can view it", async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const suffix = uniqueSuffix();
    const studentName = `SEStudent${suffix}`;
    const parentEmail = `separent-${suffix}@example.com`;
    const adminEmail = `seadmin-${suffix}@pathways.test`;
    const advisorEmail = `seadvisor-${suffix}@pathways.test`;

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAsStaff(adminContext, adminEmail, "ADMIN");

    const advisorContext = await browser.newContext();
    await signInAsStaff(advisorContext, advisorEmail, "ADVISOR");

    const { caseId, advisorPage } = await takeCaseToReadyForClientBlueprint(
      browser,
      adminPage,
      studentName,
      parentEmail,
      advisorEmail,
      advisorContext,
    );

    await expect(advisorPage.getByRole("heading", { name: "Continue With Pathways" })).toBeVisible();
    await advisorPage.locator("#familyDecision-continue").check();
    await advisorPage.locator("#serviceArrangement-ongoing").check();
    await advisorPage.locator("#paymentStructure-installments").check();
    await advisorPage.locator("#installmentAmount").fill("500.00");
    await advisorPage.locator("#installmentCount").fill("3");
    await advisorPage.getByRole("button", { name: "Confirm Engagement" }).click();
    await expect(advisorPage.getByText("Engagement confirmed.")).toBeVisible();

    await expect(advisorPage.getByTestId("engagement-summary")).toBeVisible();
    await expect(advisorPage.getByTestId("engagement-summary").getByText("Active Consultancy")).toBeVisible();
    await expect(advisorPage.getByTestId("engagement-summary").getByText(/3 installments of \$500\.00/)).toBeVisible();

    await adminPage.goto(`/admin/cases/${caseId}/blueprint`);
    await expect(adminPage.getByTestId("engagement-summary")).toBeVisible();
    await expect(adminPage.getByTestId("engagement-summary").getByText("Active Consultancy")).toBeVisible();
    await expect(adminPage.getByTestId("engagement-summary").getByText(advisorEmail)).toBeVisible();

    await adminContext.close();
    await advisorContext.close();
  });

  test("Blueprint Only: decision is recorded, no Active Consultancy is created", async ({ browser }) => {
    test.setTimeout(150_000);
    const suffix = uniqueSuffix();
    const studentName = `SEBPOnly${suffix}`;
    const parentEmail = `sebponly-${suffix}@example.com`;
    const adminEmail = `sebpadmin-${suffix}@pathways.test`;
    const advisorEmail = `sebpadvisor-${suffix}@pathways.test`;

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAsStaff(adminContext, adminEmail, "ADMIN");
    const advisorContext = await browser.newContext();
    await signInAsStaff(advisorContext, advisorEmail, "ADVISOR");

    const { advisorPage } = await takeCaseToReadyForClientBlueprint(
      browser,
      adminPage,
      studentName,
      parentEmail,
      advisorEmail,
      advisorContext,
    );

    await advisorPage.locator("#familyDecision-blueprint-only").check();
    await advisorPage.getByRole("button", { name: "Confirm Engagement" }).click();
    await expect(advisorPage.getByText("Engagement confirmed.")).toBeVisible();
    await expect(advisorPage.getByTestId("engagement-summary")).toBeVisible();
    await expect(advisorPage.getByTestId("engagement-summary").getByText("Active Consultancy")).not.toBeVisible();
    await expect(advisorPage.getByTestId("engagement-summary").getByText("Blueprint Only")).toBeVisible();

    await adminContext.close();
    await advisorContext.close();
  });

  test("Follow-Up Needed: optional note/date are recorded, no Active Consultancy is created", async ({ browser }) => {
    test.setTimeout(150_000);
    const suffix = uniqueSuffix();
    const studentName = `SEFollowUp${suffix}`;
    const parentEmail = `sefollowup-${suffix}@example.com`;
    const adminEmail = `sefuadmin-${suffix}@pathways.test`;
    const advisorEmail = `sefuadvisor-${suffix}@pathways.test`;

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAsStaff(adminContext, adminEmail, "ADMIN");
    const advisorContext = await browser.newContext();
    await signInAsStaff(advisorContext, advisorEmail, "ADVISOR");

    const { advisorPage } = await takeCaseToReadyForClientBlueprint(
      browser,
      adminPage,
      studentName,
      parentEmail,
      advisorEmail,
      advisorContext,
    );

    await advisorPage.locator("#familyDecision-followup").check();
    await advisorPage.locator("#followUpNote").fill("Family wants to discuss again next month.");
    await advisorPage.locator("#followUpDate").fill("2026-03-01");
    await advisorPage.getByRole("button", { name: "Confirm Engagement" }).click();
    await expect(advisorPage.getByText("Engagement confirmed.")).toBeVisible();

    // FOLLOW_UP_NEEDED leaves the engagement at PENDING_DECISION (still
    // open, no final decision yet) -- the page re-renders the editable
    // form (pre-filled with what was just saved), never the locked
    // summary, and "Active Consultancy" never appears anywhere.
    await expect(advisorPage.getByTestId("engagement-summary")).not.toBeVisible();
    await expect(advisorPage.getByText("Active Consultancy")).not.toBeVisible();
    await expect(advisorPage.locator("#followUpNote")).toHaveValue("Family wants to discuss again next month.");
    await expect(advisorPage.locator("#followUpDate")).toHaveValue("2026-03-01");

    await adminContext.close();
    await advisorContext.close();
  });

  test("Security: an unassigned advisor cannot reach the Blueprint/engagement page for someone else's case", async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const suffix = uniqueSuffix();
    const studentName = `SESecurity${suffix}`;
    const parentEmail = `sesecurity-${suffix}@example.com`;
    const adminEmail = `seseadmin-${suffix}@pathways.test`;
    const advisorEmail = `seseadvisor-${suffix}@pathways.test`;
    const otherAdvisorEmail = `seseother-${suffix}@pathways.test`;

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAsStaff(adminContext, adminEmail, "ADMIN");
    const advisorContext = await browser.newContext();
    await signInAsStaff(advisorContext, advisorEmail, "ADVISOR");
    const otherAdvisorContext = await browser.newContext();
    await signInAsStaff(otherAdvisorContext, otherAdvisorEmail, "ADVISOR");

    const { caseId } = await takeCaseToReadyForClientBlueprint(
      browser,
      adminPage,
      studentName,
      parentEmail,
      advisorEmail,
      advisorContext,
    );

    const otherAdvisorPage = await otherAdvisorContext.newPage();
    const denied = await otherAdvisorPage.goto(`/advisor/cases/${caseId}/blueprint`);
    expect(denied?.status()).toBe(404);

    await adminContext.close();
    await advisorContext.close();
    await otherAdvisorContext.close();
  });
});
