/**
 * GitHub bug logger — creates a GitHub Issue with label "bug"
 * using the gh CLI (already authenticated via gh auth login).
 */

import { execSync } from 'child_process';
import { BugReport, CreatedBug } from './types';

export function logGitHubBug(bug: BugReport): CreatedBug {
  if (!bug.repo) {
    throw new Error('GitHub bug logging requires --repo owner/repo');
  }

  const body = buildGitHubBody(bug);

  const result = execSync(
    `gh issue create \
      --repo "${bug.repo}" \
      --title "${escapeShell(bug.title)}" \
      --label "bug" \
      --body "${escapeShell(body)}"`,
    { encoding: 'utf-8' }
  ).trim();

  // gh returns the issue URL, e.g. https://github.com/owner/repo/issues/42
  const bugId = result.split('/').pop() || '';

  return {
    source: 'github',
    bugId,
    bugLink: result,
    title: bug.title,
  };
}

function buildGitHubBody(bug: BugReport): string {
  const steps = bug.stepsToReproduce
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');

  const linkedIssue = bug.issueId
    ? `\n**Requirement:** ${bug.issueId}\n`
    : '';

  return `## Bug Report — swayambhu-qa
${linkedIssue}
**Caught by:** ${bug.tool} — \`${bug.tcId}: ${bug.tcTitle}\`
**Feature:** ${bug.featureSlug}

## Steps to Reproduce
${steps}

## Expected Result
${bug.expectedResult}

## Actual Result
${bug.actualResult}

## Error
\`\`\`
${bug.errorMessage}
${bug.stackTrace ? '\n' + bug.stackTrace : ''}
\`\`\`

---
*Logged automatically by [swayambhu-qa](https://github.com/yoggit/swayambhu-qa)*`;
}

function escapeShell(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/`/g, '\\`');
}
