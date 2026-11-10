import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 6A.3 -- end-to-end connected preview (sections 19-23): the full
 * owner-facing journey across BOTH DB-free demos, connected for the
 * first time. Discovery (/discover/demo) -> Review -> Personalized
 * Discovery Report -> "Schedule My Free Pathways Planning Call" ->
 * Contact Information -> native Pathways Calendar (/discover/consultation/demo)
 * -> Select Date/Time -> Demo Confirmation.
 *
 * Unlike tests/e2e/discovery-demo-integration.spec.ts (which stops at
 * the report) and tests/e2e/consultation.spec.ts (which starts cold at
 * /discover/consultation/demo), this file proves the actual navigation
 * between the two demos, that no state is transferred between them
 * (sections 16-18: no query string/localStorage/sessionStorage/cookie),
 * and that the consultation demo resets on refresh even mid-journey.
 */

async function completeToConnectedReport(page: Page) {
  await page.goto("/discover/demo");

  await expect(page.getByText("What grade is your student currently in?")).toBeVisible();
  await page.getByRole("radio", { name: "2nd grade", exact: true }).check();
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

  await page.getByRole("button", { name: "See My Personalized Discovery Report" }).click();
}

async function fillContactForm(page: Page) {
  await page.getByLabel("Parent/Guardian Name").fill("Pat Guardian");
  await page.getByLabel("Email", { exact: true }).fill("pat.guardian@example.com");
  await page.getByLabel("Mobile Phone").fill("555-123-4567");
  await page.getByLabel(/By continuing, you agree/).check();
}

/** Mirrors tests/e2e-internal/booking-internal.spec.ts's `selectFirstAvailableDate`: the demo calendar's synthetic slots are generated against the real current time, so which month first has a selectable date depends on when the test runs. */
async function selectFirstAvailableDate(page: Page) {
  let selectable = page.locator('button[class*="dateButton"]:not([disabled])').first();
  for (let attempt = 0; attempt < 4 && (await selectable.count()) === 0; attempt++) {
    const nextButton = page.getByRole("button", { name: "Next month" });
    if (!(await nextButton.isEnabled())) break;
    await nextButton.click();
    selectable = page.locator('button[class*="dateButton"]:not([disabled])').first();
  }
  await expect(selectable).toBeVisible();
  await selectable.click();
}

test.describe("End-to-end preview: Discovery demo -> connected consultation/booking demo", () => {
  test("the full connected journey reaches a fake confirmation, with no state transferred and no cookies/storage created", async ({
    page,
  }) => {
    const cookiesBefore = await page.context().cookies();

    await completeToConnectedReport(page);

    // Personalized Discovery Report -- the primary CTA is the connected
    // booking-preview action, never the canonical UNCONFIGURED CTA.
    const cta = page.getByRole("link", { name: "Schedule My Free Pathways Planning Call" }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/discover/consultation/demo");

    await cta.click();
    await expect(page).toHaveURL(/\/discover\/consultation\/demo$/);
    // Section 16-18: the transition carries no query string, and no PII
    // from Discovery (name/grade/school type) leaks into the URL.
    expect(new URL(page.url()).search).toBe("");

    await expect(page.getByText("DEMO PREVIEW", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Let's Build the Next Step Together" })).toBeVisible();

    // Contact Information.
    await fillContactForm(page);
    await page.getByRole("button", { name: "Continue to Scheduling" }).click();

    // Native Pathways Calendar.
    await expect(page.getByText("Contact step complete.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Choose a Time for Your Pathways Planning Call" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Select a Day" })).toBeVisible();

    // Select Date/Time.
    await selectFirstAvailableDate(page);
    const firstTime = page.locator('button[class*="timeButton"]').first();
    await expect(firstTime).toBeVisible();
    await firstTime.click();

    // Summary, then confirm.
    await expect(page.getByRole("status").filter({ hasText: "Pathways Planning Call" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm Planning Call" }).click();

    // Demo Confirmation.
    await expect(page.getByRole("heading", { name: "Your Pathways Planning Call Is Reserved" })).toBeVisible();
    await expect(page.getByText("This is a preview of the confirmation experience -- no real appointment is booked.")).toBeVisible();
    await expect(page).toHaveURL(/\/discover\/consultation\/demo$/);

    // Sections 16-18: no cookie, no localStorage/sessionStorage, anywhere
    // across the entire connected journey.
    const cookiesAfter = await page.context().cookies();
    expect(cookiesAfter.length).toBe(cookiesBefore.length);
    const storageCounts = await page.evaluate(() => ({
      local: window.localStorage.length,
      session: window.sessionStorage.length,
    }));
    expect(storageCounts.local).toBe(0);
    expect(storageCounts.session).toBe(0);
  });

  test("a refresh mid-journey restarts the consultation demo from scratch -- no contact or appointment state survives", async ({
    page,
  }) => {
    await completeToConnectedReport(page);
    await page.getByRole("link", { name: "Schedule My Free Pathways Planning Call" }).first().click();
    await expect(page).toHaveURL(/\/discover\/consultation\/demo$/);

    await fillContactForm(page);
    await page.getByRole("button", { name: "Continue to Scheduling" }).click();
    await expect(page.getByRole("heading", { name: "Select a Day" })).toBeVisible();
    await selectFirstAvailableDate(page);
    const firstTime = page.locator('button[class*="timeButton"]').first();
    await expect(firstTime).toBeVisible();
    await firstTime.click();
    await page.getByRole("button", { name: "Confirm Planning Call" }).click();
    await expect(page.getByRole("heading", { name: "Your Pathways Planning Call Is Reserved" })).toBeVisible();

    await page.reload();

    // Ephemeral, in-memory React state only -- a refresh restarts the
    // demo entirely, never resuming the confirmed appointment or the
    // previously entered contact details.
    await expect(page.getByRole("heading", { name: "Let's Build the Next Step Together" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Pathways Planning Call Is Reserved" })).toHaveCount(0);
    await expect(page.getByLabel("Parent/Guardian Name")).toHaveValue("");
  });
});
