import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";

export const metadata: Metadata = {
  title: "For Partners",
  description: "How schools, programs and providers can collaborate with Pathways.",
};

export default function ForPartnersPage() {
  return (
    <>
      <PageHero
        headingId="partners-heading"
        eyebrow="For Partners"
        title="A collaboration model, not a directory"
        subtitle="Pathways is built to work alongside schools, programs and providers -- not to compete with or replace them."
      />

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

      <Section tone="alt" ariaLabelledBy="partners-contact-heading" narrow>
        <h2 id="partners-contact-heading">Interested in a conversation?</h2>
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
