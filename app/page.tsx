import type { Metadata } from "next";
import { Section } from "@/components/marketing/Section";
import { Faq } from "@/components/marketing/Faq";
import { Hero } from "@/components/marketing/home/Hero";
import { FreedomCards } from "@/components/marketing/home/FreedomCards";
import { GoalGrid } from "@/components/marketing/home/GoalGrid";
import { WhyExplore } from "@/components/marketing/home/WhyExplore";
import { JourneyList } from "@/components/marketing/home/JourneyList";
import { ReportPreviewCard } from "@/components/marketing/home/ReportPreviewCard";
import { HumanSupport } from "@/components/marketing/home/HumanSupport";
import { BrandValues } from "@/components/marketing/home/BrandValues";
import { FinalCta } from "@/components/marketing/home/FinalCta";
import { HOMEPAGE_FAQ } from "@/content/faq";

export const metadata: Metadata = {
  title: "Pathways — Explore Education Possibilities for Your Student",
  description:
    "Explore education possibilities around your child's learning, interests and future -- from athletics and flexible schedules to homeschool support and academic advancement.",
};

export default function Home() {
  return (
    <>
      {/* Section 1 (Phase 2B): Hero */}
      <Hero />

      {/* Section 2 (Phase 2B): Freedom / possibility */}
      <Section tone="default" ariaLabelledBy="freedom-cards-heading">
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <h2 id="freedom-cards-heading">What Could Your Student Do With More Freedom?</h2>
          <p style={{ marginInline: "auto" }}>
            The right education pathway creates more room for what matters.
          </p>
        </div>
        <FreedomCards />
      </Section>

      {/* B. Family goals */}
      <Section tone="alt" ariaLabelledBy="goals-heading">
        <h2 id="goals-heading">What are you hoping to make possible?</h2>
        <p>Choose whatever fits best today -- you can always explore more later.</p>
        <GoalGrid />
      </Section>

      {/* Section 3 (Phase 2B image-integration): Why Families Explore a Different Path */}
      <Section tone="default" ariaLabelledBy="why-heading">
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <h2 id="why-heading">Why Families Explore a Different Path</h2>
          <p style={{ marginInline: "auto" }}>
            Pathways is an education pathways ecosystem, not a single school or program --
            many families keep their current school and simply add support around it.
          </p>
        </div>
        <WhyExplore />
      </Section>

      {/* Section 4 (Phase 2B image-integration): Discovery Report preview */}
      <Section tone="alt" ariaLabelledBy="report-heading">
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <h2 id="report-heading">See what a Discovery Report helps you understand</h2>
          <p style={{ marginInline: "auto" }}>
            What matters most to your family, directions worth exploring, relevant
            possibilities, and questions for a planning conversation.
          </p>
        </div>
        <ReportPreviewCard />
      </Section>

      {/* Section 5 (Phase 2B image-integration): How Pathways Works */}
      <Section tone="default" ariaLabelledBy="how-heading">
        <h2 id="how-heading">A Clear Path From Possibility to Progress</h2>
        <p>
          A preliminary Discovery Report is available to every family. Deeper services --
          an advisor conversation, a full Student Success Blueprint, ongoing support --
          depend on availability and staffing, and are never presented as automatic.
        </p>
        <JourneyList />
      </Section>

      {/* Section 6 (Phase 2B image-integration): Human support */}
      <Section tone="alt" ariaLabelledBy="human-support-heading">
        <HumanSupport />
      </Section>

      {/* Section 7 (Phase 2B image-integration): Brand values band */}
      <Section tone="inverse" ariaLabelledBy="brand-values-heading">
        <div style={{ textAlign: "center" }}>
          <h2 id="brand-values-heading">What Pathways Stands For</h2>
        </div>
        <BrandValues />
      </Section>

      {/* Parent questions */}
      <Section tone="alt" ariaLabelledBy="faq-heading" narrow>
        <h2 id="faq-heading">Questions parents ask</h2>
        <Faq items={HOMEPAGE_FAQ} />
      </Section>

      {/* Section 8 (Phase 2B image-integration): Final scenic CTA */}
      <FinalCta />
    </>
  );
}
