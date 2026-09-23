# Pathways Marketing Site — Media Source Register

Version: 2.1.0-phase2b-photography-required
Per the Phase 2 authorization section 3 and `docs/pathways/DECISION_LOG.md` DEC-D6 (media usage rights are a launch decision, not resolved by this phase): this document records every visual asset used on the public marketing site and its actual rights status. It exists so nothing here is ever mistaken for cleared, licensed production photography.

**Owner clarification (this revision):** the owner has explicitly confirmed that photography and people-centered visual storytelling are **not optional future enhancements** -- they are a required part of the approved Phase 2B design, and the target is that the live site's emotional impact should strongly resemble the supplied concept renderings, not merely match their colors and layout. Everything below describing the current illustrated treatment as a "substitute" or "placeholder" means exactly that: a **temporary development state**, not the intended final design. **Phase 2B visual acceptance is explicitly NOT considered complete while any required photography slot remains unfilled** -- see `IMAGE_ASSET_MANIFEST.md` for the full required-asset spec and `PHASE_STATUS.md` "Phase 2B photography requirement" for the owner's verbatim instruction.

## Summary

**The built site currently uses zero photographs, stock images, or raster imagery of any kind — as a temporary development state, not the final design.** Every visual element today is either:
1. A CSS-only construct (gradients, borders, shape, color, spacing) defined in `app/globals.css` and component `*.module.css` files, or
2. A hand-written inline SVG icon/illustration component under `src/components/marketing/icons.tsx` and `src/components/marketing/home/HeroArt.tsx`, drawn as simple stroke paths and gradients using the site's own color tokens.

At Phase 2, the absence of photography was a deliberate choice: no licensed photography existed for the build, and the authorization said "missing imagery must not block the build." At Phase 2B, the owner's visual reference concepts explicitly asked for real, licensed photography (large hero imagery, photographic pathway cards, human support/advisor imagery, audience-page hero imagery), and the owner has since clarified this is a hard requirement of the approved design, not an optional enhancement. The absence of photography remains a **tested, environment-level limitation, not a preference** -- see "Why there is still no photography" below. The illustrated system was made more premium in Phase 2B (a full-bleed layered scenic panorama, richer gradient card treatments, a decorative handwritten accent typeface) to close as much of the visual gap as illustration honestly can, and every Section 1-2 component has since been retrofitted to be **photography-ready**: each renders real photography automatically the moment a path is supplied, with no layout rewrite (see "Photography-ready implementation" below). Neither the illustrated treatment nor this retrofit substitutes for actually supplying the required photographs.

## Why there is still no photography (Phase 2B)

This session's sandbox routes all outbound network access through an egress proxy with a strict allowlist (package registries, a few specific API/font hosts). Every general-purpose host -- including every photo/stock-image source tried -- is rejected. This was tested directly, not assumed:

