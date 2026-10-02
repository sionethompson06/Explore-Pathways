import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { ThemeGrid } from "@/components/marketing/ThemeGrid";
import { ButtonLink } from "@/components/marketing/Button";
import { AUDIENCE_PAGES, getAudiencePage, type AudiencePage } from "@/content/audience-pages";
import { MARKETING_PHOTOS, type MarketingPhotoKey } from "@/content/marketing-photos";
import { DISCOVER_HREF, PRIMARY_CTA_LABEL } from "@/content/nav-links";

/** Maps each audience page to its required page-hero photography slot -- see docs/pathways/IMAGE_ASSET_MANIFEST.md. */
const PAGE_PHOTO_KEY: Record<AudiencePage["slug"], MarketingPhotoKey> = {
  athletes: "athletePageHero",
  homeschool: "homeschoolPageHero",
  "flexible-learning": "flexibleTravelStudent",
  "academic-opportunities": "academicPageHero",
};

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

  const photo = MARKETING_PHOTOS[PAGE_PHOTO_KEY[page.slug]];

  return (
    <>
      <PageHero
        headingId="audience-heading"
        eyebrow="Explore"
        title={page.title}
        tagline={page.tagline}
        subtitle={page.subtitle}
        photoSrc={photo.path}
        photoAlt={photo.alt}
      />

      <Section tone="default" ariaLabelledBy="audience-intro-heading" narrow>
        <h2 id="audience-intro-heading" className="visually-hidden">
          Overview
        </h2>
        <p>{page.intro}</p>
      </Section>

      <Section tone="alt" ariaLabelledBy="audience-themes-heading">
        <h2 id="audience-themes-heading" style={{ textAlign: "center" }}>
          How Pathways Can Help
        </h2>
        <ThemeGrid items={page.themes} />
        <p
          style={{
            marginTop: "var(--space-5)",
            marginBottom: 0,
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          {page.caveat}
        </p>
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
