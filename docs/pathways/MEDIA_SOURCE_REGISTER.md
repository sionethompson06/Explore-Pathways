# Pathways Marketing Site — Media Source Register

Version: 5.0.0-phase2e-interactive-experience
Per the Phase 2 authorization section 3 and `docs/pathways/DECISION_LOG.md` DEC-D6 (media usage rights are a launch decision, not resolved by this phase): this document records every visual asset used on the public marketing site and its actual rights status. It exists so nothing here is ever mistaken for cleared, licensed production photography of real Pathways students, parents, staff, or partners.

## Summary

The owner supplied an approved generated marketing image asset pack (`pathways_marketing_asset_pack_v1`, delivered as a zip attachment with an accompanying `MANIFEST.md` and integration prompt) and explicitly approved its 9 images for use as general aspirational brand imagery. These are now wired into the site as real photography via `next/image`, replacing the Phase 2B illustrated placeholders on the sections/pages listed below. Every image depicts **generated, fictional people** -- not real Pathways students, parents, employees, advisors, or partners -- per the owner's own instruction and the "Generated / fictional people" rules in `IMAGE_ASSET_MANIFEST.md`.

Everything not covered by this asset pack (icons, the wordmark, all section backgrounds/cards/buttons, the handwritten accent typeface) remains the original CSS/inline-SVG work described in the "Non-photographic assets" section below, unchanged from Phase 2/2B.

## Asset pack provenance

- Source: owner-supplied zip `pathways_marketing_asset_pack_v1.zip`, containing `MANIFEST.md`, `CLAUDE_PHASE_2B_IMAGE_INTEGRATION_PROMPT.md`, `assets/webp/*` (9 production images), `assets/png/*` (9 source originals), and `references/*` (3 approved concept renderings used as design direction only, per the pack's own `MANIFEST.md`: "These are design references only. Do not use them as flattened page backgrounds or present fictional claims/testimonials from them as real.").
- The owner's message explicitly states: "I approve the Pathways generated marketing image asset set attached with this instruction... They are general aspirational brand imagery. They must NOT be represented as actual Pathways students, parents, staff, testimonials, partners, or documented outcomes."
- Only the WebP files are committed to the runtime bundle (`public/pathways/marketing/photography/`), per the pack's own guidance ("Keep original source assets outside the runtime bundle if only WebP is needed for production"). The PNG source originals and the 3 reference concept renderings are **not** committed to this repository -- they exist only in this session's conversation attachments -- to avoid bloating the repository with files nothing at runtime references.
- The 3 approved concept renderings (`references/`) were used as design direction for section layout, rhythm, and copy tone only, exactly as the pack's own manifest instructs. No pixel, layout element, or fabricated claim from those renderings (fake testimonials, "Real Students. Real Possibilities.", a "five-minute assessment," "free," "Nationwide Support," or the sample report's photo/name/percentages) was copied into the built site.

## Trademark correction (before use)

Before wiring any image in, every asset was visually inspected at full resolution -- not just trusted by filename or manifest description. Two of the nine images (`01-homepage-hero-student-mountain` and `02-freedom-train-more-athlete`) were found on inspection to contain a real, unlicensed third-party trademark: a Nike wordmark and swoosh visible on the athlete's tank top in image 02, and a Nike swoosh visible on the sock in both images 01 and 02. Using these as supplied, on a live commercial marketing site with no Nike license or affiliation, would have created a genuine trademark/false-endorsement risk -- implying a sponsorship or brand relationship that does not exist.

This was not a stylistic judgment call to route around; both affected regions were corrected using a local, in-place Gaussian blur (Python/Pillow, applied only to the small logo regions identified by pixel-coordinate inspection, feathered at the edges to blend into the surrounding fabric texture without displacing or cloning from elsewhere in the frame). The correction was verified by re-inspecting the corrected images at both extreme zoom (to confirm the mark is actually gone, not just faded) and at real on-site display size (to confirm the edit is not visually conspicuous). No other content in either image was altered. The corrected files -- not the originals supplied in the pack -- are what is committed to `public/pathways/marketing/photography/` and used by the site.

No other asset in the pack was found to contain a third-party trademark, brand name, or a real, identifiable place (the "campus" image, 08, was checked for signage, seals, or lettering that would tie it to a specific real institution; none was found).

## Photography now in use

