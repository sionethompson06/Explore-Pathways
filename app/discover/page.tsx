import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { ButtonLink } from "@/components/marketing/Button";
import { FAMILY_GOALS, isGoalInterest, getGoalByInterest } from "@/content/goals";
import { startDiscoveryAction } from "./actions";
import styles from "./discover.module.css";

export const metadata: Metadata = {
  title: "Discover",
  description: "Start your student's Pathways Discovery profile.",
  robots: { index: false, follow: false },
};

/**
 * The real Discovery entry point (Phase 3 instruction §5) -- replaces
 * the Phase 2 "questionnaire is not enabled yet" preview. An
 * allowlisted `?interest=` is still read here (marketing handoff,
 * §6), but it is only ever passed along as a hidden form field to
 * startDiscoveryAction, which converts it to an editable DISC_006
 * preselection hint server-side -- this page itself never writes it
 * anywhere, and it never becomes part of /discover/profile's URL.
 *
 * Phase 3C: reads `process.env.DEPLOYMENT_MODE` directly (the raw,
 * unvalidated value), never the validated `env` export from
 * `@/env`. `@/env`'s own loadEnv() throws synchronously, per DEC-G7,
 * whenever DEPLOYMENT_MODE is not LOCAL and DATABASE_URL is still a
 * loopback placeholder -- exactly the current Vercel Preview
 * configuration this feature exists to work around. Importing it
 * here (even lazily, inside this function) would make this page
 * crash to error.tsx before the Preview Demo Mode CTA below could
 * ever render, defeating the point. A plain string compare needs no
 * validation, so it deliberately never touches that module.
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
  const isPreviewDemoAvailable = process.env.DEPLOYMENT_MODE === "PREVIEW";
  const demoHref = selectedGoal
    ? `/discover/demo?interest=${selectedGoal.interest}`
    : "/discover/demo";

  return (
    <>
      <PageHero
        headingId="discover-heading"
        eyebrow="Discover"
        title="Let's Start With What You're Hoping to Make Possible"
        subtitle="Answer a few questions about your student, your family's priorities, and what you'd like education to make possible."
      />

      <Section tone="default" ariaLabelledBy="discover-status-heading" narrow>
        <h2 id="discover-status-heading" className="visually-hidden">
          Start Discovery
        </h2>
        <Card>
          {selectedGoal ? (
            <>
              <p className={styles.selectedLabel}>You selected:</p>
              <p className={styles.selectedGoal}>{selectedGoal.label}</p>
              <p>{selectedGoal.description}</p>
            </>
          ) : (
            <p>Choose the starting point that fits best -- you can always change this.</p>
          )}

          <ul className={styles.explainerList}>
            <li>Your answers adapt the questions we show next -- nobody answers every question.</li>
            <li>You can go back and change an earlier answer at any point before you finish.</li>
            <li>No account or email is required to complete Discovery.</li>
            <li>
              Discovery is exploratory -- it does not determine school eligibility or make a
              placement decision.
            </li>
          </ul>

          {isPreviewDemoAvailable ? (
            <div className={styles.demoCallout}>
              <p className={styles.demoCalloutLabel}>Try it without saving anything</p>
              <p>
                The hosted database for this Preview environment isn&apos;t configured yet, so
                real Discovery sessions can&apos;t be saved here. You can still click through the
                full questionnaire in Preview Demo Mode -- nothing you enter is stored.
              </p>
              <ButtonLink href={demoHref} variant="primary">
                Preview the Discovery Experience
              </ButtonLink>
            </div>
          ) : null}

          <div className={isPreviewDemoAvailable ? styles.realStartBlock : undefined}>
            {isPreviewDemoAvailable ? (
              <p className={styles.realStartLabel}>
                Setting up the real, database-backed Discovery for later?
              </p>
            ) : null}
            <form action={startDiscoveryAction} className={styles.startForm}>
              {selectedGoal ? (
                <input type="hidden" name="interest" value={selectedGoal.interest} />
              ) : null}
              <button type="submit" className={styles.startButton}>
                Start My Discovery
              </button>
              <ButtonLink href="/how-it-works" variant="secondary">
                How Pathways Works
              </ButtonLink>
            </form>
          </div>

          <p className={styles.devNotice}>
            Development preview -- please use sample information only while we finish building
            Pathways.
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
