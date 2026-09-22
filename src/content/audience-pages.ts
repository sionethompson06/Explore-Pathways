import type { GoalInterest } from "./goals";

export interface AudiencePage {
  slug: "athletes" | "homeschool" | "flexible-learning" | "academic-opportunities";
  interest: GoalInterest;
  title: string;
  subtitle: string;
  intro: string;
  points: string[];
}

/**
 * Content for the four approved /pathways/[slug] audience pages
 * (Phase 2 prompt section 5). Each is a focused variant of the same
 * design system and Discovery CTA, not a separate microsite -- no
 * invented provider, statistic, testimonial or accreditation claim.
 */
export const AUDIENCE_PAGES: AudiencePage[] = [
  {
    slug: "athletes",
    interest: "athletics",
    title: "For Student Athletes",
    subtitle: "Fit serious training and competition around a real education.",
    intro:
      "Families balancing athletics with school often face the same question: what arrangement actually leaves room for both? Pathways helps you explore directions that could support your student's training, travel and competition schedule without treating academics as an afterthought.",
    points: [
      "Explore scheduling and delivery models that can flex around practice and travel.",
      "Surface planning questions worth asking about credit tracking and eligibility -- Pathways identifies these, it does not certify eligibility itself.",
      "Keep an athlete's education plan connected to their broader goals, not separated from them.",
    ],
  },
  {
    slug: "homeschool",
    interest: "homeschool_support",
    title: "Homeschool Support",
    subtitle: "Structure and support for families teaching at home.",
    intro:
      "Homeschooling well takes more than a curriculum box -- it takes a workable structure, a support plan, and clarity about what your family is responsible for. Pathways helps you think through what kind of homeschool arrangement could fit your family's life, and what questions to ask before committing to one.",
    points: [
      "Understand different homeschool models, from fully independent to externally supported.",
      "Think through the adult-support plan a homeschool arrangement would actually require.",
      "Get directions for combining homeschooling with outside courses or programs where useful.",
    ],
  },
  {
    slug: "flexible-learning",
    interest: "flexible_schedule",
    title: "Flexible Learning",
    subtitle: "A school day that fits your family's life, not the other way around.",
    intro:
      "Some families need a schedule that isn't the standard school day -- because of work, travel, health, or how a student learns best. Pathways helps you explore arrangements built around flexibility, and the honest tradeoffs each one involves.",
    points: [
      "Explore delivery models -- in-person, online, or hybrid -- built around schedule flexibility.",
      "See what flexibility actually requires from your family, not just what it promises.",
      "Get directions suited to your student's grade level and current situation.",
    ],
  },
  {
    slug: "academic-opportunities",
    interest: "academic_challenge",
    title: "Academic Opportunities",
    subtitle: "Room to go further, where it genuinely fits.",
    intro:
      "When a student is ready for more -- advanced coursework, independent research, or a faster pace in a specific subject -- the right next step isn't always obvious. Pathways helps you explore directions for academic challenge appropriate to your student's actual readiness, not just their age.",
    points: [
      "Explore directions for advanced coursework, independent study, or subject-specific advancement.",
      "Get planning questions to raise with your current school before assuming a change is needed.",
      "Keep expectations honest -- readiness and opportunity are explored, never guaranteed or assessed here.",
    ],
  },
];

export function getAudiencePage(slug: string): AudiencePage | undefined {
  return AUDIENCE_PAGES.find((page) => page.slug === slug);
}
