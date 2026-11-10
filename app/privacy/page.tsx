import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { Badge } from "@/components/marketing/Badge";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Pathways privacy notice status.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero headingId="privacy-heading" eyebrow="Legal" title="Privacy" />

      <Section tone="default" ariaLabelledBy="privacy-status-heading" narrow>
        <h2 id="privacy-status-heading" className="visually-hidden">
          Status
        </h2>
        <Card>
          <div style={{ marginBottom: "var(--space-4)" }}>
            <Badge>Draft — not yet available for live use</Badge>
          </div>
          <p>
            This page is a placeholder. Pathways does not yet have a published, legally
            reviewed privacy notice, because the operating entity, retention periods, and
            data-processing terms it would describe have not yet been finalized.
          </p>
          <p style={{ marginBottom: 0 }}>
            This development preview does not collect real family or student data (see the
            site footer). A complete privacy notice will be published here before any live
            data collection begins.
          </p>
        </Card>
      </Section>
    </>
  );
}
