/**
 * read-from-tms.ts — Multi-TMS test case reader dispatcher
 *
 * Reads test cases from the configured TMS and outputs a structured JSON list.
 * Used by /automate-from-tms to load TCs before generating automation code.
 *
 * Usage:
 *   npx ts-node scripts/read-from-tms.ts --tms testRail --issue QA-42
 *   npx ts-node scripts/read-from-tms.ts --tms testRail --suite "Login Tests"
 *   npx ts-node scripts/read-from-tms.ts --tms xray --case TC-1-01,TC-1-03
 *   npx ts-node scripts/read-from-tms.ts --tms zephyr --issue ENG-456
 *   npx ts-node scripts/read-from-tms.ts --tms markdown --issue 42
 *
 * Outputs: JSON array of TestCase objects to stdout
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { readTestRailTCs } from './tms/testrail';
import { readXrayTCs } from './tms/xray';
import { readZephyrTCs } from './tms/zephyr';
import { readMarkdownTCs } from './tms/markdown';
import { TMSType } from './tms/types';

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const tms = (getArg('--tms') || 'markdown') as TMSType;
const issueId = getArg('--issue');
const suite = getArg('--suite');
const caseIdsRaw = getArg('--case');
const caseIds = caseIdsRaw ? caseIdsRaw.split(',').map((id) => id.trim()) : undefined;

if (!issueId && !suite && !caseIds?.length) {
  console.error('Error: provide one of --issue <id>, --suite <name>, or --case <ids>');
  console.error('Usage: npx ts-node scripts/read-from-tms.ts --tms <tms> [--issue|--suite|--case]');
  process.exit(1);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function main() {
  try {
    let result;

    switch (tms) {
      case 'testRail':
        result = await readTestRailTCs({ issueId, suite, caseIds });
        break;
      case 'xray':
        result = await readXrayTCs({ issueId, suite, caseIds });
        break;
      case 'zephyr':
        result = await readZephyrTCs({ issueId, suite, caseIds });
        break;
      case 'markdown':
        result = readMarkdownTCs({ issueId, suite, caseIds });
        break;
      default:
        console.error(`Unknown TMS: "${tms}". Valid options: testRail, xray, zephyr, markdown`);
        process.exit(1);
    }

    // Summary to stderr (visible in terminal), JSON to stdout (for pipeline)
    const byType = result.testCases.reduce<Record<string, number>>((acc, tc) => {
      acc[tc.type] = (acc[tc.type] || 0) + 1;
      return acc;
    }, {});

    console.error(`📋 Loaded ${result.testCases.length} test cases from ${tms}${result.suiteName ? ` — "${result.suiteName}"` : ''}`);
    Object.entries(byType).forEach(([type, count]) => console.error(`   ${type}: ${count}`));

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Failed to read from TMS:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
