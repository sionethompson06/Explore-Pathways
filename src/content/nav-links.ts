/**
 * The site's implemented public routes, in one place, so the header,
 * footer and sitemap can never link to something that isn't real.
 * Every entry here must correspond to an actual route in app/.
 */
export const PRIMARY_NAV_LINKS = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/for-partners", label: "For Partners" },
] as const;

/** Order matches the approved Education Pathways dropdown / mobile group order (Phase 2F). */
export const AUDIENCE_LINKS = [
  { href: "/pathways/athletes", label: "Student Athletes" },
  { href: "/pathways/flexible-learning", label: "Flexible Learning" },
  { href: "/pathways/homeschool", label: "Homeschool Support" },
  { href: "/pathways/academic-opportunities", label: "Academic Opportunities" },
] as const;

export const FOOTER_LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

export const DISCOVER_HREF = "/discover";
export const PRIMARY_CTA_LABEL = "Find My Student's Pathway";
export const SECONDARY_CTA_LABEL = "See How It Works";

/** The header/mobile-nav CTA specifically (Phase 2F) -- shorter than PRIMARY_CTA_LABEL, which other page CTAs (hero, audience pages) keep unchanged. */
export const NAV_CTA_LABEL = "Find My Pathway";

/** Label for the Education Pathways dropdown/disclosure in the header and mobile nav. */
export const EDUCATION_PATHWAYS_LABEL = "Education Pathways";
