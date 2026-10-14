import type { Metadata } from "next";
import { Section } from "@/components/marketing/Section";
import { ConsultationDemoFlow } from "@/components/consultation/ConsultationDemoFlow";

export const metadata: Metadata = {
  title: "Planning Call Demo Preview",
  description: "A demo preview of the Pathways planning-call flow -- nothing is saved.",
  robots: { index: false, follow: false },
};

/**
 * Phase 6A owner-visual-review-only demo route (docs/pathways
 * instruction section 46-47), mirroring the existing `/discover/demo`
 * DB-free precedent. Deliberately DB-free: no `cookies()`, no
 * `@/db/client`, no `@/server/session`, no `@/server/consultation`
 * anywhere in this file's import graph, so this route never performs
 * a database call or issues a cookie, and renders identically whether
 * or not a hosted Preview database exists.
 */
export default function ConsultationDemoPage() {
  return (
    <Section tone="default" ariaLabelledBy="consultation-demo-heading" narrow>
      <span id="consultation-demo-heading" className="visually-hidden">
        Planning Call Demo Preview
      </span>
      <ConsultationDemoFlow />
    </Section>
  );
}
