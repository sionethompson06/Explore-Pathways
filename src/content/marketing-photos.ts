/**
 * Registry of every real-photography slot the Phase 2B visual
 * requirement calls for (see docs/pathways/IMAGE_ASSET_MANIFEST.md
 * for the full spec of each slot: aspect ratio, minimum dimensions,
 * focal subject, text-safe area).
 *
 * The owner supplied the approved generated asset pack referenced
 * below (`pathways_marketing_asset_pack_v1`); every path here now
 * points at the corresponding file under `public/pathways/marketing/`.
 * Two of the nine images (01, 02) were corrected before use -- see
 * docs/pathways/MEDIA_SOURCE_REGISTER.md "Trademark correction" for
 * why and exactly what changed. Every consuming component still
 * treats `path: null` as "photography not yet supplied" and renders
 * its illustrated fallback instead, so a future slot can be filled in
 * here with no layout change.
 */

export interface MarketingPhotoSlot {
  /** Path under /public once supplied, e.g. "/pathways/marketing/hero-student-mountain.jpg". */
  path: string | null;
  /**
   * Accessible alt text describing the scene. Must never name a real
   * Pathways student, parent, employee, or attach an outcome/claim --
   * see IMAGE_ASSET_MANIFEST.md "Generated / fictional people" rules.
   */
  alt: string;
}

export const MARKETING_PHOTOS = {
  heroStudentMountain: {
    path: "/pathways/marketing/photography/01-homepage-hero-student-mountain.webp",
    alt: "A student overlooking a mountain and lake landscape at sunrise.",
  },
  athleteBasketball: {
    path: "/pathways/marketing/photography/02-freedom-train-more-athlete.webp",
    alt: "A student athlete training with a basketball outdoors at sunset.",
  },
  academicStudentLaptop: {
    path: "/pathways/marketing/photography/03-freedom-get-ahead-student-laptop.webp",
    alt: "A student studying on a laptop in a bright learning space.",
  },
  flexibleTravelStudent: {
    path: "/pathways/marketing/photography/04-freedom-learn-anywhere-travel-student.webp",
    alt: "A student using a laptop while traveling in a scenic location.",
  },
  studentLifestyle: {
    path: "/pathways/marketing/photography/05-freedom-take-back-time-student.webp",
    alt: "A student outdoors at sunset with a mountain view.",
  },
  advisorFamily: {
    path: "/pathways/marketing/photography/06-human-support-advisor-parent.webp",
    alt: "Two adults having a warm conversation over an education plan.",
  },
  finalMountainScenery: {
    path: "/pathways/marketing/photography/09-final-cta-mountain-landscape.webp",
    alt: "A mountain lake landscape at sunset.",
  },
  homeschoolPageHero: {
    path: "/pathways/marketing/photography/07-homeschool-support-family-learning.webp",
    alt: "A parent supporting a student learning at home.",
  },
  athletePageHero: {
    path: "/pathways/marketing/photography/02-freedom-train-more-athlete.webp",
    alt: "A student athlete training with a basketball outdoors at sunset.",
  },
  academicPageHero: {
    path: "/pathways/marketing/photography/08-academic-opportunities-campus-student.webp",
    alt: "A student carrying a laptop on a college campus.",
  },
} as const satisfies Record<string, MarketingPhotoSlot>;

export type MarketingPhotoKey = keyof typeof MARKETING_PHOTOS;
