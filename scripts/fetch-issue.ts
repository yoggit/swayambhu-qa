/**
 * fetch-issue.ts — Multi-source issue fetcher dispatcher
 *
 * Routes to the correct source fetcher based on --source flag,
 * then returns a normalized QARequirement JSON to stdout.
 * The rest of the /qa-pipeline is fully source-agnostic.
 *
 * Usage:
 *   npx ts-node scripts/fetch-issue.ts <issue-id> --source github --repo owner/repo
 *   npx ts-node scripts/fetch-issue.ts QA-42      --source jira
 *   npx ts-node scripts/fetch-issue.ts 12345      --source ado
 *   npx ts-node scripts/fetch-issue.ts ENG-456    --source linear
 *
 * Required env vars per source — see .env.example
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { logger } from './logger';
import { fetchGitHubIssue } from './sources/github';
import { fetchJiraIssue } from './sources/jira';
import { fetchAdoWorkItem } from './sources/ado';
import { fetchLinearIssue } from './sources/linear';
import { Source } from './sources/types';

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const issueId = getArg('--issue') as string;
const source = (getArg('--source') || 'github') as Source;
const repo = getArg('--repo') || '';

if (!issueId) {
  console.error('Usage: npx ts-node scripts/fetch-issue.ts --issue <id> --source github|jira|ado|linear [--repo owner/repo]');
  console.error('');
  console.error('Examples:');
  console.error('  npx ts-node scripts/fetch-issue.ts --issue 42     --source github --repo myorg/myrepo');
  console.error('  npx ts-node scripts/fetch-issue.ts --issue QA-42  --source jira');
  console.error('  npx ts-node scripts/fetch-issue.ts --issue 12345  --source ado');
  console.error('  npx ts-node scripts/fetch-issue.ts --issue ENG-42 --source linear');
  process.exit(1);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function main() {
  const log = logger(issueId);
  log.phase(1, 'RUN', `Fetching ${issueId} from ${source}`);

  try {
    let requirement;

    switch (source) {
      case 'github':
        if (!repo) {
          console.error('Error: --repo owner/repo is required for GitHub source');
          process.exit(1);
        }
        requirement = fetchGitHubIssue(issueId, repo as string);
        break;

      case 'jira':
        requirement = await fetchJiraIssue(issueId as string);
        break;

      case 'ado':
        requirement = await fetchAdoWorkItem(issueId as string);
        break;

      case 'linear':
        requirement = await fetchLinearIssue(issueId as string);
        break;

      default:
        console.error(`Unknown source: "${source}". Valid options: github, jira, ado, linear`);
        process.exit(1);
    }

    log.phase(1, 'OK', `Fetched: "${(requirement as any).title}"`, {
      priority: (requirement as any).priority,
      ui: (requirement as any).testUrls?.ui,
      api: (requirement as any).testUrls?.api,
      acs: (requirement as any).acceptanceCriteria?.length,
    });

    console.log(JSON.stringify(requirement, null, 2));
  } catch (err) {
    log.phase(1, 'FAIL', `Failed to fetch ${issueId}`, { error: err instanceof Error ? err.message : String(err) });
    console.error('Failed to fetch issue:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
