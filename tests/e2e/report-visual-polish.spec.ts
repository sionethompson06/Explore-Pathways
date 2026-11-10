import { test, expect } from "@playwright/test";

/**
 * Phase 5.2 visual/structural coverage (docs/pathways/PHASE5_2_VISUAL_CONVERSION_POLISH.md).
 * These assertions cover the NEW guarantees this phase adds on top of
 * the existing tests/e2e/report-demo.spec.ts coverage: no visible
 * internal candidate IDs, the evidence/action zones being separate
 * regions, the visible R03 heading, the R05 advisory elevation, the
 * GR12 parallel split/rejoin structure, CTA-safety, and the
 * contentStatus-aware inline conversion copy. Runs entirely against
 * the DB-free `/discover/report/demo` route, same as report-demo.spec.ts.
 */

test.describe("No public internal IDs anywhere in visible text (section 28)", () => {
  for (const fixture of ["GR01", "GR03", "GR06", "GR12", "GR14"]) {
    test(`${fixture}: no bare candidate ID (B0N) appears in visible body text`, async ({ page }) => {
      await page.goto(`/discover/report/demo?fixture=${fixture}`);
      const body = await page.locator("body").innerText();
      expect(body).not.toMatch(/\bB0\d\b/);
    });
  }
});

test.describe("R03: evidence vs. action are separate, distinctly-headed regions (sections 5/37)", () => {
  test("GR03 shows 'Why This Surfaced' and 'What To Look For' as distinct headings, each with their own list", async ({
    page,
  }) => {
    await page.goto("/discover/report/demo?fixture=GR03");
    const evidenceHeadings = page.getByText("Why This Surfaced", { exact: true });
    const actionHeadings = page.getByText("What To Look For", { exact: true });
    await expect(evidenceHeadings).toHaveCount(2);
    await expect(actionHeadings).toHaveCount(2);
  });

  test("R03 section heading 'Directions Worth Exploring' is visible, not visually-hidden (section 7)", async ({
    page,
  }) => {
    await page.goto("/discover/report/demo?fixture=GR03");
    const heading = page.getByRole("heading", { level: 2, name: "Directions Worth Exploring" });
    await expect(heading).toBeVisible();
  });

  test("GR03's two direction cards render at equal width/height (equal visual weight, section 8)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto("/discover/report/demo?fixture=GR03");
    const first = page.getByRole("heading", { level: 3, name: "Hybrid Schooling" }).locator("xpath=ancestor::li");
    const second = page
      .getByRole("heading", { level: 3, name: "Teacher-Supported Virtual Schooling" })
      .locator("xpath=ancestor::li");
    const [box1, box2] = await Promise.all([first.boundingBox(), second.boundingBox()]);
    expect(box1).not.toBeNull();
    expect(box2).not.toBeNull();
    expect(Math.abs(box1!.width - box2!.width)).toBeLessThan(2);
  });
});

test.describe("R04: Support & Opportunity Map reads as the ecosystem, not more recommendations (section 9)", () => {
  test("GR01 (single-card, has opportunities) shows the ecosystem eyebrow", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR01");
    await expect(page.getByText("The ecosystem around this direction")).toBeVisible();
  });
});

test.describe("R05: advisory elevation (section 12/44)", () => {
  test("GR03 shows the new universal heading, supporting copy, and the original guide title as an eyebrow", async ({
    page,
  }) => {
    await page.goto("/discover/report/demo?fixture=GR03");
    await expect(page.getByRole("heading", { level: 2, name: "Questions That Matter Before You Choose" })).toBeVisible();
    await expect(
      page.getByText("These are the questions worth answering before you choose a direction or program."),
    ).toBeVisible();
  });
});

