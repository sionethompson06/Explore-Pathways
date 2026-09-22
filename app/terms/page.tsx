import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { Badge } from "@/components/marketing/Badge";

export const metadata: Metadata = {
  title: "Terms",
  description: "Pathways terms of use status.",
};

export default function TermsPage() {
  return (
    <>
      <PageHero headingId="terms-heading" eyebrow="Legal" title="Terms" />

      <Section tone="default" ariaLabelledBy="terms-status-heading" narrow>
        <h2 id="terms-status-heading" className="visually-hidden">
          Status
        </h2>
        <Card>
          <div style={{ marginBottom: "var(--space-4)" }}>
            <Badge>Draft — not yet available for live use</Badge>
          </div>
          <p>
            This page is a placeholder. Pathways does not yet have published, legally
            reviewed terms of use, because the operating entity and final service terms
            have not yet been finalized.
          </p>
          <p style={{ marginBottom: 0 }}>
            Complete terms will be published here before any live, public use of the
            service begins.
          </p>
        </Card>
      </Section>
    </>
  );
}
