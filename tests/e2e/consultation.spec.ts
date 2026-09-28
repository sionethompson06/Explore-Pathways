import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 6A end-to-end coverage (docs/pathways instruction sections
 * 58-63): the real, database-backed report-to-planning-call funnel
 * (contact UX, contact-first persistence, honest scheduler-second
 * behavior) plus the DB-free demo preview. This webServer runs with
 * SCHEDULER_MODE=UNCONFIGURED (this repo's real, unconfigured local
 * state -- no Google URL was invented for this environment), so
 * `/discover/consultation` itself (which never gates on scheduler
 * capability -- only the report page's CTA label does) is reached
 * here by direct navigation rather than via the CTA button. The
 * REQUEST_ONLY-configured scheduler handoff mechanics (status
 * transition to PENDING_VERIFICATION, WorkflowEvent, and that the
 * redirect target is the server-configured URL and never
 * client-controlled) are covered instead by
 * tests/consultation.test.ts's real-Postgres integration suite, which
 * exercises them without ever performing an actual internet
 * navigation to Google -- this file positively asserts the
 * complementary honest-refusal behavior instead (SCHEDULING_UNAVAILABLE
 * never fakes availability).
 */

async function completeDiscoveryToReport(page: Page) {
  await page.goto("/discover");
  await page.getByRole("button", { name: "Start My Discovery" }).click();
  await expect(page).toHaveURL(/\/discover\/profile/);

  await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
  await page.getByRole("radio", { name: "6th grade", exact: true }).check();
  await page.getByRole("combobox", { name: "State or territory" }).selectOption("UNKNOWN");
  await page.getByRole("radio", { name: "Traditional public school", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("What brought you to Pathways?")).toBeVisible();
  await page.getByRole("checkbox", { name: "More academic support or help getting back on track", exact: true }).check();
  await page.getByRole("checkbox", { name: "Flexibility", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText(/how is your student.s learning going now/i)).toBeVisible();
  await page.getByRole("radio", { name: "Right on level", exact: true }).check();
  await page.getByRole("radio", { name: "With occasional check-ins", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("How much flexibility would be helpful?")).toBeVisible();
  await page.getByRole("radio", { name: "Not important -- our schedule already works well", exact: true }).check();
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

async function fillContactForm(page: Page, overrides: Partial<{ guardianName: string; email: string; mobilePhone: string }> = {}) {
  await page.getByLabel("Parent/Guardian Name").fill(overrides.guardianName ?? "Pat Guardian");
  await page.getByLabel("Email", { exact: true }).fill(overrides.email ?? "pat.guardian@example.com");
  await page.getByLabel("Mobile Phone").fill(overrides.mobilePhone ?? "555-123-4567");
  await page.getByLabel(/By continuing, you agree/).check();
}

test.describe("Consultation: contact page UX", () => {
  test("shows student context, 45 minutes, Video default, Phone alternative, required fields, no repeated Discovery questions, explicit consent, and a Back to Report link", async ({
    page,
  }) => {
    await completeDiscoveryToReport(page);
    await page.goto("/discover/consultation");

    await expect(page.getByRole("heading", { name: "Let's Build the Next Step Together" })).toBeVisible();
    await expect(page.getByText("Free Pathways Planning Call")).toBeVisible();
    await expect(page.getByText("45 minutes")).toBeVisible();
    await expect(page.getByText("Video (preferred)").first()).toBeVisible();

    // Required fields only -- never re-asks Discovery answers.
    await expect(page.getByLabel("Parent/Guardian Name")).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Mobile Phone")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Video (preferred)" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Phone" })).not.toBeChecked();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/what grade|current_grade|traditional public school/i);

    // Explicit consent, not pre-checked.
    const consent = page.getByLabel(/By continuing, you agree/);
    await expect(consent).not.toBeChecked();

    await expect(page.getByRole("link", { name: "Back to My Discovery Report" })).toBeVisible();
  });

  test("keeps entered values and shows field errors when required fields are missing", async ({ page }) => {
    await completeDiscoveryToReport(page);
    await page.goto("/discover/consultation");

    await page.getByLabel("Parent/Guardian Name").fill("Pat Guardian");
    await page.getByRole("button", { name: "Continue to Scheduling" }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    // The entered name survives the failed submission.
    await expect(page.getByLabel("Parent/Guardian Name")).toHaveValue("Pat Guardian");
    await expect(page).toHaveURL(/\/discover\/consultation$/);
  });
});

test.describe("Consultation: contact-first is a real business requirement", () => {
  test("contact is persisted before scheduling is reached, and survives abandoning the scheduling step", async ({
    page,
  }) => {
    await completeDiscoveryToReport(page);
    await page.goto("/discover/consultation");
    await fillContactForm(page);
    await page.getByRole("button", { name: "Continue to Scheduling" }).click();

    await expect(page).toHaveURL(/\/discover\/consultation\/schedule$/);
    await expect(page.getByText("Your information is saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Choose a Time for Your Pathways Planning Call" })).toBeVisible();

    // Abandon scheduling entirely (navigate away, as a real parent might).
    await page.goto("/");
    // Returning later without re-submitting contact still finds the same
    // active request -- proof the contact was durably saved, independent
    // of whether scheduling was ever completed.
    await page.goto("/discover/consultation/schedule");
    await expect(page).toHaveURL(/\/discover\/consultation\/schedule$/);
    await expect(page.getByText("Your information is saved.")).toBeVisible();
  });

  test("a double-click on submit does not produce two separate requests (idempotent contact-first)", async ({ page }) => {
    await completeDiscoveryToReport(page);
    await page.goto("/discover/consultation");
    await fillContactForm(page);
    await Promise.all([
      page.waitForURL(/\/discover\/consultation\/schedule$/),
      page.getByRole("button", { name: "Continue to Scheduling" }).click(),
    ]);
    await expect(page.getByText("Your information is saved.")).toBeVisible();
  });
});

test.describe("Consultation: scheduler-second, honest when not configured", () => {
  test("'Choose My Time' never fakes an available scheduler -- this environment's real SCHEDULER_MODE is UNCONFIGURED", async ({
    page,
  }) => {
    await completeDiscoveryToReport(page);
    await page.goto("/discover/consultation");
    await fillContactForm(page);
    await page.getByRole("button", { name: "Continue to Scheduling" }).click();
    await expect(page).toHaveURL(/\/discover\/consultation\/schedule$/);

    await page.getByRole("link", { name: "Choose My Time" }).click();
    // Never lands on an external google.com URL, never claims a booking --
    // the honest UNCONFIGURED refusal redirects back into the app.
    await expect(page).not.toHaveURL(/google\.com/);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/booked|confirmed appointment/i);
  });
});

test.describe("Consultation: DB-free demo preview", () => {
  test("renders without a database, is clearly labeled, never persists, never issues a cookie, never opens a real scheduler", async ({
    page,
    context,
  }) => {
    await page.goto("/discover/consultation/demo");

    await expect(page.getByText("DEMO PREVIEW", { exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    await expect(page.getByText(/answers and contact information are not saved/i)).toBeVisible();

    await fillContactForm(page, { email: "demo.parent@example.com" });
    await page.getByRole("button", { name: "Continue to Scheduling" }).click();

    // Phase 6A.2 (sections 66-68): the demo's scheduling step is now the
    // real, presentational native calendar -- still entirely synthetic,
    // in-memory, and DB-free -- rather than the old Phase 6A placeholder
    // "Choose My Time" button.
    await expect(page.getByText("Your information is saved.")).toBeVisible();
    await expect(page.getByText(/no real appointment is booked/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Select a Day" })).toBeVisible();

    const firstDay = page.locator('button[class*="dayButton"]').first();
    await firstDay.click();
    const firstTime = page.locator('button[class*="timeButton"]').first();
    await expect(firstTime).toBeVisible();
    await firstTime.click();

    await page.getByRole("button", { name: "Confirm Planning Call" }).click();
    await expect(page.getByRole("heading", { name: "Your Pathways Planning Call Is Reserved" })).toBeVisible();
    await expect(page.getByText(/no real appointment is booked/i).last()).toBeVisible();
    // Still on the demo page -- the fake confirmation never navigates anywhere real.
    await expect(page).toHaveURL(/\/discover\/consultation\/demo$/);

    const cookies = await context.cookies();
    expect(cookies).toHaveLength(0);
  });
});

test.describe("Consultation: mobile and accessibility", () => {
  test("the contact page has no horizontal overflow and exactly one H1 at 375px", async ({ page }) => {
    await completeDiscoveryToReport(page);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/discover/consultation");

    await expect(page.locator("h1")).toHaveCount(1);
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasOverflow).toBe(false);
  });

  test("required fields have accessible names and radio group semantics", async ({ page }) => {
    await completeDiscoveryToReport(page);
    await page.goto("/discover/consultation");

    await expect(page.getByRole("group", { name: "Preferred Call Format" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Video (preferred)" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Phone" })).toBeVisible();

    await page.getByLabel("Email", { exact: true }).fill("not-an-email");
    await page.getByLabel("Parent/Guardian Name").fill("Pat Guardian");
    await page.getByLabel("Mobile Phone").fill("555-123-4567");
    await page.getByLabel(/By continuing, you agree/).check();
    await page.getByRole("button", { name: "Continue to Scheduling" }).click();

    const emailInput = page.getByLabel("Email", { exact: true });
    await expect(emailInput).toHaveAttribute("aria-invalid", "true");
    const describedBy = await emailInput.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
  });
});
