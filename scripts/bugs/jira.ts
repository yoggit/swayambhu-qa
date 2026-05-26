/**
 * JIRA bug logger — creates a JIRA issue of type "Bug" via REST API v3.
 *
 * Required env vars:
 *   JIRA_BASE_URL   e.g. https://yourcompany.atlassian.net
 *   JIRA_EMAIL      your.email@company.com
 *   JIRA_API_TOKEN  your Atlassian API token
 *   JIRA_PROJECT_KEY  e.g. QA (used as the project for bug creation)
 */

import { BugReport, CreatedBug } from './types';

export async function logJiraBug(bug: BugReport): Promise<CreatedBug> {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;

  if (!baseUrl || !email || !token || !projectKey) {
    throw new Error(
      'JIRA bug logging requires: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY'
    );
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const description = buildJiraDescription(bug);

  const payload = {
    fields: {
      project: { key: projectKey },
      summary: bug.title,
      issuetype: { name: 'Bug' },
      priority: { name: 'High' },
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: description }],
          },
        ],
      },
      labels: ['swayambhu-qa', 'automated-detection'],
      ...(bug.issueId ? { customfield_10014: bug.issueId } : {}), // Epic link if applicable
    },
  };

  const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`JIRA API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { id: string; key: string; self: string };
  const bugLink = `${baseUrl}/browse/${data.key}`;

  // Link to original requirement issue if provided
  if (bug.issueId) {
    await linkJiraIssues(baseUrl, auth, data.key, bug.issueId);
  }

  return {
    source: 'jira',
    bugId: data.key,
    bugLink,
    title: bug.title,
  };
}

async function linkJiraIssues(
  baseUrl: string,
  auth: string,
  bugKey: string,
  requirementKey: string
): Promise<void> {
  const payload = {
    type: { name: 'Defect' },
    inwardIssue: { key: bugKey },
    outwardIssue: { key: requirementKey },
  };

  await fetch(`${baseUrl}/rest/api/3/issueLink`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  // Link failure is non-fatal — bug is already created
}

function buildJiraDescription(bug: BugReport): string {
  const steps = bug.stepsToReproduce
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');

  return `Caught by: ${bug.tool} — ${bug.tcId}: ${bug.tcTitle}
Feature: ${bug.featureSlug}
${bug.issueId ? `Requirement: ${bug.issueId}` : ''}

Steps to Reproduce:
${steps}

Expected Result:
${bug.expectedResult}

Actual Result:
${bug.actualResult}

Error:
${bug.errorMessage}
${bug.stackTrace || ''}

Logged automatically by swayambhu-qa`;
}
