import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import "./globals.css";

/**
 * The sole decorative "handwritten accent" typeface (Phase 2B visual
 * direction) -- Caveat, SIL Open Font License, served from Google
 * Fonts and self-hosted by Next.js at build time (no client-side
 * request to Google). Never used for buttons, instructions, or any
 * accessibility-critical text -- see components that use
 * var(--font-handwritten).
 */
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-handwritten",
  display: "swap",
});

/**
 * Phase 2 marketing site shell. `robots: { index: false, follow:
 * false }` is deliberate and must stay set through this development
 * preview -- per the Phase 2 authorization, this version is not
 * authorized for public search indexing until a separate live-launch
 * decision. app/robots.ts enforces the same thing at the crawler
 * level (belt-and-suspenders, not redundant: a page-level meta tag
 * and a site-level robots.txt are both checked by real crawlers).
 */
export const metadata: Metadata = {
  title: {
    default: "Pathways — Explore Education Possibilities for Your Student",
    template: "%s | Pathways",
  },
  description:
    "An education pathways ecosystem that starts with your student, not with one school.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={caveat.variable}>
      <body>
        <MarketingLayout>{children}</MarketingLayout>
      </body>
    </html>
  );
}
