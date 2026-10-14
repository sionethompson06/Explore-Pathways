import { test, expect } from "@playwright/test";

/**
 * Phase 2F: the desktop "Education Pathways" dropdown that surfaces
 * the four audience pages from the header, without altering the
 * Phase 2E interactive homepage sections.
 */

test.describe("Education Pathways dropdown (desktop)", () => {
  test("is closed by default and opens on click, exposing all four pathway links", async ({
    page,
  }) => {
    await page.goto("/");
    const header = page.locator("header");
    const trigger = header.getByRole("button", { name: "Education Pathways" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(header.getByRole("link", { name: "Student Athletes", exact: true })).toHaveCount(0);

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    for (const label of [
      "Student Athletes",
      "Flexible Learning",
      "Homeschool Support",
      "Academic Opportunities",
    ]) {
      await expect(header.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
  });

  test("is keyboard operable: Enter opens it, and a link inside is reachable by Tab", async ({
    page,
  }) => {
    await page.goto("/");
    const header = page.locator("header");
    const trigger = header.getByRole("button", { name: "Education Pathways" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Tab");
    const athleticsLink = header.getByRole("link", { name: "Student Athletes", exact: true });
    await expect(athleticsLink).toBeFocused();
  });

  test("Escape closes the dropdown and returns focus to the trigger", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    const trigger = header.getByRole("button", { name: "Education Pathways" });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    await expect(header.getByRole("link", { name: "Student Athletes", exact: true })).toHaveCount(0);
  });

  test("clicking outside the dropdown closes it", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    const trigger = header.getByRole("button", { name: "Education Pathways" });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.mouse.click(10, 10);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("clicking a link navigates to a real page and closes the dropdown", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    await header.getByRole("button", { name: "Education Pathways" }).click();
    await header.getByRole("link", { name: "Homeschool Support", exact: true }).click();
    await expect(page).toHaveURL(/\/pathways\/homeschool$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("Audience page CTAs", () => {
  const CASES: Array<{ path: string; interest: string }> = [
    { path: "/pathways/athletes", interest: "athletics" },
    { path: "/pathways/homeschool", interest: "homeschool_support" },
    { path: "/pathways/flexible-learning", interest: "flexible_schedule" },
    { path: "/pathways/academic-opportunities", interest: "academic_challenge" },
  ];

  for (const { path, interest } of CASES) {
    test(`${path} CTA routes to /discover with its allowlisted interest`, async ({ page }) => {
      await page.goto(path);
      await page.getByRole("link", { name: "Find My Student's Pathway" }).click();
      await expect(page).toHaveURL(new RegExp(`/discover\\?interest=${interest}$`));
    });
  }
});

test.describe("For Partners page", () => {
  test("shows the hero, partner categories, the three-role model, and the honest contact state", async ({
    page,
  }) => {
    await page.goto("/for-partners");
    await expect(
      page.getByRole("heading", { level: 1, name: /coordinate the education/i }),
    ).toBeVisible();
    await expect(page.getByText("Athletic Academies")).toBeVisible();
    await expect(page.getByText("Education Providers")).toBeVisible();

    // Scoped to the roles section -- the footer's "Company" column
    // also has its own unrelated "Pathways" heading.
    const rolesSection = page.locator('section[aria-labelledby="partners-roles-heading"]');
    await expect(rolesSection.getByRole("heading", { name: "Partner Organization" })).toBeVisible();
    await expect(rolesSection.getByRole("heading", { name: "Education Provider" })).toBeVisible();
    await expect(rolesSection.getByRole("heading", { name: "Pathways", exact: true })).toBeVisible();
    await expect(page.getByText(/not yet handled through this site/i)).toBeVisible();
  });

  test("does not claim an existing partnership", async ({ page }) => {
    await page.goto("/for-partners");
    await expect(
      page.getByText(/No\s+partnership, affiliation, accreditation or endorsement/i),
    ).toBeVisible();
  });
});

test.describe("FAQ tone (Phase 2F)", () => {
  test("the school-change answer leads with possibility, not a bare No", async ({ page }) => {
    await page.goto("/");
    const question = page.getByText("Does my child need to change schools?");
    await question.scrollIntoViewIfNeeded();
    await question.click();
    await expect(page.getByText(/^Not necessarily\./)).toBeVisible();
  });
});
