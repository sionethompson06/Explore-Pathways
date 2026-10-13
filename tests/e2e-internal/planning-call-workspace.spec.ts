import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Phase 6D end-to-end Planning Call Workspace coverage (docs/pathways
 * instruction section 26): a real family completes the existing,
 * unmodified Discovery -> Report -> Contact -> Schedule -> Confirm
 * funnel (producing a genuinely BOOKED PathwaysCase), an admin assigns
 * it to an advisor (reusing the test-only staff-session route Phase 6C
 * established -- see playwright.internal.config.ts), the advisor
 * prepares, saves a draft, is denied/regranted access across a
 * reassignment, and completes the call -- all against real
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

test.describe("Phase 6D Planning Call Workspace", () => {
  test("advisor prepares, saves a draft that survives refresh, loses access on reassignment, and the new advisor completes the call", async ({
    browser,
  }) => {
    // This flow drives a full Discovery->Report->Contact->Schedule->
    // Confirm booking journey PLUS multiple staff sessions/contexts and
    // two full page round-trips through the workspace form -- more
    // real navigation than the default 30s per-test timeout allows.
    test.setTimeout(90_000);
    const suffix = uniqueSuffix();
    const studentName = `PCWStudent${suffix}`;
    const parentEmail = `pcwparent-${suffix}@example.com`;
    const adminEmail = `pcwadmin-${suffix}@pathways.test`;
    const advisor1Email = `pcwadvisor1-${suffix}@pathways.test`;
    const advisor2Email = `pcwadvisor2-${suffix}@pathways.test`;

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

    // Advisor preparation: sees the case in their queue, opens it, and
    // sees the correct Discovery context and appointment.
    const advisor1Page = await advisor1Context.newPage();
    await advisor1Page.goto("/advisor/cases");
    await expect(advisor1Page.getByRole("row", { name: new RegExp(studentName) })).toBeVisible();
    await advisor1Page.goto(`/advisor/cases/${caseId}`);
    await expect(advisor1Page.getByRole("heading", { name: studentName })).toBeVisible();
    await expect(advisor1Page.getByText("What We Heard")).toBeVisible();
    // Real appointment info is shown (never "—" for a case that is
    // genuinely booked).
    await expect(advisor1Page.locator("dd", { hasText: /\d{4}/ }).first()).toBeVisible();

    // No automatic completion: nothing has been explicitly completed
    // yet, so the editable form (not a completed summary) is what
    // renders, and no outcome exists.
    await expect(advisor1Page.getByRole("button", { name: "Complete Planning Call" })).toBeVisible();

    // Draft: enter structured findings, save, refresh, confirm it persisted.
    await advisor1Page.locator("#familyMainGoal").fill("More flexibility for travel.");
    await advisor1Page.getByLabel("Current school with support").check();
    await advisor1Page.getByRole("button", { name: "Save Draft" }).click();
    await expect(advisor1Page.getByText("Draft saved.")).toBeVisible();
    await advisor1Page.reload();
    await expect(advisor1Page.locator("#familyMainGoal")).toHaveValue("More flexibility for travel.");
    await expect(advisor1Page.getByLabel("Current school with support")).toBeChecked();

    // Security: a different, equally-authorized advisor cannot reach this case directly.
    const advisor2Page = await advisor2Context.newPage();
    const denied = await advisor2Page.goto(`/advisor/cases/${caseId}`);
    expect(denied?.status()).toBe(404);

    // Admin reassigns to advisor 2.
    await adminPage.goto(`/admin/cases/${caseId}`);
    await adminPage.getByLabel("Reassign to").selectOption({ label: `${advisor2Email} (ADVISOR)` });
    await adminPage.getByRole("button", { name: "Reassign" }).click();
    await expect(adminPage.getByText("Case reassigned.")).toBeVisible();

    // Advisor 1 immediately loses access.
    const afterReassign = await advisor1Page.goto(`/advisor/cases/${caseId}`);
    expect(afterReassign?.status()).toBe(404);

    // Advisor 2 gains access and sees the draft advisor 1 already saved.
    await advisor2Page.goto(`/advisor/cases/${caseId}`);
    await expect(advisor2Page.locator("#familyMainGoal")).toHaveValue("More flexibility for travel.");

    // Completion: record attendance + outcome, complete the call.
    await advisor2Page.getByLabel(/^Attended$/i).check();
    await advisor2Page.getByLabel(/Continue To Blueprint/i).check();
    await advisor2Page.getByRole("button", { name: "Complete Planning Call" }).click();
    await expect(advisor2Page.getByText("Planning call completed.")).toBeVisible();

    // The record is now read-only (summary, not the editable form) and
    // the correct PathwaysCase state results.
    await expect(advisor2Page.getByRole("button", { name: "Complete Planning Call" })).not.toBeVisible();
    await adminPage.goto(`/admin/cases/${caseId}`);
    await expect(adminPage.getByText("COMPLETED", { exact: false }).first()).toBeVisible();

    await advisor1Context.close();
    await advisor2Context.close();
    await adminContext.close();
  });
});
