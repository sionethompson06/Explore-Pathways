import type { MetadataRoute } from "next";

/**
 * Disallows every crawler, everywhere, on every route -- deliberately
 * matching the root layout's `robots: { index: false, follow: false
 * }` page-level metadata. This is a development preview; the Phase 2
 * authorization explicitly withholds public-indexing approval until a
 * separate live-launch decision. Two independent signals (this file
 * and the per-page meta tag) is intentional belt-and-suspenders, not
 * redundancy -- real crawlers check both.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
