import type { Metadata } from "next";
import { mapMarketingInterestToHint } from "@/lib/discovery/marketing-hint";
import { DiscoveryDemoQuestionnaire } from "@/components/discovery/DiscoveryDemoQuestionnaire";
import { Section } from "@/components/marketing/Section";
import { buildDemoDiscoveryReport, commitDemoAnswer, computeDemoState, validateDemoCompletion } from "./actions";

export const metadata: Metadata = {
  title: "Discovery Preview Demo",
  description: "Click through the Pathways Discovery questionnaire experience -- nothing is saved.",
  robots: { index: false, follow: false },
};

/**
 * Preview Demo Mode's entry point (Phase 3C). Deliberately DB-free:
 * no `cookies()`, no `@/db/client`, no `@/server/session`, no
 * `@/server/discovery-draft` anywhere in this file's import graph, so
 * this route never performs a database call and renders identically
 * whether or not a hosted Preview database exists. The only state
 * that exists anywhere is the empty starting snapshot computed below
 * and whatever the client component (React memory only) builds on
 * top of it after that -- a page refresh always restarts here.
 *
 * The homepage/marketing `?interest=` handoff is honored exactly like
 * the real /discover entry point (DEC-G6): converted to an editable
 * DISC_006 preselection hint, never written anywhere as if it were an
 * already-saved answer.
 */
export default async function DiscoveryDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ interest?: string | string[] }>;
}) {
  const resolvedParams = await searchParams;
  const rawInterest = Array.isArray(resolvedParams.interest)
    ? resolvedParams.interest[0]
    : resolvedParams.interest;
  const interestHint = mapMarketingInterestToHint(
    typeof rawInterest === "string" ? rawInterest : undefined,
  );

  const initialState = await computeDemoState({}, "STUDENT", interestHint);

  return (
    <Section tone="default" ariaLabelledBy="discovery-demo-heading">
      {/* Phase 5.1a (DEC-Q7): a non-heading landmark label, not an H1 --
          this route's actual H1 lives inside DiscoveryDemoQuestionnaire
          itself (visually-hidden while questionnaire/Review is showing,
          absent once a report renders, so the ReportHero's own H1
          becomes the page's sole H1 then). aria-labelledby only needs
          an element with an accessible name, not a heading. */}
      <span id="discovery-demo-heading" className="visually-hidden">
        Discovery Preview Demo
      </span>
      {/* Phase 5.1: NOT `narrow` -- the questionnaire constrains its own
          width (DiscoveryQuestionnaire.module.css .wrapper), so a generated
          report can render at the full premium Phase 5 report width
          instead of being squeezed into the questionnaire's prose column. */}
      <DiscoveryDemoQuestionnaire
        initialState={initialState}
        interestHint={interestHint}
        computeState={computeDemoState}
        commitAnswer={commitDemoAnswer}
        validateCompletion={validateDemoCompletion}
        buildReport={buildDemoDiscoveryReport}
      />
    </Section>
  );
}
