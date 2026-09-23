# Pathways Marketing Site — Image Asset Manifest

Version: 2.0.0-phase2b-photography-supplied

The owner supplied an approved generated marketing image asset pack (`pathways_marketing_asset_pack_v1`) that fills every slot below. All nine images are now committed to `public/pathways/marketing/` and wired into the site -- see `docs/pathways/MEDIA_SOURCE_REGISTER.md` for full provenance, the trademark correction applied to two of the nine images before use, and the exact component/page each one renders on.

## How this is wired in

1. The approved file lives at `public/pathways/marketing/<filename>.webp`.
2. That slot's `path` in `src/content/marketing-photos.ts` points at it.
3. The consuming component renders it via `next/image` (through `src/components/marketing/PhotoSlot.tsx`) in place of its illustrated fallback.
4. Any future replacement asset only requires repeating steps 1-2 for that slot -- no component, layout, or CSS change is needed.

## Required slots

| Slot key (`marketing-photos.ts`) | File used | Used in | Aspect ratio | Focal subject | Text-safe area | Status |
|---|---|---|---|---|---|---|
| `heroStudentMountain` | `01-homepage-hero-student-mountain.webp` | Homepage Hero (Section 1), full-bleed background | 1774x887 (2:1) | Student figure, right third of the frame | Left two-thirds, kept clear via `object-position: 78% 30%` and a left-anchored overlay gradient | **SUPPLIED** (trademark-corrected -- see MEDIA_SOURCE_REGISTER.md) |
| `athleteBasketball` | `02-freedom-train-more-athlete.webp` | "Train More" card (Section 2, homepage); Student Athlete page hero | 1448x1086 (4:3) | Student athlete, centered-left, mid-action | N/A | **SUPPLIED** (trademark-corrected) |
| `academicStudentLaptop` | `03-freedom-get-ahead-student-laptop.webp` | "Get Ahead" card (Section 2, homepage) | 1448x1086 (4:3) | Student engaged with a laptop/coursework | N/A | **SUPPLIED** |
| `flexibleTravelStudent` | `04-freedom-learn-anywhere-travel-student.webp` | "Learn Anywhere" card (homepage); Flexible Learning page hero | 1448x1086 (4:3) | Student in a travel/location-flexible setting | N/A | **SUPPLIED** |
| `studentLifestyle` | `05-freedom-take-back-time-student.webp` | "Take Back Their Time" card (Section 2, homepage) | 1448x1086 (4:3) | Student in a relaxed, optimistic lifestyle moment | N/A | **SUPPLIED** |
| `advisorFamily` | `06-human-support-advisor-parent.webp` | Human Support section (Section 6) | 1448x1086 (4:3) | Two adults in conversation over a laptop | Split-panel layout, no overlaid text on the image itself | **SUPPLIED** |
| `finalMountainScenery` | `09-final-cta-mountain-landscape.webp` | Final CTA (Section 8) | 1774x887 (2:1) | Open landscape, no dominant foreground subject | Center-safe, kept clear via a bottom-anchored overlay gradient | **SUPPLIED** |
| `homeschoolPageHero` | `07-homeschool-support-family-learning.webp` | `/pathways/homeschool` audience page hero | 1448x1086 (4:3) | Parent and student learning together at home | N/A (photo band sits above the text hero) | **SUPPLIED** |
| `athletePageHero` | `02-freedom-train-more-athlete.webp` (reused) | `/pathways/athletes` audience page hero | 1448x1086 (4:3) | Student athlete in training/competition | N/A | **SUPPLIED** (same asset as `athleteBasketball`, per the integration prompt's own instruction to use it "prominently on the athlete route") |
| `academicPageHero` | `08-academic-opportunities-campus-student.webp` | `/pathways/academic-opportunities` audience page hero | 1448x1086 (4:3) | Student with a laptop in a campus setting | N/A | **SUPPLIED** |

**Flexible Learning page resolution:** the integration prompt explicitly directs reusing image 04 ("Learn Anywhere" travel-student asset) as "the primary flexible-learning visual" for `/pathways/flexible-learning` -- there is no separate, dedicated page-hero asset for this route in the pack. This resolves the open question the prior revision of this manifest raised; no new asset was fabricated for it.

## Format and delivery guidance

- All nine images are `.webp` at production quality (~88-90), sized from a 1448x1086 or 1774x887 source -- no upscaling was needed.
- `next/image` handles responsive resizing per the `sizes` prop each call site sets; `priority` is set only on the homepage hero (the actual LCP element).
- Non-center focal subjects are kept in frame under `object-fit: cover` via an explicit `object-position` per image (see the table in `MEDIA_SOURCE_REGISTER.md` "Photography now in use").

## Generated / fictional people — usage rules

Per the owner's explicit approval: every person depicted is a generated, aspirational model, **not** an actual Pathways student, parent, employee, advisor, or family. No image on this site may:

- Be represented as an actual Pathways community member.
- Be attached to a name, a specific accomplishment, a school, or an outcome (e.g., no caption claiming "accepted to X college" or "improved from Y to Z"). The Discovery Report preview's placeholder first name ("Jordan") is explicitly labeled illustrative, never a real family.
- Be presented as a testimonial or success story, or paired with any quote/review styling.

Every image's purpose is to sell the **possibility and lifestyle** the brand offers, not to fabricate social proof.

## What this manifest does not do

This document does not authorize the navigation refinement or the For Partners/FAQ visual refinement passes the original Phase 2B brief separately listed -- those remain out of scope for this image-integration pass, which was scoped to the approved asset pack's own instructions (homepage Sections 1-8, the four audience-page heroes, and the trademark correction).
