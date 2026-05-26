/**
 * GitHub Issues fetcher
 * Reads a GitHub issue via gh CLI and returns a normalized QARequirement.
 *
 * Env vars required: none (uses gh CLI auth)
 * Issue ID format:   42
 * Usage:             npx ts-node scripts/fetch-issue.ts 42 --source github --repo owner/repo
 */

import { execSync } from 'child_process';
import {
  QARequirement,
  parseAcceptanceCriteria,
  parseTestUrls,
  parseCredentials,
  parseApiEndpoints,
  parsePriority,
  parseSummary,
} from './types';

export function fetchGitHubIssue(issueId: string, repo: string): QARequirement {
  const raw = execSync(
    `gh issue view ${issueId} --repo ${repo} --json number,title,url,labels,body`,
    { encoding: 'utf-8' }
  );

  const issue = JSON.parse(raw) as {
    number: number;
    title: string;
    url: string;
    labels: { name: string }[];
    body: string;
  };

  const body = issue.body || '';

  return {
    source: 'github',
    issueId: String(issue.number),
    title: issue.title,
    issueLink: issue.url,
    summary: parseSummary(body),
    acceptanceCriteria: parseAcceptanceCriteria(body),
    testUrls: parseTestUrls(body),
    credentials: parseCredentials(body),
    apiEndpoints: parseApiEndpoints(body),
    priority: parsePriority(body),
    rawBody: body,
  };
}
