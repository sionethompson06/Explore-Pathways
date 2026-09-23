# Pathways Marketing Site — Media Source Register

Version: 2.0.0-phase2b
Per the Phase 2 authorization section 3 and `docs/pathways/DECISION_LOG.md` DEC-D6 (media usage rights are a launch decision, not resolved by this phase): this document records every visual asset used on the public marketing site and its actual rights status. It exists so nothing here is ever mistaken for cleared, licensed production photography.

## Summary

**The built site uses zero photographs, stock images, or raster imagery of any kind.** Every visual element is either:
1. A CSS-only construct (gradients, borders, shape, color, spacing) defined in `app/globals.css` and component `*.module.css` files, or
2. A hand-written inline SVG icon/illustration component under `src/components/marketing/icons.tsx` and `src/components/marketing/home/HeroArt.tsx`, drawn as simple stroke paths and gradients using the site's own color tokens.

At Phase 2, this was a deliberate choice: no licensed photography existed for the build, and the authorization said "missing imagery must not block the build." At Phase 2B, the owner's visual reference concepts explicitly asked for real, licensed photography (large hero imagery, photographic pathway cards). This time the absence of photography is a **tested, environment-level limitation, not a preference** -- see "Why there is still no photography" below. The illustrated system was deliberately made more premium in Phase 2B (a full-bleed layered scenic panorama, richer gradient card treatments, a decorative handwritten accent typeface) specifically to get as close as reasonably possible to the requested visual weight without photography.

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

**How to unblock this without another code-architecture change:** the site's image slots (hero background, the four Section 2 card image areas) are already isolated components (`HeroArt.tsx`, `FreedomCards.tsx`) built specifically so a real `next/image` element can be substituted in behind the same props/markup later with a small, contained change -- not a redesign. The two practical paths, either of which works without needing further sandbox network access:
1. The owner supplies specific licensed photo files directly (e.g., attached to a future message, the same way the visual reference mockups were supplied), which get committed under a new `public/media/` directory and wired into these components.
2. A future session running with broader network egress (or its own approved API key for a stock-photo provider) fetches and licenses real photography per the rules already documented above.

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

**Yes, as of Phase 2B, and this is a real (not cosmetic) gap:** the hero background and the four Section 2 card image areas are illustrated substitutes for the real, photography-led compositions the owner's visual reference concepts call for. Unlike Phase 2 (where the choice was "no licensed photography exists, so don't fake it"), Phase 2B genuinely wants photography here and this build could not source it, for the tested environment reason above -- not because it was decided against. See "Why there is still no photography" for the exact test evidence and the two ways to unblock this without a further code-architecture change.

Nothing else is a placeholder: icons, the wordmark, and all non-photographic surfaces remain original work with no rights question, unchanged from Phase 2.
