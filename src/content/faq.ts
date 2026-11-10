import type { FaqItem } from "@/components/marketing/Faq";

/**
 * Homepage FAQ (Phase 2 prompt section 4.G, tone revised Phase 2F).
 * Answers lead with what's possible and keep necessary qualifications
 * brief and welcoming, rather than opening with "No." -- but every
 * qualification from the original copy is still here: no invented
 * pricing/staffing, no claim this build doesn't support, no
 * state-specific legal advice.
 */
export const HOMEPAGE_FAQ: FaqItem[] = [
  {
    question: "Is Pathways a school?",
    answer:
      "Pathways is an education pathways and planning service. We help families explore different ways to structure a student's education. The right pathway may involve the current school, another school, homeschool, online learning, supplemental programs or a combination.",
  },
  {
    question: "Does my child need to change schools?",
    answer:
      "Not necessarily. For some students, the right pathway may involve keeping the current school and adding support, enrichment or other opportunities. A school change is one possibility, not the default.",
  },
  {
    question: "Do you support K-4 families?",
    answer:
      "Yes -- Pathways is built to support grades K-12. Grades 5-12 are our primary focus, with younger students welcome too, through age-appropriate questions and directions.",
  },
  {
    question: "Is online school the same as homeschool?",
    answer:
      "They're related but different arrangements, each with its own responsibilities and support model. Pathways treats them as distinct options and can help you understand what each would actually involve for your family.",
  },
  {
    question: "What does the Discovery Report establish?",
    answer:
      "It's a preliminary, personalized starting point -- directions worth exploring and questions worth asking next, based on what you share. It's a starting point, not a school placement, an eligibility determination, or a finished academic plan.",
  },
  {
    question: "What requires a deeper professional review?",
    answer:
      "A few things -- specific program eligibility, credit transfer, special education services, and enrollment requirements -- are best worked through directly with the relevant school, program or professional. The Discovery Report surfaces these as open questions to raise, rather than answering them for you.",
  },
  {
    question: "What services may involve fees?",
    answer:
      "The preliminary Discovery Report is free to use, with no account required. Deeper services -- like an advisor consultation or a full Student Success Blueprint -- may involve fees where they're actually offered, always presented clearly before anything is charged.",
  },
];
