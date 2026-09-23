/**
 * Registry of Asset Pack 2 (product/infographic/conversion) images --
 * see docs/pathways/MEDIA_SOURCE_REGISTER.md "Asset Pack 2" for full
 * provenance, the two banned-phrase corrections applied before use,
 * and why P2-02 (the Discovery Report showcase graphic) is
 * deliberately NOT included here -- its supplied artwork paired a
 * fabricated student photo and first-person quote in a profile-card
 * layout that reads as a testimonial, which this project has
 * consistently declined to use anywhere. That section instead keeps
 * its existing accessible HTML card (`ReportPreviewCard.tsx`).
 *
 * Every image here is a supporting/decorative visual alongside real
 * semantic HTML content -- never the sole carrier of meaningful text,
 * per the Phase 2C accessibility requirement.
 */

export interface MarketingInfographicSlot {
  path: string;
  alt: string;
}

export const MARKETING_INFOGRAPHICS = {
  findYourPath: {
    path: "/pathways/marketing/infographics/01-find-your-path-in-minutes.webp",
    alt: "",
  },
  possibilityToProgress: {
    path: "/pathways/marketing/infographics/03-possibility-to-progress.webp",
    alt: "",
  },
  whatAreYouHopingToMakePossible: {
    path: "/pathways/marketing/infographics/04-what-are-you-hoping-to-make-possible.webp",
    alt: "",
  },
} as const satisfies Record<string, MarketingInfographicSlot>;

export type MarketingInfographicKey = keyof typeof MARKETING_INFOGRAPHICS;