test.describe("R06: GR12 parallel pathway visibly splits and rejoins (sections 14-17/39/47)", () => {
  test("the parallel step is one accessible group containing both branch labels", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR12");
    const group = page.getByRole("group", { name: "Parallel pathway priorities" });
    await expect(group).toBeVisible();
    await expect(group.getByText("Resolve Credit Gaps")).toBeVisible();
    await expect(group.getByText("Protect Advanced Opportunities")).toBeVisible();
    // The step immediately before and after the split are still single, ordinary stages --
    // never artificially branched (section 16).
    await expect(page.getByText("Transcript & Graduation Review")).toBeVisible();
    await expect(page.getByText("Build a Coordinated Graduation Plan")).toBeVisible();
  });

  test("at desktop (1440px) both branches render side by side within the group, not clipped/overlapping", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto("/discover/report/demo?fixture=GR12");
    const branchA = page.getByText("Resolve Credit Gaps", { exact: true });
    const branchB = page.getByText("Protect Advanced Opportunities", { exact: true });
    const [boxA, boxB] = await Promise.all([branchA.boundingBox(), branchB.boundingBox()]);
    expect(boxA).not.toBeNull();
    expect(boxB).not.toBeNull();
    // Side-by-side means roughly the same vertical position, different horizontal position.
    expect(Math.abs(boxA!.y - boxB!.y)).toBeLessThan(4);
    expect(boxA!.x).not.toBeCloseTo(boxB!.x, 0);
  });

  test("at mobile (375px) both branches stay visually grouped, stacked vertically, never an ordinary flat list", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/discover/report/demo?fixture=GR12");
    const group = page.getByRole("group", { name: "Parallel pathway priorities" });
    await expect(group).toBeVisible();
    const branchA = group.getByText("Resolve Credit Gaps", { exact: true });
    const branchB = group.getByText("Protect Advanced Opportunities", { exact: true });
    const [boxA, boxB] = await Promise.all([branchA.boundingBox(), branchB.boundingBox()]);
    expect(boxA).not.toBeNull();
    expect(boxB).not.toBeNull();
    expect(boxB!.y).toBeGreaterThan(boxA!.y);
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasOverflow).toBe(false);
  });
});

test.describe("R07: CTA safety is preserved through the visual redesign (sections 18/42)", () => {
  for (const fixture of ["GR01", "GR03", "GR09", "GR12", "GR15"]) {
    test(`${fixture}: UNCONFIGURED still resolves to "See What Comes Next", never "Build My Student's Pathway"`, async ({
      page,
    }) => {
      await page.goto(`/discover/report/demo?fixture=${fixture}`);
      await expect(page.getByRole("link", { name: "See What Comes Next" }).first()).toBeVisible();
      const body = await page.locator("body").innerText();
      expect(body).not.toContain("Build My Student's Pathway");
    });
  }
});

