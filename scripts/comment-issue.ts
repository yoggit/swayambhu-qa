/**
 * comment-issue.ts — Multi-source issue comment dispatcher
 *
 * Routes to the correct comment poster based on --source flag.
 * Used by the QA pipeline to post TC summary comments back to the original ticket.
 *
 * Usage:
 *   npx ts-node scripts/comment-issue.ts \
 *     --source github \
 *     --repo owner/repo \
 *     --id 42 \
 *     --body "## Test Cases Created ..."
 *
 *   # Pass body from a file (useful for long summaries):
 *   npx ts-node scripts/comment-issue.ts --source jira --id QA-42 --body-file reports/summary.md
 *
 * Required env vars per source — see .env.example
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

import { postGitHubComment } from './comments/github';
import { postJiraComment } from './comments/jira';
import { postAdoComment } from './comments/ado';
import { postLinearComment } from './comments/linear';
import { CommentSource, IssueComment } from './comments/types';

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const source = (getArg('--source') || 'github') as CommentSource;
const issueId = getArg('--id') || '';
const repo = getArg('--repo');
const bodyArg = getArg('--body');
const bodyFile = getArg('--body-file');

if (!issueId) {
  console.error('Error: --id <id> is required');
  console.error('Usage: npx ts-node scripts/comment-issue.ts --source <source> --id <id> --body "..."');
  process.exit(1);
}

let body = bodyArg || '';
if (bodyFile) {
  if (!fs.existsSync(bodyFile)) {
    console.error(`Error: --body-file "${bodyFile}" not found`);
    process.exit(1);
  }
  body = fs.readFileSync(bodyFile, 'utf-8');
}

if (!body) {
  console.error('Error: --body or --body-file is required');
  process.exit(1);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function main() {
  const comment: IssueComment = { issueId, body, repo };

  try {
    let posted;

    switch (source) {
      case 'github':
        posted = postGitHubComment(comment);
        break;
      case 'jira':
        posted = await postJiraComment(comment);
        break;
      case 'ado':
        posted = await postAdoComment(comment);
        break;
      case 'linear':
        posted = await postLinearComment(comment);
        break;
      default:
        console.error(`Unknown source: "${source}". Valid options: github, jira, ado, linear`);
        process.exit(1);
    }

    console.log(JSON.stringify(posted, null, 2));
    console.error(`✅ Comment posted on ${source} issue ${posted.issueId}`);
  } catch (err) {
    console.error('Failed to post comment:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
