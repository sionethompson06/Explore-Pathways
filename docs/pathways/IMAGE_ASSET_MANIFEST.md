# Pathways Marketing Site — Image Asset Manifest

Version: 1.0.0-phase2b-photography-requirement

Per the owner's explicit Phase 2B clarification (see `PHASE_STATUS.md` "Phase 2B photography requirement"): real photography or photorealistic branded imagery is a **required part of the approved Phase 2B design**, not an optional enhancement. The illustrated SVG/gradient treatments currently on the site are a **temporary development placeholder** (see `MEDIA_SOURCE_REGISTER.md`), because this sandbox's network egress policy blocks every photo/stock-image host tried. This document is the exact spec the owner (or a future session with broader network access) needs to supply real files against, so that swapping them in requires **no layout rewrite** — only filling in a path in `src/content/marketing-photos.ts`.

## How this wires in

1. Save the approved file under `public/pathways/marketing/<slot-filename>.<ext>` (jpg/webp/avif; webp or avif recommended for weight).
2. Set that slot's `path` in `src/content/marketing-photos.ts` to `"/pathways/marketing/<slot-filename>.<ext>"`.
3. The consuming component (already written to expect this) automatically renders it via `next/image` in place of its current illustrated fallback — no other code change needed. See `src/components/marketing/PhotoSlot.tsx`.
4. Re-run the responsive screenshot review (375/768/1024/1440px) once any slot changes, per the owner's explicit requirement, before considering that section's visual implementation complete.

## Required slots

| Slot key (`marketing-photos.ts`) | Suggested filename | Used in | Aspect ratio | Min dimensions | Focal subject | Text-safe area | Status |
|---|---|---|---|---|---|---|---|
| `heroStudentMountain` | `hero-student-mountain.jpg` | Homepage Hero (Section 1), full-bleed background | ~16:7 to 16:8 | 1800px wide minimum (2400px+ preferred for retina) | Student figure, positioned in the right third of the frame | Left two-thirds, to stay clear of the headline/CTA column | **NEEDED — not yet supplied** |
| `athleteBasketball` | `athlete-basketball.jpg` | "Train More" card (Section 2, homepage) | 4:3 | 1200x900px minimum | Student athlete, centered, mid-action | N/A (card has no overlaid text on the image itself) | **NEEDED — not yet supplied** |
| `academicStudentLaptop` | `academic-student-laptop.jpg` | "Get Ahead" card (Section 2, homepage) | 4:3 | 1200x900px minimum | Student engaged with a laptop/coursework, centered | N/A | **NEEDED — not yet supplied** |
| `flexibleTravelStudent` | `flexible-travel-student.jpg` | "Learn Anywhere" card (Section 2, homepage) | 4:3 | 1200x900px minimum | Student in a travel/location-flexible setting, centered | N/A | **NEEDED — not yet supplied** |
| `studentLifestyle` | `student-lifestyle.jpg` | "Take Back Their Time" card (Section 2, homepage) | 4:3 | 1200x900px minimum | Student in a relaxed, optimistic lifestyle moment, centered | N/A | **NEEDED — not yet supplied** |
| `advisorFamily` | `advisor-family.jpg` | Human Support section (Section 6 of the homepage brief — **not yet built**, paused per owner's "stop after 2" instruction) | ~4:3 or 3:2 | 1400x1050px minimum | An advisor and a parent/student in conversation | Depends on final Section 6 layout, to be confirmed when that section is built | **NEEDED — not yet supplied; consuming section not yet built** |
| `finalMountainScenery` | `final-mountain-scenery.jpg` | Final CTA (Section 8 of the homepage brief — **not yet built**) | Wide cinematic (~21:9 or 16:6) | 2000px wide minimum | Open landscape, no dominant foreground subject | Center-safe for an overlaid headline/CTA, to be confirmed when that section is built | **NEEDED — not yet supplied; consuming section not yet built** |
| `homeschoolPageHero` | `homeschool-page-hero.jpg` | `/pathways/homeschool` audience page hero (**not yet refined for Phase 2B**) | 16:9 recommended for a page-header treatment | 1800px wide minimum | Warm, home-based learning moment | Left or center, to be confirmed when that page is refined | **NEEDED — not yet supplied; consuming page not yet refined** |
| `athletePageHero` | `athlete-page-hero.jpg` | `/pathways/athletes` audience page hero (**not yet refined for Phase 2B**) | 16:9 recommended | 1800px wide minimum | Strong athletic imagery, student athlete in competition/training | Left or center, to be confirmed | **NEEDED — not yet supplied; consuming page not yet refined** |
| `academicPageHero` | `academic-page-hero.jpg` | `/pathways/academic-opportunities` audience page hero (**not yet refined for Phase 2B**) | 16:9 recommended | 1800px wide minimum | Student in an advanced-academic or college-context learning setting | Left or center, to be confirmed | **NEEDED — not yet supplied; consuming page not yet refined** |

**Open question for the owner:** the brief's page-level photography list names Homeschool, Athlete, and Academic Opportunities pages specifically; it does not mention `/pathways/flexible-learning`. This manifest does not assume a slot for that page — confirm whether it should also get dedicated photography for visual parity with the other three audience pages, or continue using the shared Section 2 "Learn Anywhere" card imagery.

## Format and delivery guidance

- Preferred formats: `.jpg` (broad compatibility) or `.webp`/`.avif` (better compression at equivalent quality). Whatever is supplied, `next/image` handles responsive resizing/format negotiation automatically once wired in — no additional code is needed per format.
- Supply the largest resolution available; `next/image` downsamples for smaller viewports, but cannot upsample a low-resolution source without visible quality loss.
- If cropping is required to hit the target aspect ratio, crop toward the focal subject described above, not toward the image's geometric center by default.

## Generated / fictional people — usage rules

Per the owner's explicit approval: generated or illustrative people may be used as general aspirational marketing imagery, **only** if the owner approves the specific asset. Whether generated or genuinely photographed, no image on this site may:

- Be represented as an actual Pathways student, parent, employee, advisor, or family.
- Be attached to a name, a specific accomplishment, a school, or an outcome (e.g., no caption claiming "accepted to X college" or "improved from Y to Z").
- Be presented as a testimonial or success story, or paired with any quote/review styling.

Every image's purpose is to sell the **possibility and lifestyle** the brand offers, not to fabricate social proof. `MEDIA_SOURCE_REGISTER.md` records the actual rights/generation status of every asset once supplied, per this same rule set.

## What this manifest does not do

This document does not authorize building Sections 3–8, the navigation refinement, or the audience-page refinements — those remain paused per the owner's explicit "stop after 2, do not build section 3" instruction. It exists so that when that work resumes, the components built for it are photography-ready from the start, and so the owner has the exact spec needed to supply assets for the sections already built (Hero, Freedom cards) in the meantime.
