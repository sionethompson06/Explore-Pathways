# Pathways Marketing Site — Media Source Register

Version: 3.0.0-phase2b-photography-integrated
Per the Phase 2 authorization section 3 and `docs/pathways/DECISION_LOG.md` DEC-D6 (media usage rights are a launch decision, not resolved by this phase): this document records every visual asset used on the public marketing site and its actual rights status. It exists so nothing here is ever mistaken for cleared, licensed production photography of real Pathways students, parents, staff, or partners.

## Summary

The owner supplied an approved generated marketing image asset pack (`pathways_marketing_asset_pack_v1`, delivered as a zip attachment with an accompanying `MANIFEST.md` and integration prompt) and explicitly approved its 9 images for use as general aspirational brand imagery. These are now wired into the site as real photography via `next/image`, replacing the Phase 2B illustrated placeholders on the sections/pages listed below. Every image depicts **generated, fictional people** -- not real Pathways students, parents, employees, advisors, or partners -- per the owner's own instruction and the "Generated / fictional people" rules in `IMAGE_ASSET_MANIFEST.md`.

Everything not covered by this asset pack (icons, the wordmark, all section backgrounds/cards/buttons, the handwritten accent typeface) remains the original CSS/inline-SVG work described in the "Non-photographic assets" section below, unchanged from Phase 2/2B.

## Asset pack provenance

- Source: owner-supplied zip `pathways_marketing_asset_pack_v1.zip`, containing `MANIFEST.md`, `CLAUDE_PHASE_2B_IMAGE_INTEGRATION_PROMPT.md`, `assets/webp/*` (9 production images), `assets/png/*` (9 source originals), and `references/*` (3 approved concept renderings used as design direction only, per the pack's own `MANIFEST.md`: "These are design references only. Do not use them as flattened page backgrounds or present fictional claims/testimonials from them as real.").
- The owner's message explicitly states: "I approve the Pathways generated marketing image asset set attached with this instruction... They are general aspirational brand imagery. They must NOT be represented as actual Pathways students, parents, staff, testimonials, partners, or documented outcomes."
- Only the WebP files are committed to the runtime bundle (`public/pathways/marketing/`), per the pack's own guidance ("Keep original source assets outside the runtime bundle if only WebP is needed for production"). The PNG source originals and the 3 reference concept renderings are **not** committed to this repository -- they exist only in this session's conversation attachments -- to avoid bloating the repository with files nothing at runtime references.
- The 3 approved concept renderings (`references/`) were used as design direction for section layout, rhythm, and copy tone only, exactly as the pack's own manifest instructs. No pixel, layout element, or fabricated claim from those renderings (fake testimonials, "Real Students. Real Possibilities.", a "five-minute assessment," "free," "Nationwide Support," or the sample report's photo/name/percentages) was copied into the built site.

## Trademark correction (before use)

Before wiring any image in, every asset was visually inspected at full resolution -- not just trusted by filename or manifest description. Two of the nine images (`01-homepage-hero-student-mountain` and `02-freedom-train-more-athlete`) were found on inspection to contain a real, unlicensed third-party trademark: a Nike wordmark and swoosh visible on the athlete's tank top in image 02, and a Nike swoosh visible on the sock in both images 01 and 02. Using these as supplied, on a live commercial marketing site with no Nike license or affiliation, would have created a genuine trademark/false-endorsement risk -- implying a sponsorship or brand relationship that does not exist.

This was not a stylistic judgment call to route around; both affected regions were corrected using a local, in-place Gaussian blur (Python/Pillow, applied only to the small logo regions identified by pixel-coordinate inspection, feathered at the edges to blend into the surrounding fabric texture without displacing or cloning from elsewhere in the frame). The correction was verified by re-inspecting the corrected images at both extreme zoom (to confirm the mark is actually gone, not just faded) and at real on-site display size (to confirm the edit is not visually conspicuous). No other content in either image was altered. The corrected files -- not the originals supplied in the pack -- are what is committed to `public/pathways/marketing/` and used by the site.

No other asset in the pack was found to contain a third-party trademark, brand name, or a real, identifiable place (the "campus" image, 08, was checked for signage, seals, or lettering that would tie it to a specific real institution; none was found).

## Photography now in use

