# Pathways Marketing Site — Media Source Register

Version: 1.0.0-phase2
Per the Phase 2 authorization section 3 and `docs/pathways/DECISION_LOG.md` DEC-D6 (media usage rights are a launch decision, not resolved by this phase): this document records every visual asset used on the public marketing site and its actual rights status. It exists so nothing here is ever mistaken for cleared, licensed production photography.

## Summary

**The built site uses zero photographs, stock images, or raster imagery of any kind.** Every visual element is either:
1. A CSS-only construct (gradients, borders, shape, color, spacing) defined in `app/globals.css` and component `*.module.css` files, or
2. A hand-written inline SVG icon/illustration component under `src/components/marketing/icons.tsx` and `src/components/marketing/home/HeroArt.tsx`, drawn as simple stroke paths using the site's own color tokens.

This was a deliberate choice, not a temporary placeholder: the Phase 2 authorization states "missing imagery must not block the build" and "use only appropriately provided or licensed assets," and no licensed photography exists for this build. Rather than use an unlicensed stock photo or fabricate a licensing claim, the design uses no photography at all. This sidesteps the licensing question entirely for this phase; it does not answer it for a future phase that wants real photography.

## Asset inventory

| Asset | Type | Source | Rights status | Depicts a person? |
|---|---|---|---|---|
| Hero illustration (`HeroArt.tsx`) | Inline SVG, hand-authored | Written for this build | Original work, no rights question | No |
| Goal-card icons (athletics, schedule, homeschool, academic, compass, question) | Inline SVG, hand-authored | Written for this build | Original work, no rights question | No |
| Journey-step icons (discover, explore, plan, implement, support, advance) | Inline SVG, hand-authored | Written for this build | Original work, no rights question | No |
| Wordmark ("Pathways" + dot mark, `Logo.tsx`) | Text + CSS, no image file | Written for this build | Original work, no rights question | No |
| All section backgrounds, cards, buttons | CSS only (`*.module.css`) | Written for this build | Original work, no rights question | N/A |

## Explicitly not used

- **The two supplied homepage mockups** (`docs/pathways/pack/reference-assets/homepage-mockup-1.webp`, `homepage-mockup-2.webp`) were used as **visual direction only** -- color palette (navy/teal/warm-neutral), spacing, tone -- per their own README and the Phase 2 authorization's explicit instruction. No pixel, photograph, layout element, or text from these files was copied, cropped, or embedded into the built site. Neither file is imported or referenced by any application code.
- **No stock photography** of any kind (people, classrooms, campuses, or otherwise) is used anywhere on the site.
- **No testimonial, review, or social-proof imagery** exists anywhere on the site (matching the "no synthetic social proof" acceptance criterion).
- **No third-party icon font or icon library** was installed; every icon is a hand-written inline SVG in this repository.

## Placeholders remaining

None. There is no image asset on the site that is a stand-in for a future real photograph -- the design does not have an "empty" state waiting for photography, so there is nothing to flag as pending. If a future phase wants real photography (e.g., of actual staff, students, or facilities), that is new work requiring its own licensing confirmation (DEC-D6), not a placeholder already sitting in this build.
