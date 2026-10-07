import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Stable entry point -- the operational case queue itself lives at /admin/cases. */
export default function AdminIndexPage() {
  redirect("/admin/cases");
}
