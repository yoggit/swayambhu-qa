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
import * as path from 'path';
dotenv.config();

import { logger } from './logger';
import { fetchGitHubIssue } from './sources/github';
import { fetchJiraIssue } from './sources/jira';
import { fetchAdoWorkItem } from './sources/ado';
import { fetchLinearIssue } from './sources/linear';
import { fetchFromFile } from './sources/file';
import { Source } from './sources/types';

function fileLogId(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return path.basename(filePath, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const id = getArg('--id') as string;
const sourceArg = getArg('--source');
const source: Source = (sourceArg as Source) || 'file';  // no --source → local file
const repo = getArg('--repo') || '';

if (!id) {
  console.error('Usage: npx ts-node scripts/fetch-issue.ts --id <id|path> [--source github|jira|ado|linear] [--repo owner/repo]');
  console.error('');
  console.error('IMS examples (--source required):');
  console.error('  npx ts-node scripts/fetch-issue.ts --id 42       --source github --repo myorg/myrepo');
  console.error('  npx ts-node scripts/fetch-issue.ts --id QA-42    --source jira');
  console.error('  npx ts-node scripts/fetch-issue.ts --id 12345    --source ado');
  console.error('  npx ts-node scripts/fetch-issue.ts --id ENG-42   --source linear');
  console.error('');
  console.error('File examples (omit --source):');
  console.error('  npx ts-node scripts/fetch-issue.ts --id ./story.md');
  console.error('  npx ts-node scripts/fetch-issue.ts --id requirements/login-feature.txt');
  process.exit(1);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function main() {
  const logId = source === 'file' ? fileLogId(id) : id;
  const log = logger(logId);
  log.phase(1, 'RUN', sourceArg ? `Fetching ${id} from ${source}` : `Reading file: ${id}`);

  try {
    let requirement;

    switch (source) {
      case 'file':
        requirement = await fetchFromFile(id);
        break;

      case 'github':
        if (!repo) {
          console.error('Error: --repo owner/repo is required for GitHub source');
          process.exit(1);
        }
        requirement = fetchGitHubIssue(id, repo as string);
        break;

      case 'jira':
        requirement = await fetchJiraIssue(id);
        break;

      case 'ado':
        requirement = await fetchAdoWorkItem(id);
        break;

      case 'linear':
        requirement = await fetchLinearIssue(id);
        break;

      default:
        console.error(`Unknown source: "${source}". Valid options: file, github, jira, ado, linear`);
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
    log.phase(1, 'FAIL', `Failed to fetch ${logId}`, { error: err instanceof Error ? err.message : String(err) });
    console.error('Failed to fetch issue:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
