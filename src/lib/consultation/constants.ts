/**
 * Phase 6A shared constants (docs/pathways instruction sections 14/33/34).
 * No client/server-only restriction -- these are plain literals safe
 * to import from either side.
 */

/** The planning call is presented as free and 45 minutes everywhere in the UI. The external Google schedule itself must independently be configured for this duration -- this app cannot verify that. */
export const PLANNING_CALL_DURATION_MINUTES = 45;

/** Version tag for the explicit pre-auth contact-consent copy a parent agrees to before submitting contact info (section 21). Bump this only when the actual consent copy changes. */
export const PLANNING_CONTACT_CONSENT_VERSION = "PLANNING_CONTACT_V1";

export const PLANNING_CONTACT_CONSENT_COPY =
  "By continuing, you agree that Pathways may contact you by email or phone about this planning request. This does not subscribe you to marketing messages.";

export const CALL_FORMAT_VALUES = ["VIDEO", "PHONE"] as const;
export type CallFormat = (typeof CALL_FORMAT_VALUES)[number];
export const DEFAULT_CALL_FORMAT: CallFormat = "VIDEO";
