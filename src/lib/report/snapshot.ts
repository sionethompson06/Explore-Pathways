import type { ReportContent } from "@/lib/contracts/schemas";
import type { PriorityChip, ReportArchetype, ReportAssemblyProfileContext, SnapshotSection } from "./types";
import { provenance } from "./provenance";

const EYEBROW = "YOUR DISCOVERY REPORT";

function titleCaseFallback(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => (word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1)))
    .join(" ");
}

function educationalChipLabel(reportContent: ReportContent, value: string): string {
  return reportContent.priority_chip_labels[value] ?? titleCaseFallback(value);
}

function feasibilityChipLabel(reportContent: ReportContent, costPreference: string): string | undefined {
  return reportContent.feasibility_chip_labels[costPreference];
}

/**
 * R01 -- Your Discovery Snapshot (section 11) + priority chips
 * (section 12). Max 4 chips total: up to 3 educational (family
 * priorities, falling back to the primary reason / desired change
 * when distinct and useful) plus one visually-distinct feasibility
 * chip. ADVISOR_FIRST/LIMITED_INFORMATION archetypes use their own
 * single archetype-level chip instead (section 58/61's "Grade &
 * Placement Planning" / "Exploring What's Possible").
 */
export function buildSnapshotSection(
  archetype: ReportArchetype,
  archetypeContent: Record<string, unknown>,
  profile: ReportAssemblyProfileContext,
  reportContent: ReportContent,
): SnapshotSection {
  const reportTitle = profile.studentDisplayName
    ? `${profile.studentDisplayName}'s Discovery Report`
    : "Your Student's Discovery Report";

  const singleArchetypeChip = archetypeContent["r01_priority_chip"] as string | undefined;
  const chips: PriorityChip[] = [];

  if (singleArchetypeChip) {
    chips.push({ id: "ARCHETYPE_CHIP", label: singleArchetypeChip, kind: "EDUCATIONAL" });
  } else {
    const seen = new Set<string>();
    for (const value of profile.selectedFamilyPriorities) {
      if (value === "UNKNOWN" || chips.length >= 3) continue;
      const label = educationalChipLabel(reportContent, value);
      if (seen.has(label)) continue;
      seen.add(label);
      chips.push({ id: `PRIORITY:${value}`, label, kind: "EDUCATIONAL" });
    }
    const supplementalCandidates: (string | undefined)[] = [profile.primaryDiscoveryReason, profile.desiredPrimaryChange];
    for (const value of supplementalCandidates) {
      if (!value || value === "UNKNOWN" || chips.length >= 3) continue;
      const label = educationalChipLabel(reportContent, value);
      if (seen.has(label)) continue;
      seen.add(label);
      chips.push({ id: `SUPPLEMENTAL:${value}`, label, kind: "EDUCATIONAL" });
    }
  }

  if (profile.costPreference && profile.costPreference !== "UNKNOWN" && chips.length < 4) {
    const label = feasibilityChipLabel(reportContent, profile.costPreference);
    if (label && profile.costPreference === "PREFER_TUITION_FREE") {
      chips.push({ id: `FEASIBILITY:${profile.costPreference}`, label, kind: "FEASIBILITY" });
    }
  }

  return {
    eyebrow: EYEBROW,
    reportTitle,
    headline: archetypeContent["r01_headline"] as string,
    summary: archetypeContent["r01_summary"] as string,
    chips: chips.slice(0, 4),
    scopeStatement: reportContent.scope_statement,
    statusBadge: archetypeContent["r01_status_badge"] as string | undefined,
    provenance: provenance(`SNAPSHOT__${archetype}`, {
      profileContextIds: [
        ...profile.selectedFamilyPriorities.map((v) => `family_priorities:${v}`),
        ...(profile.costPreference ? [`cost_preference:${profile.costPreference}`] : []),
      ],
    }),
  };
}
