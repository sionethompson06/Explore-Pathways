import type { MetadataRoute } from "next";
import { env } from "@/env";
import { AUDIENCE_PAGES } from "@/content/audience-pages";

/**
 * The sitemap *structure* the Phase 2 authorization asked to be
 * prepared -- not an authorization to index. app/robots.ts disallows
 * every crawler from every route in this development preview, so
 * this file has no practical indexing effect yet; it exists so the
 * structure is ready and reviewable before a separate live-launch
 * decision lifts that disallow. Uses the app's own configured
 * BETTER_AUTH_URL as the base (the only base URL this app actually
 * has -- http://localhost:3000 in dev/CI), never a claimed production
 * domain that doesn't exist.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.BETTER_AUTH_URL.replace(/\/$/, "");
  const staticRoutes = ["/", "/how-it-works", "/for-partners", "/discover", "/privacy", "/terms"];
  const audienceRoutes = AUDIENCE_PAGES.map((page) => `/pathways/${page.slug}`);

  return [...staticRoutes, ...audienceRoutes].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
}
