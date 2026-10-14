import type { ThemeGridItem } from "@/components/marketing/ThemeGrid";

/**
 * For Partners page content (Phase 2F). Categories are the kinds of
 * organizations Pathways is designed to work alongside -- never a
 * list of actual named partners, since no partnership is confirmed
 * yet (see the page's own "not yet handled" contact note).
 */
export const PARTNER_CATEGORIES = [
  "Athletic Academies",
  "Clubs & Travel Teams",
  "Training Programs",
  "Performing Arts Organizations",
  "Schools",
  "Education Providers",
] as const;

/** The three-role model: who does what, and where Pathways' own responsibility ends. */
export const PARTNER_ROLES: ThemeGridItem[] = [
  {
    icon: "explore",
    title: "Partner Organization",
    body: "Provides specialized training, programming or opportunities.",
  },
  {
    icon: "academic",
    title: "Education Provider",
    body: "Provides instruction, coursework and official academic functions under its own responsibilities.",
  },
  {
    icon: "compass",
    title: "Pathways",
    body: "Helps families coordinate education planning, options and support.",
  },
];