| # | File (as committed) | Used on | Component(s) | `object-position` |
|---|---|---|---|---|
| 01 | `photography/01-homepage-hero-student-mountain.webp` (trademark-corrected) | Homepage hero | `Hero.tsx` | `78% 30%` (keeps the right-third subject framed at every breakpoint) |
| 02 | `photography/02-freedom-train-more-athlete.webp` (trademark-corrected) | "Train More" card (homepage); Student Athlete page hero | `FreedomCards.tsx`; `PageHero.tsx` via `app/pathways/[slug]/page.tsx` | `60% 30%` (card); default (page hero) |
| 03 | `photography/03-freedom-get-ahead-student-laptop.webp` | "Get Ahead" card (homepage) | `FreedomCards.tsx` | `center 35%` |
| 04 | `photography/04-freedom-learn-anywhere-travel-student.webp` | "Learn Anywhere" card (homepage); Flexible Learning page hero | `FreedomCards.tsx`; `PageHero.tsx` | `center 30%` (card); default (page hero) |
| 05 | `photography/05-freedom-take-back-time-student.webp` | "Take Back Their Time" card (homepage) | `FreedomCards.tsx` | `center 25%` |
| 06 | `photography/06-human-support-advisor-parent.webp` | Human Support section | `HumanSupport.tsx` | default |
| 07 | `photography/07-homeschool-support-family-learning.webp` | Homeschool page hero | `PageHero.tsx` | default |
| 08 | `photography/08-academic-opportunities-campus-student.webp` | Academic Opportunities page hero | `PageHero.tsx` | default |
| 09 | `photography/09-final-cta-mountain-landscape.webp` | Final homepage CTA | `FinalCta.tsx` | default |

**Reuse note:** the pack's own instruction for the Flexible Learning page ("Use 04... as the primary flexible-learning visual") reuses the same asset already mapped to the homepage's "Learn Anywhere" card -- there is no separate, dedicated Flexible Learning page-hero asset in the pack, and none was fabricated. The pack's page-level photography list also does not name a dedicated asset for `/pathways/flexible-learning` distinct from the card image, consistent with this reuse.

