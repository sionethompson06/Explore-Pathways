import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Phase 6E end-to-end Student Success Blueprint coverage (docs/pathways
 * PHASE6E_BLUEPRINT_AUTHORING.md "Required browser tests"): a real
 * family completes the existing, unmodified Discovery -> Report ->
 * Contact -> Schedule -> Confirm funnel, an admin assigns an advisor,
 * the advisor completes the Planning Call (CONTINUE_TO_BLUEPRINT),
 * then creates, drafts, reviews, and locks a Student Success Blueprint
 * -- covering creation, draft persistence across reload, security
 * denial across two advisor configurations, admin read-only access,
 * completeness validation, the internal-review/ready-for-client
 * lifecycle, new-revision creation, and an optimistic-concurrency
 * conflict -- all against real PostgreSQL via this suite's
 * SCHEDULER_MODE=INTERNAL webServer.
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

test.describe("Phase 6E Student Success Blueprint", () => {
  test("advisor completes the Planning Call, authors a Blueprint through its full lifecycle, with security denial, admin read-only access, and a concurrency conflict", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const suffix = uniqueSuffix();
    const studentName = `BPStudent${suffix}`;
    const parentEmail = `bpparent-${suffix}@example.com`;
    const adminEmail = `bpadmin-${suffix}@pathways.test`;
    const advisor1Email = `bpadvisor1-${suffix}@pathways.test`;
    const advisor2Email = `bpadvisor2-${suffix}@pathways.test`;

    const familyContext = await browser.newContext();
    const familyPage = await familyContext.newPage();
    await completeDiscoveryToReport(familyPage, studentName);
    await bookPlanningCall(familyPage, parentEmail);
    await familyContext.close();

    const advisor1Context = await browser.newContext();
    await signInAsStaff(advisor1Context, advisor1Email, "ADVISOR");
    const advisor2Context = await browser.newContext();
    await signInAsStaff(advisor2Context, advisor2Email, "ADVISOR");

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAsStaff(adminContext, adminEmail, "ADMIN");
    await adminPage.goto("/admin/cases");
    const row = adminPage.getByRole("row", { name: new RegExp(studentName) });
    await row.getByRole("link", { name: "View" }).click();
    await expect(adminPage.getByRole("heading", { name: studentName })).toBeVisible();
    const caseId = adminPage.url().split("/admin/cases/")[1];
    await adminPage.getByLabel("Assign to").selectOption({ label: `${advisor1Email} (ADVISOR)` });
    await adminPage.getByRole("button", { name: "Assign" }).click();
    await expect(adminPage.getByText("Advisor assigned.")).toBeVisible();

    const advisor1Page = await advisor1Context.newPage();
    await advisor1Page.goto(`/advisor/cases/${caseId}`);
    await expect(advisor1Page.getByRole("heading", { name: studentName })).toBeVisible();

    // Not yet eligible: completing the Planning Call is required first.
    await expect(advisor1Page.getByText("Student Success Blueprint")).not.toBeVisible();

    await advisor1Page.getByLabel(/^Attended$/i).check();
    await advisor1Page.getByLabel(/Continue To Blueprint/i).check();
    await advisor1Page.getByRole("button", { name: "Complete Planning Call" }).click();
    await expect(advisor1Page.getByText("Planning call completed.")).toBeVisible();

    // Entry point now appears.
    await expect(advisor1Page.getByRole("link", { name: "Open Student Success Blueprint" })).toBeVisible();
    await advisor1Page.getByRole("link", { name: "Open Student Success Blueprint" }).click();
    await expect(advisor1Page).toHaveURL(new RegExp(`/advisor/cases/${caseId}/blueprint$`));

    // Security: a different, unassigned advisor cannot reach the Blueprint route at all.
    const advisor2Page = await advisor2Context.newPage();
    const deniedBeforeCreate = await advisor2Page.goto(`/advisor/cases/${caseId}/blueprint`);
    expect(deniedBeforeCreate?.status()).toBe(404);

    // Creation.
    await advisor1Page.getByRole("button", { name: "Start Student Success Blueprint" }).click();
    await expect(advisor1Page.getByRole("heading", { name: "B01. Student Snapshot" })).toBeVisible();

    // Draft: fill some fields, save, refresh, confirm persistence.
    await advisor1Page.locator("#b01StatedGoals").fill("Wants more flexibility for travel.");
    await advisor1Page.getByLabel("Current school with support").first().check();
    await advisor1Page.locator("#b04AlignmentRationale").fill("Keeps current school with added flexibility.");
    await advisor1Page.locator("#b12Summary").fill("Recommend staying with added flexible support.");
    await advisor1Page.getByRole("button", { name: "Save Draft" }).click();
    await expect(advisor1Page.getByText("Draft saved.")).toBeVisible();
    await advisor1Page.reload();
    await expect(advisor1Page.locator("#b01StatedGoals")).toHaveValue("Wants more flexibility for travel.");
    await expect(advisor1Page.locator("#b12Summary")).toHaveValue("Recommend staying with added flexible support.");

    // Admin read-only access: sees the Blueprint summary and a locked, non-editable preview.
    await adminPage.goto(`/admin/cases/${caseId}`);
    await expect(adminPage.getByRole("link", { name: "View Student Success Blueprint" })).toBeVisible();
    await adminPage.getByRole("link", { name: "View Student Success Blueprint" }).click();
    await expect(adminPage.getByText("Recommend staying with added flexible support.")).toBeVisible();
    await expect(adminPage.getByRole("button", { name: "Save Draft" })).not.toBeVisible();

    // Completeness validation: move to internal review, then attempt to
    // mark ready for client without a required field (B10 action item) --
    // rejected, with the specific issues shown.
    await advisor1Page.getByRole("button", { name: "Move to Internal Review" }).click();
    await expect(advisor1Page.getByText("Moved to internal review.")).toBeVisible();
    await advisor1Page.getByRole("button", { name: "Mark Ready for Client" }).click();
    await expect(advisor1Page.getByText("This Blueprint is not yet complete enough")).toBeVisible();
    await expect(advisor1Page.getByText(/B10 Action Plan/)).toBeVisible();

    // Security (reassignment): admin reassigns the case; advisor 1 loses
    // Blueprint access immediately, advisor 2 gains it and sees the same draft.
    await adminPage.goto(`/admin/cases/${caseId}`);
    await adminPage.getByLabel("Reassign to").selectOption({ label: `${advisor2Email} (ADVISOR)` });
    await adminPage.getByRole("button", { name: "Reassign" }).click();
    await expect(adminPage.getByText("Case reassigned.")).toBeVisible();

    const deniedAfterReassign = await advisor1Page.goto(`/advisor/cases/${caseId}/blueprint`);
    expect(deniedAfterReassign?.status()).toBe(404);

    await advisor2Page.goto(`/advisor/cases/${caseId}/blueprint`);
    await expect(advisor2Page.locator("#b01StatedGoals")).toHaveValue("Wants more flexibility for travel.");

    // Complete the remaining required fields and mark ready for client.
    await advisor2Page.locator("#b02ConfirmedPrimaryGoal").fill("Flexible schedule that supports travel.");
    await advisor2Page.getByPlaceholder("Action").first().fill("Enroll in recommended model.");
    await advisor2Page.getByRole("button", { name: "Mark Ready for Client" }).click();
    await expect(advisor2Page.getByText("Marked ready for client.")).toBeVisible();

    // The revision is now locked: no editable form, a preview instead,
    // and a "Start a New Revision" control appears.
    await expect(advisor2Page.getByRole("button", { name: "Save Draft" })).not.toBeVisible();
    await expect(advisor2Page.getByText("Revision 1")).toBeVisible();
    await expect(advisor2Page.getByRole("heading", { name: "Start a New Revision" })).toBeVisible();

    // New revision: carries forward the prior revision's content.
    await advisor2Page.getByLabel("Reason").selectOption("FAMILY_UPDATE");
    await advisor2Page.getByRole("button", { name: "Create New Revision" }).click();
    await expect(advisor2Page.getByText("New revision created.")).toBeVisible();
    await expect(advisor2Page.locator("#b12Summary")).toHaveValue("Recommend staying with added flexible support.");

    // Concurrency conflict: two tabs of the same advisor session both
    // load the same (now-editable, revision-2) draft; the first save
    // wins, the second is rejected as a version conflict.
    const tabA = advisor2Page;
    const tabB = await advisor2Context.newPage();
    await tabB.goto(`/advisor/cases/${caseId}/blueprint`);
    await expect(tabB.locator("#b12Summary")).toHaveValue("Recommend staying with added flexible support.");

    await tabA.locator("#b12Summary").fill("Winner's update.");
    await tabA.getByRole("button", { name: "Save Draft" }).click();
    await expect(tabA.getByText("Draft saved.")).toBeVisible();

    await tabB.locator("#b12Summary").fill("Loser's stale update.");
    await tabB.getByRole("button", { name: "Save Draft" }).click();
    await expect(tabB.getByText(/Someone else saved more recent changes/)).toBeVisible();

    await advisor1Context.close();
    await advisor2Context.close();
    await adminContext.close();
  });
});
