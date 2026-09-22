import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { Badge } from "@/components/marketing/Badge";
import { FAMILY_GOALS, isGoalInterest, getGoalByInterest } from "@/content/goals";
import styles from "./discover.module.css";

export const metadata: Metadata = {
  title: "Discover",
  description: "Start exploring your student's education pathway.",
};

/**
 * The honest Phase 2 entry point for Discovery -- not the Phase 3
 * questionnaire. It may show and let a visitor change an allowlisted
 * interest, and must state plainly that the real questionnaire isn't
 * enabled yet. It collects nothing: the "interest" lives only in the
 * URL query string, is validated against a closed allowlist before
 * ever being rendered, and an unrecognized value is silently ignored
 * rather than reflected into the page -- never trust `?interest=`.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ interest?: string | string[] }>;
}) {
  const resolvedParams = await searchParams;
  const rawInterest = Array.isArray(resolvedParams.interest)
    ? resolvedParams.interest[0]
    : resolvedParams.interest;
  const selectedGoal =
    rawInterest && isGoalInterest(rawInterest) ? getGoalByInterest(rawInterest) : undefined;

  return (
    <>
      <PageHero
        headingId="discover-heading"
        eyebrow="Discover"
        title="Let's start with what you're hoping to make possible"
        subtitle="This preview shows how Discovery will begin. The full questionnaire isn't enabled in this development version yet."
      />

      <Section tone="default" ariaLabelledBy="discover-status-heading" narrow>
        <h2 id="discover-status-heading" className="visually-hidden">
          Status
        </h2>
        <Card>
          <div style={{ marginBottom: "var(--space-4)" }}>
            <Badge>Development preview — the Discovery questionnaire is not enabled yet</Badge>
          </div>

          {selectedGoal ? (
            <>
              <p className={styles.selectedLabel}>You selected:</p>
              <p className={styles.selectedGoal}>{selectedGoal.label}</p>
              <p>{selectedGoal.description}</p>
            </>
          ) : (
            <p>Choose the starting point that fits best -- you can always change this.</p>
          )}

          <p style={{ marginBottom: 0 }}>
            Nothing you select here is saved, submitted, or turned into a student record.
            No email or account is required to look around, and no consultation is
            requested by visiting this page.
          </p>
        </Card>
      </Section>

      <Section tone="alt" ariaLabelledBy="discover-change-heading">
        <h2 id="discover-change-heading">Change your starting point</h2>
        <ul className={styles.goalList}>
          {FAMILY_GOALS.map((goal) => (
            <li key={goal.interest}>
              <Link
                href={`/discover?interest=${goal.interest}`}
                className={
                  selectedGoal?.interest === goal.interest
                    ? `${styles.goalLink} ${styles.goalLinkActive}`
                    : styles.goalLink
                }
                aria-current={selectedGoal?.interest === goal.interest ? "true" : undefined}
              >
                {goal.label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="default" ariaLabelledBy="discover-next-heading" narrow>
        <h2 id="discover-next-heading">Not ready yet? Learn more first.</h2>
        <p>
          Read <Link href="/how-it-works">how the Pathways service works</Link>, or explore
          one of the audience-focused pages for{" "}
          <Link href="/pathways/athletes">student athletes</Link>,{" "}
          <Link href="/pathways/homeschool">homeschool families</Link>,{" "}
          <Link href="/pathways/flexible-learning">flexible learning</Link>, or{" "}
          <Link href="/pathways/academic-opportunities">academic opportunities</Link>.
        </p>
      </Section>
    </>
  );
}
