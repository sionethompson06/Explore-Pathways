import type { Metadata } from "next";
import { Section } from "@/components/marketing/Section";
import { Faq } from "@/components/marketing/Faq";
import { Hero } from "@/components/marketing/home/Hero";
import { FreedomCards } from "@/components/marketing/home/FreedomCards";
import { GoalGrid } from "@/components/marketing/home/GoalGrid";
import { ExpandableReasonGrid } from "@/components/marketing/home/ExpandableReasonGrid";
import { InteractivePathwayProcess } from "@/components/marketing/home/InteractivePathwayProcess";
import { DiscoveryShowcase } from "@/components/marketing/home/DiscoveryShowcase";
import { FindYourPath } from "@/components/marketing/home/FindYourPath";
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

      {/* What Are You Hoping to Make Possible? (Phase 2E -- real interactive card grid, Asset Pack 2 P2-04 as design reference only) */}
      <Section tone="alt" ariaLabelledBy="goals-heading">
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <h2 id="goals-heading">What are you hoping to make possible?</h2>
          <p style={{ marginInline: "auto" }}>
            Choose whatever fits best today -- you can always explore more later.
          </p>
        </div>
        <GoalGrid />
      </Section>

      {/* Why Families Explore a Different Path (Phase 2E -- expandable reason tiles) */}
      <Section tone="default" ariaLabelledBy="why-heading">
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <h2 id="why-heading">Why Families Explore a Different Path</h2>
          <p style={{ marginInline: "auto" }}>
            Every student is different. Here are some of the reasons families start
            exploring.
          </p>
        </div>
        <ExpandableReasonGrid />
      </Section>

      {/* Discovery Report showcase (Phase 2E -- real interactive tabbed report, Asset Pack 2 P2-02 as design reference only) */}
      <Section tone="alt" ariaLabelledBy="report-heading">
        <DiscoveryShowcase />
      </Section>

      {/* Find Your Path in Minutes (Phase 2E -- real interactive UI, Asset Pack 2 P2-01 as design reference only) */}
      <Section tone="default" ariaLabelledBy="find-your-path-heading">
        <FindYourPath />
      </Section>

      {/* A Clear Path From Possibility to Progress (Phase 2E -- real interactive timeline, Asset Pack 2 P2-03 as design reference only) */}
      <Section tone="alt" ariaLabelledBy="how-heading">
        <div style={{ textAlign: "center" }}>
          <h2 id="how-heading">A Clear Path From Possibility to Progress</h2>
          <p style={{ marginInline: "auto" }}>
            We make the process simple, supportive and personalized.
          </p>
        </div>
        <InteractivePathwayProcess />
      </Section>

      {/* Section 6 (Phase 2B image-integration): Human support */}
      <Section tone="default" ariaLabelledBy="human-support-heading">
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
