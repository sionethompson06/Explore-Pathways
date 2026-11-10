import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Stable entry point -- the advisor queue itself lives at /advisor/cases. */
export default function AdvisorIndexPage() {
  redirect("/advisor/cases");
}
