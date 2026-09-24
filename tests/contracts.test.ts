import { describe, it, expect } from "vitest";
import { loadAndValidateContracts } from "@/lib/contracts";

describe("canonical registry validation", () => {
  const { contracts, validation } = loadAndValidateContracts();

  it("loads every contract file without a schema error", () => {
    expect(contracts.questionBank.questions.length).toBeGreaterThan(0);
    expect(contracts.rules.rules.length).toBeGreaterThan(0);
    expect(contracts.taxonomy.base_models.length).toBeGreaterThan(0);
  });

  it("matches the counts recorded in the Phase 0 corrections and Phase 3E/3F calibration", () => {
    // 39 = 38 original + DISC_020A (DEC-C1). Neither Phase 3E nor Phase 3F
    // adds a new question ID (only wording/option/branch changes and, in
    // Phase 3F, typed "Other" sidecar fields associated with existing
    // questions), so this stays 39.
    expect(contracts.questionBank.questions.length).toBe(39);
    // 62 = 60 Phase 3E total + ADV_014/ADV_015 (Phase 3F: the combined
    // HONORS_AP and CAREER_CTE_CREDENTIALS cards). 3 retired, unchanged
    // from Phase 3E = 1 Phase 0 (HOME_003) + ADV_003 (merged into ADV_004)
    // + COST_001 (DEC-H2: cost is feasibility, never a base-model score
    // input).
    expect(contracts.rules.rules.length).toBe(62);
    expect(contracts.rules.rules.filter((r) => r.status === "RETIRED")).toHaveLength(3);
    // 17 = 14 original + FX15-FX17 (DEC-C7).
  });

  it("has no unknown rule fields, no unknown activated IDs, no duplicate IDs", () => {
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
  });

  it("has no unexpected reachability warnings beyond the documented exceptions", () => {
    expect(validation.warnings).toEqual([]);
  });

  it("never marks B10 as reachable", () => {
    const b10 = contracts.taxonomy.base_models.find((m) => m.id === "B10");
    expect(b10?.reachability_status).toBe("EXCLUDED");
    expect(b10?.discovery_enabled).toBe(false);
    const evaluableRules = contracts.rules.rules.filter(
      (r) => r.status !== "RETIRED",
    );
    for (const rule of evaluableRules) {
      expect(Object.keys(rule.score_effects)).not.toContain("B10");
    }
  });

  it("flags an injected unknown field as a validation error (negative control)", async () => {
    const { validateContracts } = await import("@/lib/contracts/validate");
    const tampered = structuredClone(contracts);
    tampered.rules.rules[0]!.when.all.push({
      field: "not_a_real_field",
      op: "eq",
      value: "x",
    });
    const result = validateContracts(tampered);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "RULE_UNKNOWN_FIELD")).toBe(
      true,
    );
  });

  it("flags a reachable RESERVED opportunity as a validation error (negative control)", async () => {
    const { validateContracts } = await import("@/lib/contracts/validate");
    const tampered = structuredClone(contracts);
    const reserved = tampered.taxonomy.opportunities.find(
      (o) => o.reachability_status === "RESERVED",
    );
    expect(reserved).toBeDefined();
    tampered.rules.rules[0]!.activate.opportunities.push(reserved!.id);
    const result = validateContracts(tampered);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "RESERVED_OPPORTUNITY_REACHABLE"),
    ).toBe(true);
  });
});
