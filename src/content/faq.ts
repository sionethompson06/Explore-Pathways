import type { FaqItem } from "@/components/marketing/Faq";

/**
 * Homepage FAQ (Phase 2 prompt section 4.G). Answers are scoped to
 * what this build actually is -- no state-specific legal advice, no
 * invented pricing/staffing, no claim this app doesn't support.
 */
export const HOMEPAGE_FAQ: FaqItem[] = [
  {
    question: "Is Pathways a school?",
    answer:
      "No. Pathways is an education pathways exploration and advisory service. It does not operate a school, issue enrollment, or replace your student's current school in this release.",
  },
  {
    question: "Does my child need to change schools?",
    answer:
      "No. Many families keep their current school and add support around it -- tutoring, flexible scheduling, or enrichment. A school change is never assumed, and Pathways never recommends one automatically.",
  },
  {
    question: "Do you support K-4 families?",
    answer:
      "Yes, Pathways is built to support grades K-12. Grades 5-12 are our primary marketing focus, but younger students are welcome, with age-appropriate questions and directions.",
  },
  {
    question: "Is online school the same as homeschool?",
    answer:
      "No, they're different arrangements with different responsibilities and support models. Pathways treats them as distinct options and can help you understand what each would actually involve for your family.",
  },
  {
    question: "What does the Discovery Report establish?",
    answer:
      "It's a preliminary, template-based starting point based on what you share -- directions worth exploring and questions worth asking next. It is not a school placement, an eligibility determination, or a finished academic plan.",
  },
  {
    question: "What requires a deeper professional review?",
    answer:
      "Things like specific program eligibility, credit transfer, special education services, and enrollment requirements need direct review with the relevant school, program or professional -- the Discovery Report identifies these as open questions rather than answering them for you.",
  },
  {
    question: "What services may involve fees?",
    answer:
      "The preliminary Discovery Report itself does not require an account or payment to use. Deeper services -- such as an advisor consultation or a full Student Success Blueprint -- may involve fees where they are actually offered; nothing is charged without being clearly presented first.",
  },
];
