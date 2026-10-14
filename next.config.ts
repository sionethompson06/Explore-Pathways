import type { NextConfig } from "next";

/**
 * Minimal Phase 1 app-shell configuration. No marketing pages, no
 * public asset domains, no experimental flags enabled speculatively.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
