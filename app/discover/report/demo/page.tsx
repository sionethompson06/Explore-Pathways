import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { Section } from "@/components/marketing/Section";
import { ReportView } from "@/components/report/ReportView";
import { fixturePaths, loadContracts } from "@/lib/contracts/loader";
import { validateCompletedProfile } from "@/lib/discovery/validation";
import type { RawAnswers } from "@/lib/discovery/types";
import { evaluateDiscoveryProfile } from "@/lib/engine/evaluate";
import { assembleDiscoveryReport } from "@/lib/report/assemble";
import { buildReportProfileContext } from "@/lib/report/profile-context";

export const metadata: Metadata = {
  title: "Synthetic Discovery Report Demo",
  description: "A DB-free visual QA demo of the Phase 5 Discovery Report using owner-calibrated golden fixtures.",
  robots: { index: false, follow: false },
};

/**
 * DB-free synthetic report demo (PHASE5_DISCOVERY_REPORT_SPEC_V1.md
 * section 39/66). Exists so the report can be visually reviewed
 * without a live Postgres session (DEC-G9). Only a fixed set of
 * fixture IDs is ever accepted -- no arbitrary payload in the URL --
 * and the SAME report assembler and SAME report components as
 * production render it; fixtures/golden-reports.json is the
 * expectation source for tests, never a pre-rendered snapshot this
 * route reads from.
 */
const FIXTURE_TO_PERSONA: Record<string, string> = {
  GR01: "P01",
  GR03: "P03",
  GR06: "P06",
  GR09: "P09",
  GR12: "P12",
  GR14: "P14",
  GR15: "P15",
};
const KNOWN_FIXTURE_IDS = Object.keys(FIXTURE_TO_PERSONA);
const DEFAULT_FIXTURE_ID = "GR01";

export default async function DiscoveryReportDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string | string[] }>;
}) {
  const resolved = await searchParams;
  const rawFixture = Array.isArray(resolved.fixture) ? resolved.fixture[0] : resolved.fixture;
  const fixtureId = KNOWN_FIXTURE_IDS.includes(rawFixture ?? "") ? rawFixture! : DEFAULT_FIXTURE_ID;
  const personaId = FIXTURE_TO_PERSONA[fixtureId]!;

  const goldenProfiles = JSON.parse(readFileSync(fixturePaths.goldenProfiles, "utf-8")) as {
    personas: { id: string; raw: RawAnswers }[];
  };
  const persona = goldenProfiles.personas.find((p) => p.id === personaId)!;

  const contracts = loadContracts();
  const validation = validateCompletedProfile(persona.raw);
  if (!validation.ok || !validation.effective) {
    throw new Error(`Golden fixture ${personaId} no longer validates against the current contracts.`);
  }
  const evaluation = evaluateDiscoveryProfile(validation.effective, contracts);

  const profile = buildReportProfileContext({
    rawAnswers: persona.raw as Record<string, unknown>,
    profileRevisionId: `demo_${fixtureId}`,
    gradeBand: evaluation.derivedFacts.grade_band,
  });
  const report = assembleDiscoveryReport(
    {
      profile,
      engine: evaluation,
      operational: { consultationState: "UNCONFIGURED", saveAvailable: false },
    },
    contracts,
    "2026-01-01T00:00:00.000Z",
  );

  return (
    <>
      <Section tone="alt" ariaLabelledBy="demo-selector-heading">
        <h1 id="demo-selector-heading" className="visually-hidden">
          Discovery Report Demo Fixture Selector
        </h1>
        <nav aria-label="Golden report fixture selector" style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          {KNOWN_FIXTURE_IDS.map((id) => (
            <a
              key={id}
              href={`/discover/report/demo?fixture=${id}`}
              aria-current={id === fixtureId ? "page" : undefined}
              style={{
                padding: "var(--space-2) var(--space-4)",
                borderRadius: "var(--radius-full)",
                fontWeight: 600,
                textDecoration: "none",
                color: id === fixtureId ? "var(--color-white)" : "var(--color-text)",
                background: id === fixtureId ? "var(--color-accent-strong)" : "var(--color-white)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              {id}
            </a>
          ))}
        </nav>
      </Section>
      <ReportView report={report} demoLabel="Synthetic report demo" />
    </>
  );
}