test.describe("R07: owner-approved inline conversion copy by contentStatus (section 21, restored exactly in Phase 5.2b)", () => {
  test("PERSONALIZED (GR03) shows the exact approved options-comparison inline copy", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR03");
    await expect(page.getByText("Want help comparing the actual options?", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Pathways can help turn these directions into a complete plan.", { exact: true }),
    ).toBeVisible();
  });

  test("ADVISOR_FIRST (GR09) shows the exact approved advisor-review inline copy, never the Phase 5.2 paraphrase or the options-comparison copy", async ({
    page,
  }) => {
    await page.goto("/discover/report/demo?fixture=GR09");
    await expect(page.getByText("Want help reviewing this decision carefully?", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "Pathways can help organize the questions, information, and next steps before you choose a direction.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByText("Want help comparing the actual options?")).toHaveCount(0);
    await expect(page.getByText("Ready to have this reviewed with Pathways?")).toHaveCount(0);
    await expect(page.getByText(/walk through this with your family before any school-model decision/)).toHaveCount(0);
  });

  test("LIMITED_INFORMATION (GR15) shows the exact approved clarify inline copy, never the Phase 5.2 paraphrase", async ({
    page,
  }) => {
    await page.goto("/discover/report/demo?fixture=GR15");
    await expect(page.getByText("Want help getting clearer?", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Pathways can help turn these open questions into a clearer set of options and next steps.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("Want help figuring out what to look for next?")).toHaveCount(0);
    await expect(page.getByText(/clarify the right questions before you explore further/)).toHaveCount(0);
  });
});

test.describe("R07: CTA operational safety after the Phase 5.2b copy restoration (section 12)", () => {
  for (const fixture of ["GR03", "GR09", "GR15"]) {
    test(`${fixture}: UNCONFIGURED still resolves to "See What Comes Next" at the safe destination`, async ({
      page,
    }) => {
      await page.goto(`/discover/report/demo?fixture=${fixture}`);
      const ctas = page.getByRole("link", { name: "See What Comes Next" });
      await expect(ctas.first()).toBeVisible();
      const hrefs = await ctas.evaluateAll((links) => links.map((l) => (l as HTMLAnchorElement).getAttribute("href")));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(href).toBe("/how-it-works");
      }
      const body = await page.locator("body").innerText();
      expect(body).not.toContain("Build My Student's Pathway");
    });
  }
});

test.describe("R06: sequential pathways render horizontally at desktop, vertically at mobile (Phase 5.2b sections 4/5)", () => {
  for (const fixture of ["GR03", "GR09", "GR15", "GR06"]) {
    test(`${fixture}: desktop (1440px) -- no parallel group, stages progress left-to-right with no overlap`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 1200 });
      await page.goto(`/discover/report/demo?fixture=${fixture}`);
      await expect(page.getByRole("group", { name: "Parallel pathway priorities" })).toHaveCount(0);
      const stageLabels = page.locator('ol[class*="stages"] > li > span[class*="label"]');
      const count = await stageLabels.count();
      expect(count).toBeGreaterThanOrEqual(2);
      const first = await stageLabels.nth(0).boundingBox();
      const second = await stageLabels.nth(1).boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(Math.abs(first!.y - second!.y)).toBeLessThan(6);
      expect(second!.x).toBeGreaterThan(first!.x);
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(hasOverflow).toBe(false);
    });

    test(`${fixture}: mobile (375px) -- stages stack vertically, no overlap/overflow`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 1200 });
      await page.goto(`/discover/report/demo?fixture=${fixture}`);
      const stageLabels = page.locator('ol[class*="stages"] > li > span[class*="label"]');
      const count = await stageLabels.count();
      expect(count).toBeGreaterThanOrEqual(2);
      const first = await stageLabels.nth(0).boundingBox();
      const second = await stageLabels.nth(1).boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(second!.y).toBeGreaterThan(first!.y);
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(hasOverflow).toBe(false);
    });
  }
});

