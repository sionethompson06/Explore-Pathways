/**
 * Registry of every real-photography slot the Phase 2B visual
 * requirement calls for (see docs/pathways/IMAGE_ASSET_MANIFEST.md
 * for the full spec of each slot: aspect ratio, minimum dimensions,
 * focal subject, text-safe area).
 *
 * `path` is `null` until the owner supplies the actual file under
 * `public/pathways/marketing/`. Every consuming component treats
 * `null` as "photography not yet supplied" and renders its existing
 * illustrated fallback instead -- no layout change is required when a
 * path is filled in, only editing the value below.
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
    path: null,
    alt: "A student standing on a scenic mountain overlook at sunrise, looking out toward the horizon.",
  },
  athleteBasketball: {
    path: null,
    alt: "A student athlete actively training on an outdoor court.",
  },
  academicStudentLaptop: {
    path: null,
    alt: "A student focused on coursework on a laptop in a bright study space.",
  },
  flexibleTravelStudent: {
    path: null,
    alt: "A student studying comfortably in a flexible, travel-friendly setting.",
  },
  studentLifestyle: {
    path: null,
    alt: "A student relaxed and confident in an everyday lifestyle moment.",
  },
  advisorFamily: {
    path: null,
    alt: "An advisor in a warm conversation with a parent and student.",
  },
  finalMountainScenery: {
    path: null,
    alt: "A wide, cinematic mountain landscape at dusk.",
  },
  homeschoolPageHero: {
    path: null,
    alt: "A warm, home-based learning moment between a parent and student.",
  },
  athletePageHero: {
    path: null,
    alt: "A student athlete in focused competition or training.",
  },
  academicPageHero: {
    path: null,
    alt: "A student engaged in advanced academic or college-level learning.",
  },
} as const satisfies Record<string, MarketingPhotoSlot>;

export type MarketingPhotoKey = keyof typeof MARKETING_PHOTOS;