All nine images are wired through `src/content/marketing-photos.ts` (the typed registry of every slot's real path and alt text) and rendered via `src/components/marketing/PhotoSlot.tsx`, which uses `next/image` with `fill`, per-image `sizes`, and `priority` only on the actual hero LCP image -- never a raw `<img>`.

## Asset Pack 2 (product / infographic / conversion imagery) -- REFERENCE-ONLY as of Phase 2E

The owner separately supplied 4 approved product/infographic images ("Asset Pack 2"), attached directly to the Phase 2C instruction. At Phase 2C, three of these four were deployed as decorative banner images. **At Phase 2E, the owner made an explicit design-correction decision: Pack 2 must never be the primary user interface as flattened images -- it is design reference and art direction for real, interactive, component-based sections.** All four Pack 2 images are therefore now **REFERENCE-ONLY DESIGN ASSETS**, moved out of the runtime bundle (`public/`) into `docs/pathways/pack/reference-assets/asset-pack-2/` (not served, not committed to `public/`, per the owner's own instruction not to delete owner-approved source material). Every section they previously illustrated is now a real, interactive, keyboard-operable component -- see "Which sections use Pack 1 vs. Pack 2" below for the current mapping.

**Provenance:** delivered as 4 individual image attachments (not a zip), saved locally by the harness before this session could access them. Source: owner-approved generated Pathways marketing assets, per the same "aspirational, not real people" rules as Pack 1.

| Pack | Asset ID | Filename (as committed) | Status | Design reference for | Known limitations |
|---|---|---|---|---|---|
| 2 | P2-01 | `pack/reference-assets/asset-pack-2/01-find-your-path-in-minutes.webp` | **REFERENCE-ONLY DESIGN ASSET** (deployed in Phase 2C, retired in Phase 2E) | `FindYourPath.tsx` -- the real CTA, 4 benefit cards, and reason-chip links | None found on inspection |
| 2 | P2-02 | *(never committed)* | **REFERENCE-ONLY DESIGN ASSET** (never deployed) | `InteractiveDiscoveryPreview.tsx` -- composition/premium-panel direction only | **Rejected, not a technical defect: the supplied graphic paired a fabricated student photo, name ("Jordan M."), grade, and first-person quote in a profile-card layout that reads as a testimonial.** This project has consistently declined that pattern in every prior phase (no fake testimonials, no named "real" students). |
| 2 | P2-03 | `pack/reference-assets/asset-pack-2/03-possibility-to-progress.webp` | **REFERENCE-ONLY DESIGN ASSET** (deployed in Phase 2C, retired in Phase 2E) | `InteractivePathwayProcess.tsx` -- the connected-circle step design language | Cropped before it was ever deployed, to remove a bottom band containing the banned phrase "REAL STUDENTS. REAL POSSIBILITIES." (see below). Its own step copy also differs from the site's real copy (omits a step, drops the Student Success Blueprint's "paid, not automatic" caveat) -- never used as source text; see `src/content/how-it-works.ts`. |
| 2 | P2-04 | `pack/reference-assets/asset-pack-2/04-what-are-you-hoping-to-make-possible.webp` | **REFERENCE-ONLY DESIGN ASSET** (deployed in Phase 2C, retired in Phase 2E) | `GoalGrid.tsx` -- the card-grid layout and icon-circle style | Cropped before it was ever deployed, to remove a bottom band containing the large headline "Real Families. Real Reasons." (same banned-phrase pattern, see below). Its 8-item grid includes two categories ("Credit Recovery", "Reclassification Guidance") with no existing `GoalInterest` value -- `GoalGrid.tsx` links these plainly to `/discover` with no `interest` param, never inventing one; see `src/content/goal-cards.ts`. |

**Two banned-phrase corrections (not technical defects, content-safety corrections), made before either image was ever deployed:** both P2-03 and P2-04 were supplied with a large "REAL STUDENTS/FAMILIES. REAL POSSIBILITIES/REASONS." headline baked into their pixels. This exact phrase pattern was explicitly named as something to never copy, in the owner's own original Phase 2B brief ("no fake testimonials, no 'Real Students. Real Possibilities.'"). Both images were cropped to exclude that band -- not blurred/patched in place, since an initial blur attempt looked acceptable at forensic zoom but left a visible artifact at real display size.

**Why P2-01's backpack logo was never a trademark issue:** P2-01 depicts a backpack bearing the Pathways mountain wordmark itself (the same mark used in the site header) -- this is the brand's own mark on branded merchandise within its own marketing asset, not a third-party trademark.

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

## Which sections use Pack 1 vs. Pack 2

Pack 1 = actual deployed photography. Pack 2 = design reference only, as of Phase 2E -- every section it once illustrated is now a real interactive component; no Pack 2 image is deployed anywhere.

| Section | Deployed imagery | Pack 2 design reference | Real component |
|---|---|---|---|
| Hero | Pack 1 (01) | -- | `Hero.tsx` |
| Freedom cards | Pack 1 (02-05) | -- | `FreedomCards.tsx` |
| What Are You Hoping to Make Possible? | none | P2-04 | `GoalGrid.tsx` (8 interactive cards) |
| Why Families Explore a Different Path | none | P2-04 (icon/tile style) | `ExpandableReasonGrid.tsx` (8 expandable tiles) |
| Discovery Report showcase | none | P2-02 (composition only, never the graphic itself) | `InteractiveDiscoveryPreview.tsx` (ARIA tabs) |
| Find Your Path in Minutes | none | P2-01 | `FindYourPath.tsx` (CTA + benefit cards + reason-chip links) |
| A Clear Path From Possibility to Progress | none | P2-03 | `InteractivePathwayProcess.tsx` (5-step timeline) |
| Human Support | Pack 1 (06) | -- | `HumanSupport.tsx` |
| Brand Values | none | -- | `BrandValues.tsx` (native icon system) |
| Final CTA | Pack 1 (09) | -- | `FinalCta.tsx` |
| Homeschool / Athlete / Academic Opportunities / Flexible Learning page heroes | Pack 1 (07, 02, 08, 04) | -- | `PageHero.tsx` |

## Placeholders remaining

None. Every Pack 1 photography slot is filled and deployed (see "Photography now in use"). Every Pack 2-influenced section is a real interactive component (see "Which sections use Pack 1 vs. Pack 2") -- no static placeholder image stands in for interactivity anywhere. `IMAGE_ASSET_MANIFEST.md` should be read alongside this document for the exact crop/aspect-ratio spec each Pack 1 asset was fit to.
