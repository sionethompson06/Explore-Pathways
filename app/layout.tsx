import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pathways Discovery App (Phase 1 foundation)",
  description:
    "Internal development build. Not a public Pathways product page.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
