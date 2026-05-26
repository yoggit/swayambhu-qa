/**
 * fetch-issue.ts
 *
 * Reads a GitHub issue and returns a structured QARequirement object.
 * Used by the /qa-pipeline agent as its starting point — replacing JIRA.
 *
 * Usage:
 *   npx ts-node scripts/fetch-issue.ts <owner/repo> <issue-number>
 *
 * Requires: gh CLI authenticated (gh auth login)
 * Output: QARequirement JSON to stdout
 */

import { execSync } from 'child_process';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QARequirement {
  issueNumber: number;
  title: string;
  url: string;
  labels: string[];
  body: string;
  // Extracted structured fields
  summary: string;
  acceptanceCriteria: string[];
  testUrls: { ui?: string; api?: string };
  credentials: { role: string; username: string; password: string }[];
  apiEndpoints: string[];
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'unknown';
  repo: string;
  issueLink: string;
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

function extractSection(body: string, heading: string): string {
  const regex = new RegExp(`##[^#]*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  return body.match(regex)?.[1]?.trim() || '';
}

function extractAcceptanceCriteria(body: string): string[] {
  const section = extractSection(body, 'Acceptance Criteria');
  return section
    .split('\n')
    .filter((l) => l.trim().match(/^-\s*\[.?\]/))
    .map((l) => l.replace(/^-\s*\[.?\]\s*/, '').trim())
    .filter(Boolean);
}

function extractUrls(body: string): { ui?: string; api?: string } {
  const section = extractSection(body, "URL");
  const uiMatch = section.match(/UI:\s*(https?:\/\/[^\s\n]+)/i);
  const apiMatch = section.match(/API[^:]*:\s*(https?:\/\/[^\s\n]+)/i);
  return {
    ui: uiMatch?.[1],
    api: apiMatch?.[1],
  };
}

function extractCredentials(body: string): { role: string; username: string; password: string }[] {
  const section = extractSection(body, 'Credentials');
  const rows = section.split('\n').filter((l) => l.includes('|') && !l.match(/^[\|\s\-]+$/));
  return rows
    .map((row) => {
      const cols = row.split('|').map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 3 && cols[0] && cols[1] && cols[2]) {
        return { role: cols[0], username: cols[1], password: cols[2] };
      }
      return null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.role !== 'Role');
}

function extractApiEndpoints(body: string): string[] {
  const section = extractSection(body, 'API Endpoints');
  return section
    .split('\n')
    .filter((l) => l.trim().match(/^-\s*`?(GET|POST|PUT|DELETE|PATCH)/i))
    .map((l) => l.replace(/^-\s*`?/, '').replace(/`?\s*$/, '').trim())
    .filter(Boolean);
}

function extractPriority(body: string): QARequirement['priority'] {
  if (body.match(/\[x\]\s*P0/i)) return 'P0';
  if (body.match(/\[x\]\s*P1/i)) return 'P1';
  if (body.match(/\[x\]\s*P2/i)) return 'P2';
  if (body.match(/\[x\]\s*P3/i)) return 'P3';
  return 'unknown';
}

function extractSummary(body: string): string {
  return extractSection(body, 'Summary').split('\n').find((l) => l.trim() && !l.startsWith('<!--')) || '';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function fetchIssue(repo: string, issueNumber: number): QARequirement {
  const raw = execSync(`gh issue view ${issueNumber} --repo ${repo} --json number,title,url,labels,body`, {
    encoding: 'utf-8',
  });

  const issue = JSON.parse(raw) as {
    number: number;
    title: string;
    url: string;
    labels: { name: string }[];
    body: string;
  };

  const body = issue.body || '';

  return {
    issueNumber: issue.number,
    title: issue.title,
    url: issue.url,
    labels: issue.labels.map((l) => l.name),
    body,
    summary: extractSummary(body),
    acceptanceCriteria: extractAcceptanceCriteria(body),
    testUrls: extractUrls(body),
    credentials: extractCredentials(body),
    apiEndpoints: extractApiEndpoints(body),
    priority: extractPriority(body),
    repo,
    issueLink: issue.url,
  };
}

// ─── CLI entry ────────────────────────────────────────────────────────────────

const [repo, issueNum] = process.argv.slice(2);

if (!repo || !issueNum) {
  console.error('Usage: npx ts-node scripts/fetch-issue.ts <owner/repo> <issue-number>');
  process.exit(1);
}

try {
  const requirement = fetchIssue(repo, parseInt(issueNum, 10));
  console.log(JSON.stringify(requirement, null, 2));
} catch (err) {
  console.error('Failed to fetch issue:', err instanceof Error ? err.message : err);
  process.exit(1);
}
