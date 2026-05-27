/**
 * run-tests.ts — Phase 5: run generated tests and produce a results JSON.
 *
 * Runs Playwright (or other tools) with a JSON reporter, reads the output,
 * maps each test to its TC ID via the `tcId` annotation, aggregates results
 * per TC (any failure = TC failed), resolves the Xray key from the mapping
 * file written by push-to-tms.ts, and writes reports/results-<issueId>.json.
 *
 * Usage:
 *   npx ts-node scripts/run-tests.ts \
 *     --id TEST-22 \
 *     --spec tests/generated/budget-tracker.spec.ts \
 *     [--tool playwright]       # default: playwright
 *     [--project chromium]      # Playwright project filter (optional)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { logger } from './logger';
import { TestResult, ExecutionStatus } from './tms/types';

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const issueId = getArg('--id') || '';
const specFile = getArg('--spec') || '';
const tool = getArg('--tool') || 'playwright';
const project = getArg('--project');

if (!issueId || !specFile) {
  console.error('Error: --id <id> and --spec <path> are required');
  console.error('Usage: npx ts-node scripts/run-tests.ts --id TEST-22 --spec tests/generated/budget-tracker.spec.ts');
  process.exit(1);
}

// ─── TC → Xray key mapping ────────────────────────────────────────────────────

function loadTcMapping(issue: string): Record<string, string> {
  const mappingPath = path.join('reports', `tc-mapping-${issue}.json`);
  if (!fs.existsSync(mappingPath)) {
    console.error(`Warning: TC mapping not found at ${mappingPath} — nativeId will be empty`);
    return {};
  }
  return JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
}

// ─── Playwright JSON report helpers ──────────────────────────────────────────

interface PwResult {
  status: string;
  duration: number;
  error?: { message: string };
}

interface PwTest {
  status: string;
  annotations: { type: string; description: string }[];
  results: PwResult[];
}

interface PwSpec {
  title: string;
  ok: boolean;
  annotations: { type: string; description: string }[];
  tests: PwTest[];
}

interface PwSuite {
  title: string;
  specs: PwSpec[];
  suites: PwSuite[];
}

interface PwReport {
  suites: PwSuite[];
}

function flattenSpecs(suite: PwSuite): PwSpec[] {
  const specs: PwSpec[] = [...(suite.specs || [])];
  for (const child of suite.suites || []) {
    specs.push(...flattenSpecs(child));
  }
  return specs;
}

// Playwright annotations added via test.info().annotations.push() appear in
// the test run's annotations array (tests[n].annotations), not spec-level.
function getTcId(spec: PwSpec): string | undefined {
  // Check test-level annotations first (runtime push)
  for (const t of spec.tests || []) {
    const ann = t.annotations?.find((a) => a.type === 'tcId');
    if (ann) return ann.description;
  }
  // Fall back to spec-level annotations (definition-time)
  return spec.annotations?.find((a) => a.type === 'tcId')?.description;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const log = logger(issueId);
  const tcMapping = loadTcMapping(issueId);

  const jsonReport = path.join('reports', `pw-results-${issueId}.json`);
  fs.mkdirSync('reports', { recursive: true });

  log.phase(5, 'RUN', `Running ${tool} tests`, { spec: specFile });
  console.error(`🧪 Running tests: ${specFile}`);

  // Run Playwright with JSON reporter — write to file via shell redirect.
  // Playwright exits 1 when tests fail but still writes the full JSON report.
  let runFailed = false;
  const projectFlag = project ? `--project="${project}"` : '';

  try {
    execSync(
      `npx playwright test "${specFile}" --reporter=json ${projectFlag} 1>"${jsonReport}" 2>/dev/null`,
      { shell: true },
    );
  } catch {
    runFailed = true; // exit 1 = test failures; report was still written to file
  }

  if (!fs.existsSync(jsonReport) || fs.statSync(jsonReport).size === 0) {
    log.phase(5, 'FAIL', 'Playwright produced no JSON output');
    console.error('Playwright produced no JSON output — is Playwright installed? (npx playwright install)');
    process.exit(1);
  }

  // Parse the JSON report
  const report: PwReport = JSON.parse(fs.readFileSync(jsonReport, 'utf-8'));
  const allSpecs = report.suites.flatMap(flattenSpecs);

  // Group specs by TC ID — one TC may have multiple Playwright tests covering it.
  // Status: failed if ANY spec for that TC failed; passed if all passed.
  const tcGroups: Record<string, PwSpec[]> = {};

  for (const spec of allSpecs) {
    const tcId = getTcId(spec);
    if (!tcId) continue;
    if (!tcGroups[tcId]) tcGroups[tcId] = [];
    tcGroups[tcId].push(spec);
  }

  const results: TestResult[] = Object.entries(tcGroups).map(([tcId, specs]) => {
    const anyFailed = specs.some((s) => !s.ok);
    const status: ExecutionStatus = anyFailed ? 'failed' : 'passed';

    const errorMessages = specs
      .flatMap((s) => s.tests || [])
      .flatMap((t) => t.results || [])
      .map((r) => r.error?.message)
      .filter(Boolean)
      .slice(0, 2)
      .join(' | ');

    const totalDuration = specs
      .flatMap((s) => s.tests || [])
      .flatMap((t) => t.results || [])
      .reduce((sum, r) => sum + (r.duration || 0), 0);

    return {
      tcId,
      nativeId: tcMapping[tcId] || '',
      status,
      tool: 'Playwright',
      errorMessage: errorMessages || undefined,
      durationMs: totalDuration,
      healAttempts: 0,
    };
  });

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  log.phase(5, runFailed && failed > 0 ? 'FAIL' : 'OK', `Tests complete`, {
    total: results.length,
    passed,
    failed,
    specCount: allSpecs.length,
  });

  console.error(`${failed > 0 ? '❌' : '✅'} Tests: ${passed} passed, ${failed} failed (${allSpecs.length} total specs across ${results.length} TCs)`);

  // Write results JSON for update-tms-status
  const resultsPath = path.join('reports', `results-${issueId}.json`);
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.error(`   Results written: ${resultsPath}`);

  // Also print to stdout for pipeline chaining
  console.log(JSON.stringify(results, null, 2));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('run-tests failed:', err);
  process.exit(1);
});