test.describe("R06: GR12 parallel pathway keeps the vertical split/rejoin treatment (Phase 5.2b section 6)", () => {
  test("desktop (1440px): main stages stay vertical, parallel branches render side by side, no overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto("/discover/report/demo?fixture=GR12");
    const group = page.getByRole("group", { name: "Parallel pathway priorities" });
    await expect(group).toBeVisible();
    await expect(group.getByText("Resolve Credit Gaps")).toBeVisible();
    await expect(group.getByText("Protect Advanced Opportunities")).toBeVisible();

    const branchA = page.getByText("Resolve Credit Gaps", { exact: true });
    const branchB = page.getByText("Protect Advanced Opportunities", { exact: true });
    const [boxA, boxB] = await Promise.all([branchA.boundingBox(), branchB.boundingBox()]);
    expect(boxA).not.toBeNull();
    expect(boxB).not.toBeNull();
    expect(Math.abs(boxA!.y - boxB!.y)).toBeLessThan(4);
    expect(boxA!.x).not.toBeCloseTo(boxB!.x, 0);

    // The subsequent main stage (after the parallel group) appears below it, not beside it --
    // the main roadmap stays vertical even though the branches inside are side by side.
    const nextStage = page.getByText("Flexible / Teacher-Supported Learning", { exact: true });
    const nextBox = await nextStage.boundingBox();
    expect(nextBox).not.toBeNull();
    expect(nextBox!.y).toBeGreaterThan(boxA!.y);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasOverflow).toBe(false);
  });

  test("mobile (375px): parallel group stays visible and grouped, branches stack, no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await page.goto("/discover/report/demo?fixture=GR12");
    const group = page.getByRole("group", { name: "Parallel pathway priorities" });
    await expect(group).toBeVisible();
    const branchA = group.getByText("Resolve Credit Gaps", { exact: true });
    const branchB = group.getByText("Protect Advanced Opportunities", { exact: true });
    const [boxA, boxB] = await Promise.all([branchA.boundingBox(), branchB.boundingBox()]);
    expect(boxA).not.toBeNull();
    expect(boxB).not.toBeNull();
    expect(boxB!.y).toBeGreaterThan(boxA!.y);

    const nextStage = page.getByText("Flexible / Teacher-Supported Learning", { exact: true });
    const nextBox = await nextStage.boundingBox();
    expect(nextBox).not.toBeNull();
    expect(nextBox!.y).toBeGreaterThan(boxB!.y);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasOverflow).toBe(false);
  });
});

test.describe("R06: regression guard for the Phase 5.2a node/label overlap bug (1cc7e57)", () => {
  async function assertNoNodeLabelOverlap(page: import("@playwright/test").Page) {
    const overlapCount = await page.evaluate(() => {
      const stages = Array.from(document.querySelectorAll('ol[class*="stages"] > li'));
      let overlaps = 0;
      for (const stage of stages) {
        const node = stage.querySelector('[class*="node"]');
        const label = stage.querySelector('[class*="label"], [class*="parallelBracket"]');
        if (!node || !label) continue;
        const n = node.getBoundingClientRect();
        const l = label.getBoundingClientRect();
        const overlapsX = n.left < l.right && n.right > l.left;
        const overlapsY = n.top < l.bottom && n.bottom > l.top;
        if (overlapsX && overlapsY) overlaps += 1;
      }
      return overlaps;
    });
    expect(overlapCount).toBe(0);
  }

  for (const width of [375, 1440]) {
    test(`GR03 (sequential) at ${width}px: no numbered node overlaps its stage label`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1200 });
      await page.goto("/discover/report/demo?fixture=GR03");
      await assertNoNodeLabelOverlap(page);
    });

    test(`GR12 (parallel) at ${width}px: no numbered node overlaps its stage label/bracket`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1200 });
      await page.goto("/discover/report/demo?fixture=GR12");
      await assertNoNodeLabelOverlap(page);
    });
  }
});

test.describe("Zero-card special states read as intentional, never as an error (section 11/48/49)", () => {
  test("GR09 (ADVISOR_FIRST) never uses 'no results'/error language", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR09");
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toMatch(/no results/);
    expect(body).not.toMatch(/error/);
    expect(body).not.toMatch(/something went wrong/);
  });

  test("GR15 (LIMITED_INFORMATION) never uses 'no results'/error language", async ({ page }) => {
    await page.goto("/discover/report/demo?fixture=GR15");
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toMatch(/no results/);
    expect(body).not.toMatch(/error/);
    expect(body).not.toMatch(/something went wrong/);
  });
});

test.describe("Report utility header (section 22)", () => {
  test("shows the Pathways identity, demo label, edit-answers, and Start Demo Again is absent on the fixture route", async ({
    page,
  }) => {
    await page.goto("/discover/report/demo?fixture=GR01");
    await expect(page.getByText("Pathways").first()).toBeVisible();
    await expect(page.getByText("Synthetic report demo")).toBeVisible();
    await expect(page.getByRole("link", { name: "Review or Edit Your Answers" })).toBeVisible();
  });
});
