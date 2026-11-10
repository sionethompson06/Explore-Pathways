# Pathways Discovery App - Builder Handoff Pack
Version: 1.0.0-candidate
Status: Consolidated product brief and proposed engineering clarifications. Not a deployed application, legal clearance, or empirically validated educational placement algorithm.

## What this pack is
A self-contained implementation brief for the front door to the Pathways Education Pathways Ecosystem. It consolidates Specifications 01-05 and the K-4 addendum from the planning conversation. It includes recommended corrections where earlier drafts conflict. It is not a verbatim archive of the conversation.

The proposed first product is a parent-facing responsive web app: discover goals -> answer appropriate questions -> receive an honest, useful Discovery Report -> optionally save -> request or schedule a consultation -> continue with an advisor.

## How to use it
1. Put this directory in a new or specifically designated Pathways repository, preferably under docs/pathways. Do not place it in the TEACH Ticket System repository unless the owner explicitly changes the project.
2. Give the builder prompts/00_MASTER_CONTEXT.md plus prompts/01_PHASE_0_RECONCILE.md. This authorizes Phase 0 only.
3. Review the Phase 0 reconciliation and blockers. Then authorize one phase prompt at a time. A future-phase document is context, not permission to implement it.
4. Require the completion evidence specified in every prompt. Preserve approved work; use small commits and the actual repository's branch policy.
5. Run synthetic tests before accepting real family information. Activate live collection, email, scheduling, AI and production deployment only after their gates pass.

No existing repository, deployment, paid account, API integration or real provider availability was inspected or verified for this pack. No real family records are included. Test cases are fictional.

## Source-of-truth order
The owner's latest explicit decisions -> engineering resolutions explicitly accepted for this build -> normalized specifications in this pack -> contracts and golden fixtures -> historical narrative -> implementation convenience. When documents disagree, record the discrepancy rather than choosing silently. This pack proposes the resolution record; Phase 0 makes it visible for acceptance.

## Directory map
- specifications/01_PRODUCT.md through 05_REPORT.md: normalized working requirements.
- specifications/06_RESOLUTIONS.md: precedence, corrections, and unresolved launch decisions.
- specifications/07_ARCHITECTURE.md: routes, data, security, adapters, environments.
- contracts/: JSON registries for questions, models, rules, aliases, scoring, and output interfaces. These are input documents, not a substitute for typed runtime validation.
- fixtures/: fictional profiles and expected safety/behavior invariants, not clinical or placement truth labels.
- prompts/: master context, phase prompts, repair prompt.
- checks/: structural and reference evaluation checks for the pack. These do not test an application that has not yet been built.
- reference-assets/: the two approved generated website mockups. Design reference only. Do not copy unverified statistics, testimonials, course claims, or certification language from mockup pixels.

## Scope boundary
Build Discovery, reports, saving, consultation workflow, a small advisor workspace, privacy-preserving funnel measurement, and optional controlled AI prose. Do not build a school, LMS, grades, transcripts, NCAA eligibility engine, provider marketplace, payments, Blueprint authoring, tutoring, or a student AI companion in this MVP.

## Major unresolved launch decisions
Repository and deployment destination; operating legal entity and published disclosures; service markets and grade coverage actually staffed; advisor availability and contact commitments; consultation price/duration; privacy terms and retention; authentication/email/scheduler providers and contracts; AI provider/data handling approval; lawful media rights. Use honest unavailable states until these are supplied. A missing AI provider is not a blocker for deterministic reports.

---

## Provenance note (added at Phase 0 corrections, this repository)

This file is a verbatim copy of the pack as originally supplied. It is preserved unmodified here for audit purposes. Corrections approved during Phase 0 (DEC-B1-B10, DEC-C1-C7) are applied to a separate, single authoritative copy of the contracts at the repository root `contracts/` directory, with an explicit changelog documenting every difference from this original. Application code reads only from the repository-root `contracts/` directory, never from this archival copy. See `docs/pathways/IMPLEMENTATION_CONTRACT.md` and `contracts/CHANGELOG.md`.
