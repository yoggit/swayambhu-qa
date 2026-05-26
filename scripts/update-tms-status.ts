/**
 * update-tms-status.ts — Multi-TMS execution result updater dispatcher
 *
 * Reads a results JSON file and writes execution status back to the TMS.
 * Used by /automate-from-tms after tests have run.
 *
 * Usage:
 *   npx ts-node scripts/update-tms-status.ts \
 *     --tms testRail \
 *     --results reports/results.json \
 *     [--run-id 12345]        # TestRail: required Test Run ID
 *     [--issue QA-42]         # Zephyr/Xray: for naming the test cycle
 *
 * Results JSON format:
 * [
 *   {
 *     "tcId": "TC-1-01",
 *     "nativeId": "C1001",
 *     "status": "passed",
 *     "tool": "Playwright",
 *     "errorMessage": "",
 *     "durationMs": 1234
 *   },
 *   ...
 * ]
 *
 * Status values: passed | failed | flaky | skipped | blocked
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

import { logger } from './logger';

import { updateTestRailResults } from './tms/testrail';
import { updateXrayResults } from './tms/xray';
import { updateZephyrResults } from './tms/zephyr';
import { updateMarkdownResults } from './tms/markdown';
import { TMSType, TestResult } from './tms/types';

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const tms = (getArg('--tms') || 'markdown') as TMSType;
const resultsFile = getArg('--results') || '';
const runId = getArg('--run-id') || '';           // TestRail: Test Run ID
const issueId = getArg('--issue') || '';          // Xray/Zephyr: requirement issue
const featureSlug = getArg('--feature') || '';    // Markdown: feature slug for filename

if (!resultsFile) {
  console.error('Error: --results <path> is required');
  console.error('Usage: npx ts-node scripts/update-tms-status.ts --tms <tms> --results reports/results.json');
  process.exit(1);
}

if (!fs.existsSync(resultsFile)) {
  console.error(`Error: results file not found: ${resultsFile}`);
  process.exit(1);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function main() {
  const log = logger(issueId || 'unknown');
  const results: TestResult[] = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));

  const summary = results.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const healed = results.filter((r) => (r.healAttempts || 0) > 0).length;

  log.phase(8, 'RUN', `Updating ${results.length} results in ${tms}`, {
    passed: summary.passed || 0,
    failed: summary.failed || 0,
    flaky: summary.flaky || 0,
    healed,
  });

  console.error(`📊 Updating ${results.length} results in ${tms}`);
  console.error(`   Passed: ${summary.passed || 0} ✅  Failed: ${summary.failed || 0} ❌  Healed: ${healed} 🔁`);

  try {
    let result: any;

    switch (tms) {
      case 'testRail':
        if (!runId) {
          console.error('Error: --run-id is required for TestRail status updates');
          process.exit(1);
        }
        result = await updateTestRailResults({ runId, results });
        break;

      case 'xray':
        result = await updateXrayResults({ issueId, results });
        break;

      case 'zephyr':
        result = await updateZephyrResults({ issueId, results });
        break;

      case 'markdown':
        if (!issueId || !featureSlug) {
          console.error('Error: --issue and --feature are required for markdown TMS updates');
          process.exit(1);
        }
        result = updateMarkdownResults({ issueId, featureSlug, results });
        break;

      default:
        console.error(`Unknown TMS: "${tms}". Valid options: testRail, xray, zephyr, markdown`);
        process.exit(1);
    }

    log.phase(8, 'OK', `Test Execution created in ${tms}`, {
      executionKey: result.executionKey,
      updated: result.updated,
      failed: result.failed,
    });

    console.error(`✅ Updated ${result.updated} / ${results.length} test results in ${tms}`);
    if (result.executionKey) console.error(`   Test Execution: ${result.executionKey}`);
    if (result.failed > 0) {
      log.warn(`${result.failed} result updates failed in ${tms}`);
      console.error(`⚠️  ${result.failed} updates failed — check TMS connection and TC IDs`);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    log.phase(8, 'FAIL', `Failed to update ${tms}`, { error: err instanceof Error ? err.message : String(err) });
    console.error('Failed to update TMS status:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
