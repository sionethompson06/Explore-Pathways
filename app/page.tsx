import type { Metadata } from "next";
import { Section } from "@/components/marketing/Section";
import { ButtonLink } from "@/components/marketing/Button";
import { Card } from "@/components/marketing/Card";
import { Faq } from "@/components/marketing/Faq";
import { Hero } from "@/components/marketing/home/Hero";
import { FreedomCards } from "@/components/marketing/home/FreedomCards";
import { GoalGrid } from "@/components/marketing/home/GoalGrid";
import { JourneyList } from "@/components/marketing/home/JourneyList";
import { ReportPreviewCard } from "@/components/marketing/home/ReportPreviewCard";
import { HOMEPAGE_FAQ } from "@/content/faq";
import { DISCOVER_HREF, PRIMARY_CTA_LABEL } from "@/content/nav-links";

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

      {/* C. Why Pathways */}
      <Section tone="default" ariaLabelledBy="why-heading" narrow>
        <h2 id="why-heading">We start with your student—not with one school.</h2>
        <p>
          Pathways is an education pathways ecosystem, not a single school or program. It
          can involve different schooling models, supplemental support, and outside
          opportunities working together around your student.
        </p>
        <p>
          Many families keep their current school and simply add support around it. A
          school change is never assumed, and nothing here pushes every family toward one
          provider.
        </p>
      </Section>

      {/* D. How it works */}
      <Section tone="alt" ariaLabelledBy="how-heading">
        <h2 id="how-heading">How it works</h2>
        <p>
          A preliminary Discovery Report is available to every family. Deeper services --
          an advisor conversation, a full Student Success Blueprint, ongoing support --
          depend on availability and staffing, and are never presented as automatic.
        </p>
        <JourneyList />
      </Section>

      {/* E. The Discovery Report */}
      <Section tone="default" ariaLabelledBy="report-heading">
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <h2 id="report-heading">See what a Discovery Report helps you understand</h2>
          <p style={{ marginInline: "auto" }}>
            What matters most to your family, directions worth exploring, relevant
            possibilities, and questions for a planning conversation.
          </p>
        </div>
        <ReportPreviewCard />
      </Section>

      {/* F. Freedom and opportunity */}
      <Section tone="inverse" ariaLabelledBy="freedom-heading">
        <h2 id="freedom-heading">The goal isn&apos;t less education. It&apos;s a more intentional education.</h2>
        <p>
          Flexibility can connect to what already matters to your family: athletics,
          schedules and travel, appropriate academic challenge, college-focused planning
          for older students, and the arts, interests and enrichment that round out a
          student&apos;s life.
        </p>
      </Section>

      {/* G. Parent questions */}
      <Section tone="alt" ariaLabelledBy="faq-heading" narrow>
        <h2 id="faq-heading">Questions parents ask</h2>
        <Faq items={HOMEPAGE_FAQ} />
      </Section>

      {/* H. Final invitation */}
      <Section tone="accent-tint" ariaLabelledBy="cta-heading">
        <Card>
          <div style={{ textAlign: "center" }}>
            <h2 id="cta-heading">Explore what&apos;s possible for your student</h2>
            <p style={{ marginInline: "auto" }}>
              A preliminary Discovery Report takes just a few minutes, and there&apos;s no
              account required to see where it leads.
            </p>
            <ButtonLink href={DISCOVER_HREF} variant="primary">
              {PRIMARY_CTA_LABEL}
            </ButtonLink>
          </div>
        </Card>
      </Section>
    </>
  );
}
