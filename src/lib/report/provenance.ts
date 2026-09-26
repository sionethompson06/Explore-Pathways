import type { ContentProvenance } from "./types";

/** Small helper so every section builds its provenance the same shape (section 53). Never rendered to the parent. */
export function provenance(
  contentId: string,
  extra?: Partial<Omit<ContentProvenance, "contentId">>,
): ContentProvenance {
  return { contentId, ...extra };
}
