import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests that need real PostgreSQL are separated out
    // so `pnpm test:unit`-style runs can skip them when no database is
    // available, without ever silently reporting them as passed.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Test-only: see tests/helpers/server-only-shim.ts for why this
      // alias exists and why it does not weaken the real app build's
      // server/client boundary enforcement (that's Next.js's own
      // bundler, untouched by this file).
      "server-only": path.resolve(
        import.meta.dirname,
        "./tests/helpers/server-only-shim.ts",
      ),
    },
  },
});
