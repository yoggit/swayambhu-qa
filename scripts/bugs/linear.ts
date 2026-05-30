/**
 * Linear bug logger — creates a Linear Issue via GraphQL API.
 *
 * Required env vars:
 *   LINEAR_API_KEY     lin_api_xxx
 *
 * Optional env vars:
 *   LINEAR_TEAM_ID       Override team for bug creation (default: derived from issue key)
 *   LINEAR_BUG_LABEL_ID  Label ID for "Bug" label in your Linear workspace
 */

import { BugReport, CreatedBug } from './types';

const LINEAR_API = 'https://api.linear.app/graphql';

async function resolveTeamId(apiKey: string, issueId?: string): Promise<string> {
  // Prefer explicit override
  if (process.env.LINEAR_TEAM_ID) return process.env.LINEAR_TEAM_ID;

  // Derive team key from issue identifier: "Q4-5" → "Q4"
  const teamKey = issueId?.match(/^([A-Z0-9]+)-\d+$/i)?.[1]?.toUpperCase();
  if (teamKey) {
    const res = await fetch(LINEAR_API, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id } } }`,
        variables: { key: teamKey },
      }),
    });
    const data = (await res.json()) as { data?: { teams?: { nodes: { id: string }[] } } };
    const id = data.data?.teams?.nodes?.[0]?.id;
    if (id) return id;
  }

  throw new Error('Cannot determine Linear team — set LINEAR_TEAM_ID in .env or pass an issue ID');
}

export async function logLinearBug(bug: BugReport): Promise<CreatedBug> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    throw new Error('Linear bug logging requires: LINEAR_API_KEY');
  }

  const teamId = await resolveTeamId(apiKey, bug.issueId);

  const description = buildLinearDescription(bug);
  const labelId = process.env.LINEAR_BUG_LABEL_ID;

  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
          title
        }
      }
    }
  `;

  const variables = {
    input: {
      teamId,
      title: bug.title,
      description,
      priority: 2, // High (1=Urgent, 2=High, 3=Medium, 4=Low)
      ...(labelId ? { labelIds: [labelId] } : {}),
    },
  };

  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Linear API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    data?: {
      issueCreate?: {
        success: boolean;
        issue?: { id: string; identifier: string; url: string; title: string };
      };
    };
    errors?: { message: string }[];
  };

  if (data.errors?.length) {
    throw new Error(`Linear GraphQL error: ${data.errors.map((e) => e.message).join(', ')}`);
  }

  const issue = data.data?.issueCreate?.issue;
  if (!issue) {
    throw new Error('Linear issue creation returned no issue');
  }

  // Link to original requirement if provided
  if (bug.issueId) {
    await linkLinearIssues(apiKey, issue.id, bug.issueId);
  }

  return {
    source: 'linear',
    bugId: issue.identifier,
    bugLink: issue.url,
    title: issue.title,
  };
}

async function linkLinearIssues(
  apiKey: string,
  bugIssueId: string,
  requirementIdentifier: string
): Promise<void> {
  // Find the requirement issue ID by identifier first
  const query = `
    query FindIssue($identifier: String!) {
      issue(id: $identifier) { id }
    }
  `;

  const findRes = await fetch(LINEAR_API, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { identifier: requirementIdentifier } }),
  });

  const findData = (await findRes.json()) as { data?: { issue?: { id: string } } };
  const requirementId = findData.data?.issue?.id;
  if (!requirementId) return; // Non-fatal — requirement might not be in same Linear workspace

  const mutation = `
    mutation LinkIssues($issueId: String!, $relatedIssueId: String!) {
      issueRelationCreate(input: {
        issueId: $issueId,
        relatedIssueId: $relatedIssueId,
        type: "blocks"
      }) {
        success
      }
    }
  `;

  await fetch(LINEAR_API, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: mutation, variables: { issueId: requirementId, relatedIssueId: bugIssueId } }),
  });
  // Link failure is non-fatal
}

function buildLinearDescription(bug: BugReport): string {
  const steps = bug.stepsToReproduce
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');

  return `## Bug Report — swayambhu-qa

**Caught by:** ${bug.tool} — \`${bug.tcId}: ${bug.tcTitle}\`
**Feature:** ${bug.featureSlug}
${bug.issueId ? `**Requirement:** ${bug.issueId}` : ''}

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
