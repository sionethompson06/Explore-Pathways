/** Phase 6C shared staff-UI formatting helpers -- display only, never used for sorting/filtering logic. */

export function formatStaffDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}
