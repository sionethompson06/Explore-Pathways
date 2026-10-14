import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { Badge } from "@/components/marketing/Badge";
import { ThemeGrid } from "@/components/marketing/ThemeGrid";
import { PARTNER_CATEGORIES, PARTNER_ROLES } from "@/content/partners";

export const metadata: Metadata = {
  title: "For Partners",
  description:
    "How athletic academies, clubs, training programs, performing arts organizations, schools and education providers can collaborate with Pathways.",
};

export default function ForPartnersPage() {
  return (
    <>
      <PageHero
        headingId="partners-heading"
        eyebrow="For Partners"
        title="You Focus on Their Talent. We'll Help Coordinate the Education."
        subtitle="Pathways is designed to work alongside organizations that help students pursue ambitious goals while keeping education intentional."
      />

      <Section tone="default" ariaLabelledBy="partners-categories-heading" narrow>
        <h2 id="partners-categories-heading" style={{ textAlign: "center" }}>
          Who Pathways Works Alongside
        </h2>
        <p style={{ textAlign: "center" }}>
          Pathways is built for organizations whose students need an education plan that keeps
          up with a demanding schedule -- including:
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            justifyContent: "center",
          }}
        >
          {PARTNER_CATEGORIES.map((category) => (
            <Badge key={category}>{category}</Badge>
          ))}
        </div>
      </Section>

      <Section tone="alt" ariaLabelledBy="partners-roles-heading">
        <h2 id="partners-roles-heading" style={{ textAlign: "center" }}>
          How the Three Roles Work Together
        </h2>
        <p style={{ textAlign: "center" }}>
          Each partnership keeps its responsibilities clear -- Pathways coordinates, it doesn&apos;t
          replace what a partner organization or education provider already does.
        </p>
        <ThemeGrid items={PARTNER_ROLES} />
      </Section>

      <Section tone="default" ariaLabelledBy="partners-model-heading" narrow>
        <h2 id="partners-model-heading" className="visually-hidden">
          How partnership works
        </h2>
        <Card>
          <p>
            Pathways helps families understand their options and identify directions worth
            exploring. Where a school, program or provider is a genuine fit for a family&apos;s
            situation, Pathways aims to be a clear, honest bridge to that next conversation --
            never a replacement for the school or provider&apos;s own admissions, eligibility
            or enrollment process.
          </p>
          <p style={{ marginBottom: 0 }}>
            We are not currently publishing a list of partner organizations here. No
            partnership, affiliation, accreditation or endorsement should be assumed from
            this page until it is explicitly confirmed.
          </p>
        </Card>
      </Section>

      <Section tone="accent-tint" ariaLabelledBy="partners-contact-heading" narrow>
        <h2 id="partners-contact-heading" style={{ textAlign: "center" }}>
          Interested in a Conversation?
        </h2>
        <Card>
          <p style={{ marginBottom: 0 }}>
            Partner inquiries are not yet handled through this site. This page will be
            updated with a working way to reach us once that process is in place -- we would
            rather leave this honest than add a form that doesn&apos;t actually go anywhere.
          </p>
        </Card>
      </Section>
    </>
  );
}