| Host tried | Result |
|---|---|
| `commons.wikimedia.org` (Wikimedia Commons API) | Blocked (`CONNECT tunnel failed, response 403`) |
| `upload.wikimedia.org` (Wikimedia Commons media CDN) | Blocked |
| `images.unsplash.com` | Blocked |
| `www.pexels.com` | Blocked |
| `example.com` (neutral control, to confirm this isn't image-specific) | Blocked |
| `fonts.googleapis.com` / `fonts.gstatic.com` (control, to confirm the proxy isn't blocking everything) | **Reachable** |

The control tests confirm this is a general host allowlist, not a photography-specific restriction -- Google Fonts is reachable (used for the new handwritten accent typeface, see below), but no image-hosting or stock-photo domain of any kind is. This means: no real photograph could be fetched, downloaded, or referenced from a remote URL in this session, regardless of which properly-licensed source was tried.

**How to unblock this:** the two practical paths, either of which works without needing further sandbox network access:
1. The owner supplies specific licensed (or owner-approved generated) photo files directly, per the exact spec in `IMAGE_ASSET_MANIFEST.md` (filename, aspect ratio, minimum dimensions, focal subject, text-safe area), which get committed under `public/pathways/marketing/` and wired in by filling in the corresponding path in `src/content/marketing-photos.ts`.
2. A future session running with broader network egress (or its own approved API key for a stock-photo provider) fetches and licenses real photography per the rules already documented above.

## Photography-ready implementation

Every Section 1-2 component now consumes its image through `src/components/marketing/PhotoSlot.tsx` and the `src/content/marketing-photos.ts` registry, rather than rendering its illustrated fallback unconditionally:
- `Hero.tsx` -- background renders `MARKETING_PHOTOS.heroStudentMountain` if its `path` is set, else falls back to `HeroArt.tsx`.
- `FreedomCards.tsx` -- each card's image area renders its mapped slot (`athleteBasketball`, `academicStudentLaptop`, `flexibleTravelStudent`, `studentLifestyle`) if set, else falls back to its current gradient + icon.

As of this commit every slot's `path` is `null` (no photography supplied yet), so the fallback renders identically to before this retrofit -- confirmed by an unchanged Playwright suite (26/26) and fresh manual screenshots at 1440px and 375px showing no visual difference. Filling in a `path` and dropping the matching file into `public/pathways/marketing/` is the only change needed to go live with real photography for that slot; no component, layout, or CSS edit is required. Sections 3-8 (Human Support, Final CTA) and the three audience-page heroes are not yet built/refined, so their corresponding slots in `marketing-photos.ts` (`advisorFamily`, `finalMountainScenery`, `homeschoolPageHero`, `athletePageHero`, `academicPageHero`) exist in the registry for forward reference but have no consuming component yet.

## Asset inventory

| Asset | Type | Source | Rights status | Depicts a person? |
|---|---|---|---|---|
| Hero panorama (`HeroArt.tsx`) | Inline SVG, hand-authored | Written for this build | Original work, no rights question | No |
| Section 2 "Freedom" card image areas (`FreedomCards.tsx`) | CSS gradient + inline SVG icon | Written for this build | Original work, no rights question | No |
| Goal-card icons (athletics, schedule, homeschool, academic, compass, question) | Inline SVG, hand-authored | Written for this build | Original work, no rights question | No |
| Journey-step icons (discover, explore, plan, implement, support, advance) | Inline SVG, hand-authored | Written for this build | Original work, no rights question | No |
| Wordmark ("Pathways" + dot mark, `Logo.tsx`) | Text + CSS, no image file | Written for this build | Original work, no rights question | No |
| All section backgrounds, cards, buttons | CSS only (`*.module.css`) | Written for this build | Original work, no rights question | N/A |
| Handwritten accent typeface ("Caveat") | Google Font, loaded via `next/font/google` in `app/layout.tsx` | Google Fonts | SIL Open Font License 1.1 -- free for commercial use, no attribution required. Self-hosted by the Next.js build (no client-side request to Google at runtime). | N/A (typeface, not imagery) |

## Explicitly not used

- **The two supplied homepage mockups** (`docs/pathways/pack/reference-assets/homepage-mockup-1.webp`, `homepage-mockup-2.webp`) were used as **visual direction only** -- color palette (navy/teal/warm-neutral), spacing, tone -- per their own README and the Phase 2 authorization's explicit instruction. No pixel, photograph, layout element, or text from these files was copied, cropped, or embedded into the built site. Neither file is imported or referenced by any application code.
- **No stock photography** of any kind (people, classrooms, campuses, or otherwise) is used anywhere on the site.
- **No testimonial, review, or social-proof imagery** exists anywhere on the site (matching the "no synthetic social proof" acceptance criterion).
- **No third-party icon font or icon library** was installed; every icon is a hand-written inline SVG in this repository.

## Placeholders remaining

**Yes, and per the owner's explicit clarification this is a temporary development state, not an accepted design direction:** the hero background and the four Section 2 card image areas are illustrated substitutes standing in for the required, photography-led compositions the owner's visual reference concepts call for. This build could not source real photography, for the tested environment reason above -- not because it was decided against, and not because illustration was ever intended as the final treatment. See "Why there is still no photography" for the exact test evidence, and `IMAGE_ASSET_MANIFEST.md` for the exact spec needed to close this gap. **Phase 2B visual acceptance stays open, not complete, until every required slot in that manifest is filled and the responsive screenshot review is re-run against the real photography** (per the owner's explicit instruction -- see `PHASE_STATUS.md` "Phase 2B photography requirement").

Nothing else is a placeholder: icons, the wordmark, and all non-photographic surfaces remain original work with no rights question, unchanged from Phase 2.
