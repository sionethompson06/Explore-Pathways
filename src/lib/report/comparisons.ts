import type { ReportContent } from "@/lib/contracts/schemas";
import type { ComparisonGuideSection, ComparisonQuestion, ReportArchetype, ReportAssemblyProfileContext } from "./types";
import { provenance } from "./provenance";

const TITLE = "WHAT TO LOOK FOR AS YOU COMPARE OPTIONS";
const MAX_QUESTIONS = 6;

/**
 * R05 -- Comparison Guide (section 21). Archetype-curated base
 * questions, plus at most one authorized non-decision profile-context
 * question (section 23: currently only costPreference =
 * PREFER_TUITION_FREE, carrying PROFILE_CONTEXT:cost_preference
 * provenance) -- never a second rules engine, never able to change a
 * candidate, its order, or its fit label.
 */
export function buildComparisonGuideSection(
  archetype: ReportArchetype,
  archetypeContent: Record<string, unknown>,
  profile: ReportAssemblyProfileContext,
  reportContent: ReportContent,
): ComparisonGuideSection {
  const baseQuestions = (archetypeContent["r05_questions"] as string[] | undefined) ?? [];
  const baseExplanations = (archetypeContent["r05_explanations"] as string[] | undefined) ?? [];

  const questions: ComparisonQuestion[] = baseQuestions.map((question, index) => ({
    id: `R05__${archetype}__${index}`,
    question,
    explanation: baseExplanations[index] ?? "",
    provenance: provenance(`R05__${archetype}__${index}`),
  }));

  if (profile.costPreference) {
    const contextKey = `cost_preference:${profile.costPreference}`;
    const contextQuestion = reportContent.feasibility_context_questions[contextKey];
    if (contextQuestion && questions.length < MAX_QUESTIONS) {
      questions.push({
        id: "R05__PROFILE_CONTEXT_COST",
        question: contextQuestion.question,
        explanation: contextQuestion.explanation,
        provenance: provenance("R05__PROFILE_CONTEXT_COST", { profileContextIds: [contextKey] }),
      });
    }
  }

  return { title: TITLE, questions: questions.slice(0, MAX_QUESTIONS) };
}
