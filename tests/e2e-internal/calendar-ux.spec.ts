import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 6A.2a monthly-calendar UX coverage (sections 8-18, 22): the
 * compact month grid replacing the old long vertical date list. Runs
 * against the same SCHEDULER_MODE=INTERNAL webServer as
 * booking-internal.spec.ts (playwright.internal.config.ts).
 *
 * Weekend-visibility and month-navigation assertions here are
 * deliberately clock-independent (true regardless of which real
 * calendar day the test happens to run on) -- Friday/Saturday/Sunday
 * are NEVER eligible under any "now", and month labels/cell counts
 * change structurally on navigation regardless of the date. The
 * clock-*dependent* cases (the exact too-soon-date boundary) are
 * covered instead by deterministic fixed-`now` Vitest unit tests in
 * tests/scheduling-policy.test.ts, since a real dev server's actual
 * wall-clock time cannot be pinned from here.
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

async function reachSchedulePage(page: Page, emailOverride: string) {
  await completeDiscoveryToReport(page);
  await page.goto("/discover/consultation");
  await fillContactForm(page, { email: emailOverride });
  await page.getByRole("button", { name: "Continue to Scheduling" }).click();
  await expect(page).toHaveURL(/\/discover\/consultation\/schedule$/);
}

/**
 * Advances to the first month (from the currently displayed one) that
 * has a selectable date -- exactly like a real parent clicking "Next
 * month" if the current one is fully booked/past -- and returns how
 * many clicks that took, so a second, independent session can be
 * driven to the exact same month deterministically.
 */
async function advanceToFirstAvailableDate(page: Page): Promise<number> {
  let selectable = page.locator('button[class*="dateButton"]:not([disabled])').first();
  let clicks = 0;
  while ((await selectable.count()) === 0) {
    const nextButton = page.getByRole("button", { name: "Next month" });
    if (!(await nextButton.isEnabled())) break;
    await nextButton.click();
    clicks++;
    selectable = page.locator('button[class*="dateButton"]:not([disabled])').first();
  }
  await expect(selectable).toBeVisible();
  return clicks;
}

async function advanceMonths(page: Page, clicks: number) {
  const nextButton = page.getByRole("button", { name: "Next month" });
  for (let i = 0; i < clicks; i++) await nextButton.click();
}

test.describe("Calendar UX: compact monthly calendar (sections 8-13)", () => {
  test("renders a real 7-column month grid with weekday headers and month navigation, not a long vertical list", async ({
    page,
  }) => {
    await reachSchedulePage(page, "calendar-shape@example.com");

    await expect(page.getByRole("heading", { name: "Select a Day" })).toBeVisible();
    // The old long vertical date-list markup is gone.
    await expect(page.locator('[class*="dayList"]')).toHaveCount(0);

    const grid = page.locator('[class*="calendarGrid"]');
    await expect(grid).toBeVisible();
    const dateButtons = grid.locator("button");
    expect(await dateButtons.count()).toBeGreaterThan(20); // a real month grid, not a handful of rows

    // Available Times sits immediately after the compact calendar --
    // never after scrolling through weeks of individual date rows
    // (section 12). A generous bounding-box check: the calendar's
    // total rendered height should be compact (a handful of 44px rows,
    // not 30+ stacked full-width buttons).
    const calendarBox = await page.locator('[class*="calendar"]').first().boundingBox();
    expect(calendarBox).not.toBeNull();
    expect(calendarBox!.height).toBeLessThan(400);
  });

  test("month navigation moves forward/back and is bounded to the booking horizon", async ({ page }) => {
    await reachSchedulePage(page, "calendar-nav@example.com");

    const monthLabel = page.locator('[class*="monthLabel"]');
    const startLabel = (await monthLabel.innerText()).trim();

    const nextButton = page.getByRole("button", { name: "Next month" });
    const prevButton = page.getByRole("button", { name: "Previous month" });

    // Previous month is never reachable -- the horizon starts today.
    await expect(prevButton).toBeDisabled();

    await nextButton.click();
    const afterNextLabel = (await monthLabel.innerText()).trim();
    expect(afterNextLabel).not.toBe(startLabel); // navigated to a different month

    await prevButton.click();
    const backLabel = (await monthLabel.innerText()).trim();
    expect(backLabel).toBe(startLabel); // returns exactly to where it started
  });
});

