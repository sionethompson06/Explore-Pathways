import { describe, it, expect } from "vitest";
import { loadContracts } from "@/lib/contracts/loader";

/**
 * Forbidden-copy tests (PHASE5_DISCOVERY_REPORT_SPEC_V1.md section 65).
 * Scans approved report-content.json for case-insensitive occurrences
 * of ranking/urgency/guarantee language. Semantic care, not a naive
 * ban on the word "fit" -- "educational fit and affordability are
 * different questions" is descriptive, never a ranking claim.
 */

const FORBIDDEN_PHRASES = [
  "best fit",
  "perfect fit",
  "% match",
  "guaranteed eligibility",
  "guaranteed scholarship",
  "guaranteed graduation",
  "guaranteed credit",
  "spots are filling",
  "act now",
  "don't miss out",
];

describe("Forbidden report copy", () => {
  const contracts = loadContracts();
  // Scan the approved COPY only -- report-content.json's own forbidden_claims
  // array legitimately documents these phrases as forbidden and must not
  // itself trip the scan (the same "one self-reference is fine" pattern
  // src/lib/contracts/validate.ts's REPORT_FORBIDDEN_CLAIM_PRESENT check uses).
  const { forbidden_claims: _forbiddenClaims, ...approvedCopyOnly } = contracts.reportContent;
  const contentJson = JSON.stringify(approvedCopyOnly);
  const lowered = contentJson.toLowerCase();

  it.each(FORBIDDEN_PHRASES)('never contains the forbidden phrase "%s"', (phrase) => {
    expect(lowered).not.toContain(phrase.toLowerCase());
  });

  it("contracts/report-content.json's own forbidden_claims list documents every phrase checked here", () => {
    const declared = contracts.reportContent.forbidden_claims.map((c) => c.toLowerCase());
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(declared.some((d) => d.includes(phrase.toLowerCase()) || phrase.toLowerCase().includes(d))).toBe(true);
    }
  });

  it('allows ordinary descriptive uses of the word "fit" that are not ranking claims', () => {
    expect(lowered).toContain("educational fit and affordability are different questions");
  });

  it("never claims a fabricated urgency/scarcity device", () => {
    expect(lowered).not.toMatch(/countdown/);
    expect(lowered).not.toMatch(/limited time/);
    expect(lowered).not.toMatch(/only \d+ (spots|seats) left/);
  });

  it("never claims a hard-forbidden public outcome (section 51)", () => {
    const HARD_FORBIDDEN = [
      "college admission guarantee",
      "ncaa eligibility guarantee",
      "recruiting probability",
      "scholarship likelihood",
      "diagnosis",
      "intelligence assessment",
    ];
    for (const phrase of HARD_FORBIDDEN) {
      expect(lowered).not.toContain(phrase);
    }
  });

  it("never presents a numeric ranking (top match / best choice / ranked #N)", () => {
    expect(lowered).not.toMatch(/top match/);
    expect(lowered).not.toMatch(/best choice/);
    expect(lowered).not.toMatch(/ranked #\d/);
  });
});
