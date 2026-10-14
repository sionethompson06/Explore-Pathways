import { describe, it, expect } from "vitest";
import { loadAndValidateContracts } from "@/lib/contracts";

describe("canonical registry validation", () => {
  const { contracts, validation } = loadAndValidateContracts();

  it("loads every contract file without a schema error", () => {
    expect(contracts.questionBank.questions.length).toBeGreaterThan(0);
    expect(contracts.rules.rules.length).toBeGreaterThan(0);
    expect(contracts.taxonomy.base_models.length).toBeGreaterThan(0);
  });

  it("matches the counts recorded in the Phase 0 corrections and Phase 3E/3F/4 calibration", () => {
    // 39 = 38 original + DISC_020A (DEC-C1). Neither Phase 3E nor Phase 3F
    // adds a new question ID (only wording/option/branch changes and, in
    // Phase 3F, typed "Other" sidecar fields associated with existing
    // questions), so this stays 39. Phase 4 builds a decision engine on top
    // of the existing question bank and adds no new question.
    expect(contracts.questionBank.questions.length).toBe(39);
    // 77 = 62 Phase 3F total + 15 net new Phase 4 rules (DEC-N,
    // PHASE4_DECISION_ENGINE_SPEC_V1.md sections 12-27): SCHED_HIGH_001,
    // SCHED_VERYHIGH_001, DELIVERY_001B, SUPPORT_HIGH_001,
    // SUPPORT_MODERATE_001, SUPPORT_LOW_SELFPACED_001,
    // SUPPORT_LOW_SELFPACED_HOMESCHOOL_001, SUPPORT_HIGH_ONLINE_TRADEOFF,
    // ACAD_ORG_001, ACAD_ENGAGE_001, ACAD_SCIENCE_001, ACAD_ATTENDANCE_001,
    // ACAD_COMMUNICATION_001, OPP_002B, COST_ALIGNMENT_REVIEW.
    expect(contracts.rules.rules.length).toBe(77);
    // 12 retired = 3 Phase 3F total (HOME_003, ADV_003, COST_001) + 9 new
    // Phase 4 retirements: FLEX_001 (-> SCHED_HIGH_001/VERYHIGH_001),
    // PAR_001 (blanket PROGRAM_MANAGES reward, no replacement), IND_002 and
    // CONF_001 (-> support_structure_need-driven rules), ACAD_007 (->
    // ACAD_ORG_001), ATH_002 (dominated by SCHED_HIGH_001/VERYHIGH_001),
    // CURR_001/CURR_002 (-> engine-native B01 continuity function),
    // LEARN_001 (B02/B05/B07 raw-field support_structure evidence
    // confirmed duplicative of the support_structure_need derived fact --
    // see its retired_reason). LEARN_002 stays evaluable but had its own
    // B07 target removed for the same reason, keeping only its B03/B06
    // effect (the only positive support_structure evidence ever available
    // to the virtual family -- see its added_reason).
    expect(contracts.rules.rules.filter((r) => r.status === "RETIRED")).toHaveLength(12);
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
    const evaluable = tampered.rules.rules.find((r) => r.status !== "RETIRED");
    expect(evaluable).toBeDefined();
    evaluable!.when.all.push({
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
    const evaluable = tampered.rules.rules.find((r) => r.status !== "RETIRED");
    expect(evaluable).toBeDefined();
    evaluable!.activate.opportunities.push(reserved!.id);
    const result = validateContracts(tampered);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "RESERVED_OPPORTUNITY_REACHABLE"),
    ).toBe(true);
  });

  it("flags a FEASIBILITY rule with non-empty score_effects (negative control)", async () => {
    const { validateContracts } = await import("@/lib/contracts/validate");
    const tampered = structuredClone(contracts);
    const feasibility = tampered.rules.rules.find(
      (r) => r.status !== "RETIRED" && r.reason_type === "FEASIBILITY",
    );
    expect(feasibility).toBeDefined();
    feasibility!.score_effects = { B05: 2 };
    const result = validateContracts(tampered);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "FEASIBILITY_RULE_HAS_SCORE_EFFECTS"),
    ).toBe(true);
  });

  it("flags an operational field (cost_preference) contributing score (negative control)", async () => {
    const { validateContracts } = await import("@/lib/contracts/validate");
    const tampered = structuredClone(contracts);
    const evaluable = tampered.rules.rules.find((r) => r.status !== "RETIRED");
    expect(evaluable).toBeDefined();
    evaluable!.when.all.push({ field: "cost_preference", op: "eq", value: "PREFER_TUITION_FREE" });
    evaluable!.score_effects = { ...evaluable!.score_effects, B02: 1 };
    const result = validateContracts(tampered);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "OPERATIONAL_FIELD_CONTRIBUTES_SCORE"),
    ).toBe(true);
  });

  it("flags an *_other_text field contributing score (negative control)", async () => {
    const { validateContracts } = await import("@/lib/contracts/validate");
    const tampered = structuredClone(contracts);
    const otherTextField = tampered.questionBank.questions
      .map((q) => q.other_text_field)
      .find((field): field is string => typeof field === "string");
    expect(otherTextField).toBeDefined();
    const evaluable = tampered.rules.rules.find((r) => r.status !== "RETIRED");
    expect(evaluable).toBeDefined();
    evaluable!.when.all.push({ field: otherTextField!, op: "eq", value: "x" });
    evaluable!.score_effects = { ...evaluable!.score_effects, B02: 1 };
    const result = validateContracts(tampered);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "OPERATIONAL_FIELD_CONTRIBUTES_SCORE"),
    ).toBe(true);
  });
});