test.describe("Calendar UX: weekend dates are visible but disabled, never hidden (section 10/17)", () => {
  test("every rendered Friday/Saturday/Sunday date button in the visible month is present and disabled", async ({
    page,
  }) => {
    await reachSchedulePage(page, "weekend-visibility@example.com");

    const grid = page.locator('[class*="calendarGrid"]');
    const allDateButtons = grid.locator("button");
    const count = await allDateButtons.count();
    expect(count).toBeGreaterThan(0);

    let sawAWeekendButton = false;
    for (let i = 0; i < count; i++) {
      const button = allDateButtons.nth(i);
      const label = await button.getAttribute("aria-label");
      if (!label) continue;
      if (/^(Friday|Saturday|Sunday),/.test(label)) {
        sawAWeekendButton = true;
        // Visible (never omitted from the grid) but never selectable.
        await expect(button).toBeVisible();
        await expect(button).toBeDisabled();
      }
    }
    // Any real calendar month contains at least one Fri/Sat/Sun date --
    // fail loudly if the grid somehow rendered none at all (would mean
    // the weekend cells were silently omitted rather than disabled).
    expect(sawAWeekendButton).toBe(true);
  });
});

test.describe("Calendar UX: a fully-booked weekday stays visible and disabled, offers no times (section 16, mandatory)", () => {
  test("booking every remaining slot for one day leaves that day's calendar cell visible, disabled, and time-button-free", async ({
    browser,
  }) => {
    const setupContext = await browser.newContext();
    const setupPage = await setupContext.newPage();
    await reachSchedulePage(setupPage, "fully-booked-setup@example.com");

    const monthClicks = await advanceToFirstAvailableDate(setupPage);
    const firstDay = setupPage.locator('button[class*="dateButton"]:not([disabled])').first();
    await firstDay.click();
    const targetDateLabel = await firstDay.getAttribute("aria-label");
    expect(targetDateLabel).toBeTruthy();

    const timeButtons = setupPage.locator("button[data-slot-iso]");
    const slotCount = await timeButtons.count();
    expect(slotCount).toBeGreaterThan(0);
    // Capture the exact ISO for each slot up front -- every filler
    // session below targets one specific, pre-determined ISO rather
    // than a positional index, so nothing can shift underneath a
    // slower session as other sessions finish booking concurrently.
    const slotIsos: string[] = [];
    for (let i = 0; i < slotCount; i++) {
      slotIsos.push((await timeButtons.nth(i).getAttribute("data-slot-iso"))!);
    }
    await setupContext.close();

    // Book EVERY remaining slot for that exact day -- one independent
    // family/session per slot, running in parallel. Each session
    // independently reaches the schedule page fresh, selects the SAME
    // target day (matched by its accessible label), then its own
    // pre-assigned exact slot ISO.
    const contexts = await Promise.all(Array.from({ length: slotCount }, () => browser.newContext()));
    try {
      await Promise.all(
        contexts.map(async (context, index) => {
          const bookerPage = await context.newPage();
          await reachSchedulePage(bookerPage, `fully-booked-filler-${index}@example.com`);
          await advanceMonths(bookerPage, monthClicks);
          const dayButton = bookerPage.getByRole("button", { name: targetDateLabel!, exact: true });
          await dayButton.click();
          const slotButton = bookerPage.locator(`button[data-slot-iso="${slotIsos[index]}"]`);
          await expect(slotButton).toBeVisible();
          await slotButton.click();
          await bookerPage.getByRole("button", { name: "Confirm Planning Call" }).click();
          await expect(bookerPage).toHaveURL(/\/discover\/consultation\/confirmed$/);
        }),
      );
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }

    // A brand-new family now loads the schedule page fresh: that exact
    // date must still be present in the grid (never silently removed),
    // but disabled, and never offers a time for it.
    const verifyContext = await browser.newContext();
    const verifyPage = await verifyContext.newPage();
    try {
      await reachSchedulePage(verifyPage, "fully-booked-verify@example.com");
      await advanceMonths(verifyPage, monthClicks);
      const targetButton = verifyPage.getByRole("button", { name: targetDateLabel!, exact: true });
      await expect(targetButton).toBeVisible();
      await expect(targetButton).toBeDisabled();

      // Attempting to interact with it has no effect -- the times
      // panel never shows any button for the exhausted day.
      await targetButton.click({ force: true }).catch(() => {});
      await expect(verifyPage.getByText("Select a day to see available times.")).toBeVisible();
      await expect(verifyPage.locator("button[data-slot-iso]")).toHaveCount(0);
    } finally {
      await verifyContext.close();
    }
  });
});
