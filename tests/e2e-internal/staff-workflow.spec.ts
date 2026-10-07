import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Phase 6C end-to-end staff workflow coverage (docs/pathways
 * instruction section 25): a real family's case moves through
 * Discovery -> Report -> Contact (the existing, unmodified guest
 * funnel), then an admin assigns it to an advisor, the advisor sees it
 * in their queue, a different advisor is denied access, and a
 * reassignment transfers access immediately. Staff sign-in uses the
 * test-only `/api/test-only/staff-session` route
 * (`ALLOW_TEST_FIXTURES=true` for this webServer only -- see
 * playwright.internal.config.ts) -- the same real Better Auth
 * magic-link mechanism Phase 1 built, never a separate/invented login.
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

async function submitContact(page: Page, email: string) {
  await page.goto("/discover/consultation");
  await page.getByLabel("Parent/Guardian Name").fill("Pat Guardian");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile Phone").fill("555-123-4567");
  await page.getByLabel(/By continuing, you agree/).check();
  await page.getByRole("button", { name: "Continue to Scheduling" }).click();
  await expect(page).toHaveURL(/\/discover\/consultation\/schedule$/);
}

/** Establishes a REAL verified Better Auth session in this browser context via the test-only route, optionally seeding a staff_role row. */
async function signInAsStaff(
  context: BrowserContext,
  email: string,
  staffRole?: "ADMIN" | "ADVISOR",
) {
  const response = await context.request.post("/api/test-only/staff-session", {
    data: staffRole ? { email, staffRole } : { email },
  });
  expect(response.ok()).toBe(true);
}

test.describe("Phase 6C staff workflow: assignment, queues, and the per-case authorization boundary", () => {
  test("admin assigns an advisor, the advisor sees the case in their queue, a different advisor is denied, and reassignment transfers access", async ({
    browser,
  }) => {
    const suffix = uniqueSuffix();
    const studentName = `E2EStudent${suffix}`;
    const parentEmail = `parent-${suffix}@example.com`;
    const adminEmail = `admin-${suffix}@pathways.test`;
    const advisor1Email = `advisor1-${suffix}@pathways.test`;
    const advisor2Email = `advisor2-${suffix}@pathways.test`;

    // A real family completes the existing, unmodified guest funnel --
    // Discovery -> Report -> Contact -- creating exactly one PathwaysCase.
    const familyContext = await browser.newContext();
    const familyPage = await familyContext.newPage();
    await completeDiscoveryToReport(familyPage, studentName);
    await submitContact(familyPage, parentEmail);
    const familyCookies = await familyContext.cookies();
    await familyContext.close();
    // The guest funnel itself is still cookie-based (its own HttpOnly
    // guest-session cookie) -- this never changed by Phase 6C.
    expect(familyCookies.some((c) => c.name.toLowerCase().includes("session"))).toBe(true);

    // Provision both advisor accounts up front (their own throwaway
    // sign-in just creates the user + staff_role rows) so the admin's
    // advisor picker can find them.
    const advisor1Context = await browser.newContext();
    await signInAsStaff(advisor1Context, advisor1Email, "ADVISOR");
    const advisor2Context = await browser.newContext();
    await signInAsStaff(advisor2Context, advisor2Email, "ADVISOR");

    // Admin signs in and finds the new, unassigned case.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAsStaff(adminContext, adminEmail, "ADMIN");
    await adminPage.goto("/admin/cases");
    await expect(adminPage.getByRole("heading", { name: "Pathways Cases" })).toBeVisible();
    const row = adminPage.getByRole("row", { name: new RegExp(studentName) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Unassigned")).toBeVisible();
    await row.getByRole("link", { name: "View" }).click();

    await expect(adminPage.getByRole("heading", { name: studentName })).toBeVisible();
    const caseDetailUrl = adminPage.url();
    const caseId = caseDetailUrl.split("/admin/cases/")[1];
    expect(caseId).toBeTruthy();

    // Assign to advisor 1.
    await adminPage.getByLabel("Assign to").selectOption({ label: `${advisor1Email} (ADVISOR)` });
    await adminPage.getByRole("button", { name: "Assign" }).click();
    await expect(adminPage.getByText("Advisor assigned.")).toBeVisible();
    await expect(adminPage.getByText("Current advisor")).toBeVisible();
    await expect(adminPage.locator("dd").filter({ hasText: advisor1Email })).toBeVisible();

    // Advisor 1 sees it in their own queue and can open the detail.
    const advisor1Page = await advisor1Context.newPage();
    await advisor1Page.goto("/advisor/cases");
    await expect(advisor1Page.getByRole("heading", { name: "My Cases" })).toBeVisible();
    await expect(advisor1Page.getByRole("row", { name: new RegExp(studentName) })).toBeVisible();
    await advisor1Page.goto(`/advisor/cases/${caseId}`);
    await expect(advisor1Page.getByRole("heading", { name: studentName })).toBeVisible();
    await expect(advisor1Page.getByText("What We Heard")).toBeVisible();

    // Advisor 2 (a completely different, equally-authorized advisor)
    // sees nothing in their own queue and is denied direct access --
    // knowing the exact case UUID is never sufficient.
    const advisor2Page = await advisor2Context.newPage();
    await advisor2Page.goto("/advisor/cases");
    await expect(advisor2Page.getByText("No cases are currently assigned to you.")).toBeVisible();
    const directAccessResponse = await advisor2Page.goto(`/advisor/cases/${caseId}`);
    expect(directAccessResponse?.status()).toBe(404);

    // Admin reassigns to advisor 2.
    await adminPage.goto(`/admin/cases/${caseId}`);
    await adminPage.getByLabel("Reassign to").selectOption({ label: `${advisor2Email} (ADVISOR)` });
    await adminPage.getByRole("button", { name: "Reassign" }).click();
    await expect(adminPage.getByText("Case reassigned.")).toBeVisible();

    // Advisor 1 immediately loses access; advisor 2 immediately gains it.
    const advisor1AfterReassign = await advisor1Page.goto(`/advisor/cases/${caseId}`);
    expect(advisor1AfterReassign?.status()).toBe(404);
    await advisor2Page.goto(`/advisor/cases/${caseId}`);
    await expect(advisor2Page.getByRole("heading", { name: studentName })).toBeVisible();

    await advisor1Context.close();
    await advisor2Context.close();
    await adminContext.close();
  });

  test("an unauthenticated visitor to any staff route receives an honest 404, never a login page", async ({ page }) => {
    const adminResponse = await page.goto("/admin/cases");
    expect(adminResponse?.status()).toBe(404);
    const advisorResponse = await page.goto("/advisor/cases");
    expect(advisorResponse?.status()).toBe(404);
  });

  test("the test-only staff-session route only ever responds to POST, never GET", async ({ request }) => {
    const response = await request.get("/api/test-only/staff-session");
    // Next.js Route Handlers that export only POST return 405 Method Not
    // Allowed for other HTTP methods (the route module exists but declines
    // the verb) -- never 404, which is reserved for ALLOW_TEST_FIXTURES=false.
    expect(response.status()).toBe(405);
  });
});
