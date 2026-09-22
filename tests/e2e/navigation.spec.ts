import { test, expect } from "@playwright/test";

const AUDIENCE_SLUGS = ["athletes", "homeschool", "flexible-learning", "academic-opportunities"];

test.describe("public navigation", () => {
  test("homepage loads with the hero headline and primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /School Should Fit Your Child/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Find My Student's Pathway" }).first()).toBeVisible();
  });

  test("header nav links navigate to real, working pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "How It Works" }).click();
    await expect(page).toHaveURL(/\/how-it-works$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/step-by-step/i);

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "For Partners" }).click();
    await expect(page).toHaveURL(/\/for-partners$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/collaboration model/i);
  });

  test("every audience route returns a real page, not a dead link", async ({ page }) => {
    for (const slug of AUDIENCE_SLUGS) {
      const response = await page.goto(`/pathways/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("an unknown pathways slug returns a real 404, not a silent blank page", async ({ page }) => {
    const response = await page.goto("/pathways/does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("footer links are all real, working routes", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    const links = await footer.getByRole("link").all();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = await link.getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).not.toBe("#");
    }
  });

  test("privacy and terms pages load and are honestly marked draft", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByText(/Draft — not yet available for live use/)).toBeVisible();

    await page.goto("/terms");
    await expect(page.getByText(/Draft — not yet available for live use/)).toBeVisible();
  });

  test("FAQ accordion opens and closes on the homepage", async ({ page }) => {
    await page.goto("/");
    const firstQuestion = page.getByText("Is Pathways a school?");
    await firstQuestion.scrollIntoViewIfNeeded();
    const detailsEl = page.locator("details", { has: firstQuestion });
    await expect(detailsEl).not.toHaveAttribute("open", "");
    await firstQuestion.click();
    await expect(detailsEl).toHaveAttribute("open", "");
    await firstQuestion.click();
    await expect(detailsEl).not.toHaveAttribute("open", "");
  });
});

test.describe("Discovery entry point routing", () => {
  test("goal cards link to /discover with the correct allowlisted interest", async ({ page }) => {
    await page.goto("/");
    // The card link's accessible name is its full text content (label
    // + description), so match on the label as a case-sensitive
    // prefix -- distinct from the footer's differently-cased
    // "Homeschool Support" nav link to /pathways/homeschool.
    await page.getByRole("link", { name: /^Homeschool support/ }).click();
    await expect(page).toHaveURL(/\/discover\?interest=homeschool_support$/);
    await expect(page.getByText("You selected:")).toBeVisible();
    await expect(page.getByText("Homeschool support", { exact: true }).first()).toBeVisible();
  });

  test("an unrecognized interest value is ignored, never reflected", async ({ page }) => {
    await page.goto("/discover?interest=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    await expect(page.getByText("You selected:")).toHaveCount(0);
    await expect(page.getByText("Choose the starting point that fits best")).toBeVisible();
    const bodyHtml = await page.content();
    expect(bodyHtml).not.toContain("<script>alert(1)</script>");
  });

  test("changing the interest via the goal list updates the selection", async ({ page }) => {
    await page.goto("/discover?interest=athletics");
    await expect(
      page.getByText("More time for athletics", { exact: true }).first(),
    ).toBeVisible();

    await page
      .getByRole("link", { name: "More academic challenge and opportunity" })
      .click();
    await expect(page).toHaveURL(/\/discover\?interest=academic_challenge$/);
    await expect(
      page.getByText("More academic challenge and opportunity", { exact: true }).first(),
    ).toBeVisible();
  });

  test("the Discovery page states the questionnaire is not enabled yet", async ({ page }) => {
    await page.goto("/discover");
    await expect(
      page.getByText(/Discovery questionnaire is not enabled yet/i),
    ).toBeVisible();
  });
});
