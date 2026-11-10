"use client";

import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import buttonStyles from "@/components/marketing/Button.module.css";

/**
 * Scoped to /discover and everything under it (/discover/profile,
 * /discover/report) -- Phase 3B, requirement 9. If the Discovery
 * flow's own server-side work throws (most commonly a temporarily
 * unreachable database), this replaces Next.js's generic "This page
 * couldn't load" with a calm, honest, infrastructure-appropriate
 * message. It never surfaces the underlying error's message, host,
 * SQL, or any credential -- Next.js already redacts a thrown Server
 * Component/Action error's message in a production build (both
 * Preview and Production deployments build in production mode), and
 * this component deliberately does not attempt to show anything
 * beyond the fixed copy below. `retry()` re-renders the segment
 * without a full page reload, which is enough to recover once the
 * underlying condition (e.g. the database becoming reachable again)
 * clears; nothing already saved is lost by this happening, since nothing
 * here discards the stored draft.
 */
export default function DiscoverError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Section tone="default" ariaLabelledBy="discover-error-heading" narrow>
      <h1 id="discover-error-heading">Discovery Is Temporarily Unavailable</h1>
      <Card>
        <p>Discovery is temporarily unavailable. Please try again shortly.</p>
        <p style={{ marginBottom: 0 }}>
          Nothing you&apos;ve already answered has been lost -- your saved answers are still there
          once Discovery is reachable again.
        </p>
      </Card>
      <div style={{ marginTop: "var(--space-5)" }}>
        <button
          type="button"
          className={`${buttonStyles.button} ${buttonStyles.primary}`}
          onClick={() => retry()}
        >
          Try Again
        </button>
      </div>
    </Section>
  );
}
