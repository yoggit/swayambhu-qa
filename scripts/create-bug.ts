/**
 * create-bug.ts — Multi-source bug logging dispatcher
 *
 * Routes to the correct bug logger based on --source flag.
 * Accepts bug details as CLI args or reads from a JSON file.
 *
 * Usage:
 *   npx ts-node scripts/create-bug.ts \
 *     --source github \
 *     --repo owner/repo \
 *     --tc-id TC-1-05 \
 *     --tc-title "User can log out" \
 *     --tool "Playwright" \
 *     --feature "secure-bank-login" \
 *     --title "Logout button does not navigate back to login" \
 *     --actual "User stays on /bank/dashboard after clicking logout" \
 *     --expected "User is redirected to /login" \
 *     --error "Error: expect(received).toHaveURL(expected)"
 *
 *   # Or pass the full BugReport as JSON (easier from pipeline scripts):
 *   npx ts-node scripts/create-bug.ts --source jira --json '{"title":"...","tcId":"...",...}'
 *
 * Required env vars per source — see .env.example
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { logGitHubBug } from './bugs/github';
import { logJiraBug } from './bugs/jira';
import { logAdoBug } from './bugs/ado';
import { logLinearBug } from './bugs/linear';
import { BugReport, BugSource } from './bugs/types';

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const source = (getArg('--source') || 'github') as BugSource;
const jsonArg = getArg('--json');

function buildBugFromArgs(): BugReport {
  const stepsRaw = getArg('--steps') || '';
  return {
    title: getArg('--title') || 'Bug detected by swayambhu-qa',
    tcId: getArg('--tc-id') || '',
    tcTitle: getArg('--tc-title') || '',
    tool: getArg('--tool') || '',
    featureSlug: getArg('--feature') || '',
    stepsToReproduce: stepsRaw ? stepsRaw.split('|').map((s) => s.trim()) : [],
    expectedResult: getArg('--expected') || '',
    actualResult: getArg('--actual') || '',
    errorMessage: getArg('--error') || '',
    stackTrace: getArg('--stack'),
    issueId: getArg('--issue-id'),
    issueSource: (getArg('--issue-source') || source) as BugSource,
    repo: getArg('--repo'),
  };
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function main() {
  let bug: BugReport;

  if (jsonArg) {
    bug = JSON.parse(jsonArg) as BugReport;
    if (!bug.repo && getArg('--repo')) bug.repo = getArg('--repo');
  } else {
    bug = buildBugFromArgs();
  }

  if (!bug.title) {
    console.error('Error: --title is required (or pass --json with a full BugReport)');
    printUsage();
    process.exit(1);
  }

  try {
    let created;

    switch (source) {
      case 'github':
        created = logGitHubBug(bug);
        break;
      case 'jira':
        created = await logJiraBug(bug);
        break;
      case 'ado':
        created = await logAdoBug(bug);
        break;
      case 'linear':
        created = await logLinearBug(bug);
        break;
      default:
        console.error(`Unknown source: "${source}". Valid options: github, jira, ado, linear`);
        process.exit(1);
    }

    console.log(JSON.stringify(created, null, 2));
    console.error(`✅ Bug logged: ${created.bugId} — ${created.bugLink}`);
  } catch (err) {
    console.error('Failed to log bug:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

function printUsage() {
  console.error(`
Usage: npx ts-node scripts/create-bug.ts --source <source> [options]

Sources: github | jira | ado | linear

Options:
  --title       Bug title (required)
  --tc-id       TC ID that caught it, e.g. TC-1-05
  --tc-title    TC title
  --tool        Automation tool, e.g. Playwright
  --feature     Feature slug, e.g. secure-bank-login
  --steps       Steps to reproduce, pipe-separated: "Step 1|Step 2|Step 3"
  --expected    Expected result from TC
  --actual      Actual result observed
  --error       Error or assertion message
  --stack       Stack trace (optional)
  --issue-id    Original requirement issue ID (to link the bug)
  --repo        GitHub: owner/repo (required for github source)
  --json        Pass full BugReport as JSON string instead of individual flags
`);
}

main();
