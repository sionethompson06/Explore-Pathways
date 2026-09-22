import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { ButtonLink } from "@/components/marketing/Button";
import { JourneyList } from "@/components/marketing/home/JourneyList";
import { DISCOVER_HREF, PRIMARY_CTA_LABEL } from "@/content/nav-links";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "The Pathways service journey -- from a preliminary Discovery Report to ongoing support, and what's available at each step.",
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        headingId="how-it-works-heading"
        eyebrow="How it works"
        title="A step-by-step way to explore your student's options"
        subtitle="Every family starts with a preliminary Discovery Report. What comes after depends on what's actually available and what you choose."
      />

      <Section tone="alt" ariaLabelledBy="journey-heading">
        <h2 id="journey-heading" className="visually-hidden">
          The six steps
        </h2>
        <JourneyList />
      </Section>

      <Section tone="default" ariaLabelledBy="distinctions-heading" narrow>
        <h2 id="distinctions-heading">What&apos;s included, and what isn&apos;t</h2>
        <Card>
          <ul>
            <li>
              <strong>Preliminary Discovery</strong> is available to every family, free,
              with no account required.
            </li>
            <li>
              <strong>An initial advisory conversation</strong> is offered where an advisor
              is actually available for your family&apos;s grade level and location -- not
              guaranteed everywhere yet.
            </li>
            <li>
              <strong>The Student Success Blueprint</strong> is a separately scoped, paid
              engagement for families who want a fully built-out plan. It is never bundled
              into the free report.
            </li>
            <li>
              <strong>Ongoing support</strong> is offered only where it is actually staffed
              and available.
            </li>
          </ul>
          <p style={{ marginBottom: 0 }}>
            We don&apos;t publish prices, staffing levels, or turnaround times here because
            they vary and we&apos;d rather be accurate than convenient. Any cost or
            timeline is presented clearly before you&apos;re asked to commit to anything.
          </p>
        </Card>
      </Section>

      <Section tone="accent-tint" ariaLabelledBy="how-cta-heading">
        <div style={{ textAlign: "center" }}>
          <h2 id="how-cta-heading">Ready to see where you start?</h2>
          <ButtonLink href={DISCOVER_HREF} variant="primary">
            {PRIMARY_CTA_LABEL}
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
