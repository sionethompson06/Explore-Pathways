import type { GoalInterest } from "./goals";
import type { ThemeIconKey } from "@/components/marketing/ThemeGrid";

export interface AudienceTheme {
  icon: ThemeIconKey;
  title: string;
  body: string;
}

export interface AudiencePage {
  slug: "athletes" | "homeschool" | "flexible-learning" | "academic-opportunities";
  interest: GoalInterest;
  title: string;
  subtitle: string;
  /** A short, punchy approved phrase for the page hero -- see docs/pathways/IMAGE_ASSET_MANIFEST.md. */
  tagline?: string;
  intro: string;
  /** Phase 2F: the visual theme grid replacing the old plain bullet list. */
  themes: AudienceTheme[];
  /** A short, honest scope note shown below the theme grid -- never a promise this page can't back. */
  caveat: string;
}

/**
 * Content for the four approved /pathways/[slug] audience pages
 * (Phase 2 prompt section 5, revised in Phase 2F). Each is a focused
 * variant of the same design system and Discovery CTA, not a separate
 * microsite -- no invented provider, statistic, testimonial or
 * accreditation claim.
 */
export const AUDIENCE_PAGES: AudiencePage[] = [
  {
    slug: "athletes",
    interest: "athletics",
    title: "For Student Athletes",
    subtitle:
      "Your student shouldn't have to choose between serious athletic development and a strong education.",
    tagline: "Train. Compete. Learn. Graduate.",
    intro:
      "Families balancing athletics with school often face the same question: what arrangement actually leaves room for both? Pathways helps you explore directions that could support your student's training, travel and competition schedule without treating academics as an afterthought.",
    themes: [
      {
        icon: "schedule",
        title: "More Flexibility",
        body: "Create room for training, travel and competition.",
      },
      {
        icon: "compass",
        title: "Academic Direction",
        body: "Keep academics connected to the student's larger goals.",
      },
      {
        icon: "plan",
        title: "College-Athletic Planning",
        body: "Identify academic questions that matter when college athletics may be part of the future.",
      },
      {
        icon: "support",
        title: "Personalized Support",
        body: "Explore how schooling and support could fit around the athlete.",
      },
    ],
    caveat:
      "Pathways helps identify academic questions worth raising with your school or program -- it does not certify NCAA eligibility, guarantee recruiting outcomes, or determine admission.",
  },
  {
    slug: "homeschool",
    interest: "homeschool_support",
    title: "Homeschool Support",
    subtitle: "We help you build the structure and support to make that flexibility work.",
    tagline:
      "Homeschooling gives families tremendous flexibility — but building the right academic structure can still be complicated.",
    intro:
      "Pathways helps you think through what kind of homeschool arrangement could fit your family's life -- what structure you'd want in place, what support you'd want around it, and what questions to ask before committing to one.",
    themes: [
      {
        icon: "plan",
        title: "Learning Structure",
        body: "Think through how each day and week could actually be organized.",
      },
      {
        icon: "academic",
        title: "Curriculum & Course Options",
        body: "Explore curriculum and course directions that fit your student.",
      },
      {
        icon: "support",
        title: "Academic Support",
        body: "Identify where outside support or accountability could help.",
      },
      {
        icon: "schedule",
        title: "Schedule",
        body: "Build a rhythm that works for your family, not just a district calendar.",
      },
      {
        icon: "discover",
        title: "Enrichment",
        body: "Add enrichment, electives or outside programs where useful.",
      },
      {
        icon: "advance",
        title: "Longer-Term Planning",
        body: "Keep an eye on where this path leads as your student grows.",
      },
    ],
    caveat:
      "Pathways helps you think through your options -- it does not determine or certify compliance with your state's homeschool requirements.",
  },
  {
    slug: "flexible-learning",
    interest: "flexible_schedule",
    title: "Flexible Learning",
    subtitle:
      "For families balancing athletics, travel, performing arts, family schedules or other commitments, the traditional school day isn't always the only option.",
    tagline: "Learning That Fits Real Life.",
    intro:
      "Some families need a schedule that isn't the standard school day -- because of athletics, travel, performing arts, or how a student learns best. Pathways helps you explore arrangements built around flexibility, and the honest tradeoffs each one involves.",
    themes: [
      {
        icon: "discover",
        title: "Online",
        body: "Fully online coursework with structure and pacing built in.",
      },
      {
        icon: "explore",
        title: "Hybrid",
        body: "A mix of online and in-person learning.",
      },
      {
        icon: "homeschool",
        title: "Home-Based",
        body: "A home-based arrangement built around your family's schedule.",
      },
      {
        icon: "support",
        title: "Current School + Support",
        body: "Stay at your current school and add flexibility around it.",
      },
    ],
    caveat:
      "These are directions to explore, not programs guaranteed to be available in every area.",
  },
  {
    slug: "academic-opportunities",
    interest: "academic_challenge",
    title: "Academic Opportunities",
    subtitle:
      "When a student is ready for greater challenge, the next step should match both their goals and demonstrated readiness.",
    tagline: "Ready for More?",
    intro:
      "When a student is ready for more -- advanced coursework, independent research, or a faster pace in a specific subject -- the right next step isn't always obvious. Pathways helps you explore directions for academic challenge appropriate to your student's actual readiness, not just their age.",
    themes: [
      {
        icon: "academic",
        title: "Advanced Coursework",
        body: "Explore advanced coursework in subjects where your student is ready to go further.",
      },
      {
        icon: "check",
        title: "Honors / AP",
        body: "Consider honors or AP-level courses where they're genuinely a fit.",
      },
      {
        icon: "advance",
        title: "Subject Acceleration",
        body: "Explore moving faster in one subject without accelerating everything at once.",
      },
      {
        icon: "plan",
        title: "Dual Enrollment",
        body: "Review dual enrollment options alongside your current school's requirements.",
      },
      {
        icon: "compass",
        title: "College Coursework",
        body: "Consider college-level coursework directions as your student gets older.",
      },
      {
        icon: "explore",
        title: "Independent Research / Enrichment",
        body: "Explore independent research, projects or enrichment beyond the standard course list.",
      },
    ],
    caveat:
      "Readiness is explored together with your student's actual work, not assumed from interest alone.",
  },
];

export function getAudiencePage(slug: string): AudiencePage | undefined {
  return AUDIENCE_PAGES.find((page) => page.slug === slug);
}