| # | File (as committed) | Used on | Component(s) | `object-position` |
|---|---|---|---|---|
| 01 | `01-homepage-hero-student-mountain.webp` (trademark-corrected) | Homepage hero | `Hero.tsx` | `78% 30%` (keeps the right-third subject framed at every breakpoint) |
| 02 | `02-freedom-train-more-athlete.webp` (trademark-corrected) | "Train More" card (homepage); Student Athlete page hero | `FreedomCards.tsx`; `PageHero.tsx` via `app/pathways/[slug]/page.tsx` | `60% 30%` (card); default (page hero) |
| 03 | `03-freedom-get-ahead-student-laptop.webp` | "Get Ahead" card (homepage) | `FreedomCards.tsx` | `center 35%` |
| 04 | `04-freedom-learn-anywhere-travel-student.webp` | "Learn Anywhere" card (homepage); Flexible Learning page hero | `FreedomCards.tsx`; `PageHero.tsx` | `center 30%` (card); default (page hero) |
| 05 | `05-freedom-take-back-time-student.webp` | "Take Back Their Time" card (homepage) | `FreedomCards.tsx` | `center 25%` |
| 06 | `06-human-support-advisor-parent.webp` | Human Support section | `HumanSupport.tsx` | default |
| 07 | `07-homeschool-support-family-learning.webp` | Homeschool page hero | `PageHero.tsx` | default |
| 08 | `08-academic-opportunities-campus-student.webp` | Academic Opportunities page hero | `PageHero.tsx` | default |
| 09 | `09-final-cta-mountain-landscape.webp` | Final homepage CTA | `FinalCta.tsx` | default |

**Reuse note:** the pack's own instruction for the Flexible Learning page ("Use 04... as the primary flexible-learning visual") reuses the same asset already mapped to the homepage's "Learn Anywhere" card -- there is no separate, dedicated Flexible Learning page-hero asset in the pack, and none was fabricated. The pack's page-level photography list also does not name a dedicated asset for `/pathways/flexible-learning` distinct from the card image, consistent with this reuse.

All nine images are wired through `src/content/marketing-photos.ts` (the typed registry of every slot's real path and alt text) and rendered via `src/components/marketing/PhotoSlot.tsx`, which uses `next/image` with `fill`, per-image `sizes`, and `priority` only on the actual hero LCP image -- never a raw `<img>`.

## Non-photographic assets (unchanged from Phase 2/2B)

| Asset | Type | Source | Rights status | Depicts a person? |
|---|---|---|---|---|
| Goal-card icons, freedom-card fallback icons, journey-step icons, report-preview category icons | Inline SVG, hand-authored | Written for this build | Original work, no rights question | No |
| Wordmark ("Pathways" + dot mark, `Logo.tsx`) | Text + CSS, no image file | Written for this build | Original work, no rights question | No |
| All section backgrounds, cards, buttons not listed above | CSS only (`*.module.css`) | Written for this build | Original work, no rights question | N/A |
| Handwritten accent typeface ("Caveat") | Google Font, loaded via `next/font/google` in `app/layout.tsx` | Google Fonts | SIL Open Font License 1.1 -- free for commercial use, no attribution required. Self-hosted by the Next.js build. | N/A (typeface, not imagery) |
| `HeroArt.tsx` illustrated panorama | Inline SVG, hand-authored | Written for this build (Phase 2B) | Original work, no rights question | No -- retained in the codebase as `PhotoSlot`'s fallback if a photo path is ever cleared, but no longer rendered while `heroStudentMountain.path` is set. |

## Explicitly not used

- **The pack's 3 approved concept renderings** were used as visual/layout direction only, per their own manifest instruction -- never flattened into a page background, never committed to the repository, and no fabricated claim visible in them (fake testimonials, "Real Students. Real Possibilities.," a five-minute/free assessment claim, "Nationwide Support," or the sample report's photo/name/percentages) was carried into the built site's copy.
- **The two Phase 2 homepage mockups** (`docs/pathways/pack/reference-assets/homepage-mockup-1.webp`, `homepage-mockup-2.webp`) remain visual direction only, as recorded in the Phase 2 revision of this document -- unchanged.
- **No generated person is attached to a name, testimonial, school enrollment, athletic eligibility, NCAA status, or outcome claim anywhere on the site.** The Discovery Report preview uses a placeholder first name ("Jordan") explicitly labeled "Illustrative example -- not a student assessment or placement decision," per `src/content/report-preview.ts`.
- **No third-party icon font or icon library** was installed; every icon remains a hand-written inline SVG in this repository.

## Placeholders remaining

None on the sections and pages listed in "Photography now in use" above -- every slot the Phase 2B image-integration prompt called for for those sections is now filled with a real (generated, owner-approved) image. `IMAGE_ASSET_MANIFEST.md` should be read alongside this document for the exact crop/aspect-ratio spec each asset was fit to.
