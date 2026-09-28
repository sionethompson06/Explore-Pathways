import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Phase 6A.2 native booking calendar end-to-end coverage (docs/pathways
 * instruction sections 61-63). This suite's own webServer
 * (playwright.internal.config.ts) runs with SCHEDULER_MODE=INTERNAL, so
 * `getConsultationCapability().provider` is "INTERNAL" here -- the real,
 * database-backed native calendar renders instead of the Phase 6A
 * Google-handoff button. Every browser context below gets its own
 * cookie jar, so two contexts are two entirely independent guest
 * sessions/families -- exactly like two real parents in two tabs.
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

/** Selects the first available day, then the first available time within it. Returns the visible time label. */
async function selectFirstAvailableSlot(page: Page): Promise<string> {
  const firstDay = page.locator('button[class*="dayButton"]').first();
  await firstDay.click();
  const firstTime = page.locator('button[data-slot-iso]').first();
  await expect(firstTime).toBeVisible();
  const label = (await firstTime.innerText()).trim();
  await firstTime.click();
  return label;
}

test.describe("Consultation: native Pathways booking calendar (INTERNAL mode)", () => {
  test.use({ timezoneId: "America/New_York" });

  test("full parent journey: report CTA, contact, native calendar (no Google), select day/time, confirm, genuinely persisted confirmation", async ({
    page,
  }) => {
    await completeDiscoveryToReport(page);

    // Section 69-70: INTERNAL mode does not change the report CTA.
    const cta = page.getByRole("link", { name: "Schedule My Free Pathways Planning Call" });
    await expect(cta.first()).toBeVisible();
    await cta.first().click();
    await expect(page).toHaveURL(/\/discover\/consultation$/);

    await fillContactForm(page);
    await page.getByRole("button", { name: "Continue to Scheduling" }).click();
    await expect(page).toHaveURL(/\/discover\/consultation\/schedule$/);

    await expect(page.getByText("Your information is saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Choose a Time for Your Pathways Planning Call" })).toBeVisible();
    await expect(page.getByText("Select a day and time that works for your family.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Select a Day" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Available Times" })).toBeVisible();

    // Never mentions Google in INTERNAL mode (section 22).
    const scheduleBody = await page.locator("body").innerText();
    expect(scheduleBody).not.toMatch(/google/i);

    const timeLabel = await selectFirstAvailableSlot(page);

    await expect(page.locator('[class*="summaryTitle"]')).toHaveText("Pathways Planning Call");
    await expect(page.getByText(timeLabel, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/your time/)).toBeVisible(); // context tz is America/New_York, not Pacific
    await expect(page.getByText(/Pacific/)).toBeVisible();
    await expect(page.getByText("45 minutes · Video")).toBeVisible();

    await page.getByRole("button", { name: "Confirm Planning Call" }).click();
    await expect(page).toHaveURL(/\/discover\/consultation\/confirmed$/);

    await expect(page.getByRole("heading", { name: "Your Pathways Planning Call Is Reserved" })).toBeVisible();
    await expect(page.getByText(/Pacific/)).toBeVisible();
    await expect(page.getByText(/your time/)).toBeVisible();
    await expect(page.getByText("45 minutes · Video")).toBeVisible();
    await expect(page.getByText("Your Pathways advisor will review your Discovery before the call.")).toBeVisible();
    await expect(page.getByText("Connection details will be provided before your appointment.")).toBeVisible();
    // Never fabricates delivery/assignment that has not happened (section 34-35, 41).
    const confirmedBody = await page.locator("body").innerText();
    expect(confirmedBody).not.toMatch(/email confirmation sent|google meet|advisor assigned|account created/i);

    // Genuinely persisted server-side, not client-only state: a hard
    // reload re-derives the exact same confirmation from the database.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your Pathways Planning Call Is Reserved" })).toBeVisible();
    await expect(page.getByText("45 minutes · Video")).toBeVisible();
  });
});

test.describe("Consultation: already booked (section 37)", () => {
  test("revisiting the schedule route after booking redirects to confirmation -- never offers a second calendar", async ({
    page,
  }) => {
    await completeDiscoveryToReport(page);
    await page.goto("/discover/consultation");
    await fillContactForm(page, { email: "already.booked@example.com" });
    await page.getByRole("button", { name: "Continue to Scheduling" }).click();
    await expect(page).toHaveURL(/\/discover\/consultation\/schedule$/);

    await selectFirstAvailableSlot(page);
    await page.getByRole("button", { name: "Confirm Planning Call" }).click();
    await expect(page).toHaveURL(/\/discover\/consultation\/confirmed$/);

    await page.goto("/discover/consultation/schedule");
    await expect(page).toHaveURL(/\/discover\/consultation\/confirmed$/);
    await expect(page.getByRole("heading", { name: "Select a Day" })).toHaveCount(0);
  });
});

test.describe("Consultation: slot conflict UX (section 62)", () => {
  test("two families racing the same slot: the loser sees the exact conflict copy, availability refreshes, never a generic error", async ({
    browser,
  }) => {
    let contextAlice: BrowserContext | undefined;
    let contextBob: BrowserContext | undefined;
    try {
      contextAlice = await browser.newContext();
      contextBob = await browser.newContext();
      const alice = await contextAlice.newPage();
      const bob = await contextBob.newPage();

      // Both families independently reach the schedule page and select
      // the very same first-offered day/time -- deterministic, since
      // neither has booked anything yet.
      await completeDiscoveryToReport(alice);
      await alice.goto("/discover/consultation");
      await fillContactForm(alice, { email: "alice@example.com" });
      await alice.getByRole("button", { name: "Continue to Scheduling" }).click();
      await expect(alice).toHaveURL(/\/discover\/consultation\/schedule$/);
      const aliceTimeLabel = await selectFirstAvailableSlot(alice);

      await completeDiscoveryToReport(bob);
      await bob.goto("/discover/consultation");
      await fillContactForm(bob, { email: "bob@example.com" });
      await bob.getByRole("button", { name: "Continue to Scheduling" }).click();
      await expect(bob).toHaveURL(/\/discover\/consultation\/schedule$/);
      const bobTimeLabel = await selectFirstAvailableSlot(bob);
      expect(bobTimeLabel).toBe(aliceTimeLabel); // proof both are racing the identical slot

      // Bob confirms first -- he wins the slot.
      await bob.getByRole("button", { name: "Confirm Planning Call" }).click();
      await expect(bob).toHaveURL(/\/discover\/consultation\/confirmed$/);

      // Alice, still holding her now-stale selection, confirms second.
      await alice.getByRole("button", { name: "Confirm Planning Call" }).click();
      await expect(alice.locator('[class*="error"][role="alert"]')).toHaveText(
        "That time was just reserved by another family. Please choose another available time.",
      );
      // Never a generic crash/500 page -- the real calendar UI is still there.
      await expect(alice).toHaveURL(/\/discover\/consultation\/schedule$/);
      await expect(alice.getByRole("heading", { name: "Choose a Time for Your Pathways Planning Call" })).toBeVisible();

      // Availability refreshed: the taken slot is no longer offered for that day.
      await expect(alice.locator(`button[data-slot-iso]:has-text("${aliceTimeLabel}")`)).toHaveCount(0);

      // Alice can still recover by picking a different time.
      const otherTimes = alice.locator("button[data-slot-iso]");
      if ((await otherTimes.count()) > 0) {
        await otherTimes.first().click();
        await alice.getByRole("button", { name: "Confirm Planning Call" }).click();
        await expect(alice).toHaveURL(/\/discover\/consultation\/confirmed$/);
      }
    } finally {
      await contextAlice?.close();
      await contextBob?.close();
    }
  });
});
