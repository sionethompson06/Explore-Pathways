import { readFileSync } from "node:fs";

/**
 * A defense-in-depth CI guard, separate from and in addition to
 * REQUIRE_TEST_DATABASE (tests/helpers/db.ts): even if the
 * PostgreSQL-dependent test *files* were accidentally excluded from
 * a run (a broken vitest include glob, a renamed/deleted file, a
 * future refactor) rather than merely lacking a database, `pnpm test`
 * would otherwise exit 0 with no failing assertions and no visible
 * signal that required coverage silently vanished. This script reads
 * vitest's own JSON report and fails loudly if that happened.
 *
 * Local/CI use only; not imported by any application code.
 */

const REQUIRED_INTEGRATION_TEST_FILES = [
  "tests/session.test.ts",
  "tests/access-control.test.ts",
];

const reportPath = process.argv[2];
if (!reportPath) {
  console.error(
    "Usage: tsx scripts/assert-integration-tests-ran.ts <vitest-json-report-path>",
  );
  process.exit(1);
}

interface VitestAssertionResult {
  status: "passed" | "failed" | "pending" | "skipped" | "todo";
}
interface VitestFileResult {
  name: string;
  status: string;
  assertionResults: VitestAssertionResult[];
}
interface VitestJsonReport {
  testResults: VitestFileResult[];
}

let report: VitestJsonReport;
try {
  report = JSON.parse(readFileSync(reportPath, "utf-8"));
} catch (cause) {
  console.error(`Could not read/parse vitest report at ${reportPath}:`, cause);
  process.exit(1);
}

let ok = true;

for (const requiredFile of REQUIRED_INTEGRATION_TEST_FILES) {
  const match = report.testResults.find((r) => r.name.endsWith(requiredFile));

  if (!match) {
    console.error(
      `REQUIRED INTEGRATION SUITE DID NOT RUN: no result found for "${requiredFile}" ` +
        "in the vitest report. This is exactly the failure mode this check exists to catch.",
    );
    ok = false;
    continue;
  }

  const passed = match.assertionResults.filter((a) => a.status === "passed");
  const notPassed = match.assertionResults.filter((a) => a.status !== "passed");

  if (passed.length === 0) {
    console.error(
      `REQUIRED INTEGRATION SUITE DID NOT EXECUTE ANY PASSING TESTS: "${requiredFile}" ` +
        `reported ${match.assertionResults.length} test(s), 0 passed (statuses: ` +
        `${match.assertionResults.map((a) => a.status).join(", ") || "none"}).`,
    );
    ok = false;
    continue;
  }

  if (notPassed.length > 0) {
    console.error(
      `REQUIRED INTEGRATION SUITE HAS NON-PASSING TESTS: "${requiredFile}" has ` +
        `${notPassed.length} test(s) not in the "passed" state ` +
        `(${notPassed.map((a) => a.status).join(", ")}). A skipped or pending test in a ` +
        "required suite is treated the same as a failure here.",
    );
    ok = false;
    continue;
  }

  console.info(`OK: ${requiredFile} -- ${passed.length} test(s) passed.`);
}

if (!ok) {
  console.error(
    "\nRequired PostgreSQL integration coverage did not actually execute. Failing CI.",
  );
  process.exit(1);
}

console.info("\nAll required integration suites executed and passed.");
