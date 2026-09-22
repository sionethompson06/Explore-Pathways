import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { ButtonLink } from "@/components/marketing/Button";
import { AUDIENCE_PAGES, getAudiencePage } from "@/content/audience-pages";
import { DISCOVER_HREF, PRIMARY_CTA_LABEL } from "@/content/nav-links";

export function generateStaticParams() {
  return AUDIENCE_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getAudiencePage(slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.subtitle,
  };
}

export default async function AudiencePathwayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getAudiencePage(slug);
  if (!page) {
    notFound();
  }

  return (
    <>
      <PageHero
        headingId="audience-heading"
        eyebrow="Explore"
        title={page.title}
        subtitle={page.subtitle}
      />

      <Section tone="default" ariaLabelledBy="audience-intro-heading" narrow>
        <h2 id="audience-intro-heading" className="visually-hidden">
          Overview
        </h2>
        <p>{page.intro}</p>
      </Section>

      <Section tone="alt" ariaLabelledBy="audience-points-heading">
        <h2 id="audience-points-heading" className="visually-hidden">
          What Pathways can help with
        </h2>
        <Card>
          <ul style={{ marginBottom: 0 }}>
            {page.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section tone="accent-tint" ariaLabelledBy="audience-cta-heading">
        <div style={{ textAlign: "center" }}>
          <h2 id="audience-cta-heading">Start exploring this direction</h2>
          <ButtonLink href={`${DISCOVER_HREF}?interest=${page.interest}`} variant="primary">
            {PRIMARY_CTA_LABEL}
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
