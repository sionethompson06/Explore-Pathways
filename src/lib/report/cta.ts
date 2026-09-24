import type { ReportContent } from "@/lib/contracts/schemas";
import type { ConsultationState, ConversionSection, ReportAction, ReportActions, ReportArchetype } from "./types";

/** Safe, real, already-existing informational destination -- never a fabricated booking/advisor page (section 29). */
const SAFE_INFORMATIONAL_HREF = "/how-it-works";
const EDIT_ANSWERS_HREF = "/discover/profile";

/**
 * Operationally-safe CTA resolution (section 29). The marketing
 * intent label (what the button SAYS) is always archetype-driven;
 * the actual destination/behavior (what the button DOES) is resolved
 * separately from `operational.consultationState` so the two can
 * never drift into implying something that has not actually happened
 * -- no state here ever claims an appointment booked, an advisor
 * assigned, or a plan already created.
 */
export function resolvePrimaryAction(
  consultationState: ConsultationState,
  intentLabel: string,
  reportContent: ReportContent,
): ReportAction {
  if (consultationState === "LIVE_VERIFIED") {
    return { label: intentLabel, href: SAFE_INFORMATIONAL_HREF, operationallySafe: true };
  }
  if (consultationState === "REQUEST_ONLY") {
    const label = (reportContent.cta_templates["REQUEST_ONLY"] as { label?: string } | undefined)?.label ??
      "Request a Pathways Planning Call";
    return { label, href: SAFE_INFORMATIONAL_HREF, operationallySafe: true };
  }
  const label = (reportContent.cta_templates["UNCONFIGURED"] as { label?: string } | undefined)?.label ??
    "See What Comes Next";
  return { label, href: SAFE_INFORMATIONAL_HREF, operationallySafe: true };
}

export function buildActions(
  consultationState: ConsultationState,
  saveAvailable: boolean,
  intentLabel: string,
  reportContent: ReportContent,
): { primary: ReportAction; editAnswers: ReportAction; save?: ReportAction } {
  return {
    primary: resolvePrimaryAction(consultationState, intentLabel, reportContent),
    editAnswers: { label: "Review or Edit Your Answers", href: EDIT_ANSWERS_HREF, operationallySafe: true },
    ...(saveAvailable ? { save: { label: "Save This Report", href: EDIT_ANSWERS_HREF, operationallySafe: true } } : {}),
  };
}

/** R07 -- Conversion (section 27). Marketing content -- must remain accurate; no fabricated urgency or testimonials. */
export function buildConversionSection(
  archetype: ReportArchetype,
  archetypeContent: Record<string, unknown>,
  reportContent: ReportContent,
): ConversionSection {
  return {
    headline: archetypeContent["r07_headline"] as string,
    body: archetypeContent["r07_body"] as string,
    valueConcepts: reportContent.conversion_value_concepts,
    ctaIntentLabel: archetypeContent["cta_intent_label"] as string,
  };
}

export type { ReportActions };
