import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </>
  );
}
