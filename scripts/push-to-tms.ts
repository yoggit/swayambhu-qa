/**
 * push-to-tms.ts — Multi-TMS test case pusher dispatcher
 *
 * Reads generated TC markdown and pushes it to the configured TMS.
 * Used by /create-test-cases after human approval.
 *
 * Usage:
 *   npx ts-node scripts/push-to-tms.ts \
 *     --tms testRail \
 *     --id QA-42 \
 *     --file test-cases/TC-QA42-user-login.md
 *
 *   npx ts-node scripts/push-to-tms.ts --tms markdown --id 42 --file test-cases/TC-42-login.md
 *   npx ts-node scripts/push-to-tms.ts --tms xray     --id QA-42 --file test-cases/TC-QA42-login.md
 *   npx ts-node scripts/push-to-tms.ts --tms zephyr   --id QA-42 --file test-cases/TC-QA42-login.md
 *
 * Outputs: JSON with pushed TMS IDs to stdout
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config();

import { logger } from './logger';

import { pushToTestRail } from './tms/testrail';
import { pushToXray } from './tms/xray';
import { pushToZephyr } from './tms/zephyr';
import { saveMarkdownTCs } from './tms/markdown';
import { readMarkdownTCs } from './tms/markdown';
import { TMSType } from './tms/types';

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const tms = (getArg('--tms') || 'markdown') as TMSType;
const issueId = getArg('--id') || '';
const file = getArg('--file') || '';

if (!issueId || !file) {
  console.error('Error: --id <id> and --file <path> are required');
  console.error('Usage: npx ts-node scripts/push-to-tms.ts --tms <tms> --id <id> --file <path>');
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.error(`Error: file not found: ${file}`);
  process.exit(1);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function main() {
  const log = logger(issueId);
  log.phase(3, 'RUN', `Pushing test cases to ${tms}`, { file });

  const content = fs.readFileSync(file, 'utf-8');
  const featureSlug = path.basename(file, '.md').replace(/^TC-[\w]+-/, '');
  const suiteName = `${issueId} — ${featureSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`;

  const parsed = readMarkdownTCs({ issueId });
  const testCases = parsed.testCases;

  if (!testCases.length) {
    log.warn(`No test cases found in ${file}`);
    console.error(`Warning: no test cases found in ${file}`);
  }

  try {
    let result;

    switch (tms) {
      case 'testRail':
        result = await pushToTestRail({ issueId, suiteName, testCases });
        break;
      case 'xray':
        result = await pushToXray({ issueId, suiteName, testCases });
        break;
      case 'zephyr':
        result = await pushToZephyr({ issueId, suiteName, testCases });
        break;
      case 'markdown':
        result = saveMarkdownTCs({ issueId, featureSlug, content });
        break;
      default:
        console.error(`Unknown TMS: "${tms}". Valid options: testRail, xray, zephyr, markdown`);
        process.exit(1);
    }

    log.phase(3, 'OK', `Pushed ${result.pushedIds.length} test cases to ${tms}`, {
      suite: result.suiteName,
      ids: result.pushedIds.join(', '),
    });

    // Write TC ID → TMS key mapping so run-tests.ts can resolve nativeId from TC ID
    if (result.pushedIds.length && testCases.length) {
      const mapping: Record<string, string> = {};
      testCases.forEach((tc, i) => {
        if (result.pushedIds[i]) mapping[tc.id] = result.pushedIds[i];
      });
      // Store suite ID for TestRail — needed to create the test run in Phase 8
      if (result.suiteId) mapping['__suiteId'] = result.suiteId;
      const mappingPath = path.join('reports', `tc-mapping-${issueId}.json`);
      fs.mkdirSync('reports', { recursive: true });
      fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
      console.error(`   📋 TC mapping written: ${mappingPath}`);
    }

    console.error(`✅ Pushed ${result.pushedIds.length} test cases to ${tms}`);
    if (result.suiteName) console.error(`   Suite: ${result.suiteName}`);
    result.pushedIds.forEach((id) => console.error(`   ${id}`));

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    log.phase(3, 'FAIL', `Failed to push to ${tms}`, { error: err instanceof Error ? err.message : String(err) });
    console.error('Failed to push to TMS:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
