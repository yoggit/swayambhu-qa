/**
 * Linear issue fetcher
 * Reads a Linear issue via GraphQL API and returns a normalized QARequirement.
 *
 * Env vars required:
 *   LINEAR_API_KEY  — API key from Linear Settings → API → Personal API keys
 *
 * Issue ID format:  ENG-456  (team prefix + number, e.g. QA-12, FE-99)
 * Usage:            npx ts-node scripts/fetch-issue.ts ENG-456 --source linear
 */

import * as https from 'https';
import {
  QARequirement,
  parseAcceptanceCriteria,
  parseTestUrls,
  parseCredentials,
  parseApiEndpoints,
  parsePriority,
  parseSummary,
} from './types';

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}. See .env.example for setup instructions.`);
  return val;
}

function graphqlPost(query: string, apiKey: string): Promise<string> {
  const body = JSON.stringify({ query });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.linear.app',
        path: '/graphql',
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Linear API error ${res.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function fetchLinearIssue(issueId: string): Promise<QARequirement> {
  const apiKey = getEnv('LINEAR_API_KEY');

  // Linear accepts both "ENG-456" identifier and UUID
  // issueIdentifier query works with the human-readable "TEAM-123" format
  const query = `
    query {
      issue(id: "${issueId}") {
        identifier
        title
        description
        url
        priority
        priorityLabel
        labels {
          nodes { name }
        }
        team {
          name
        }
      }
    }
  `;

  const raw = await graphqlPost(query, apiKey);
  const result = JSON.parse(raw) as {
    data?: {
      issue?: {
        identifier: string;
        title: string;
        description?: string;
        url: string;
        priority: number;
        priorityLabel: string;
        labels: { nodes: { name: string }[] };
        team: { name: string };
      };
    };
    errors?: { message: string }[];
  };

  if (result.errors?.length) {
    throw new Error(`Linear GraphQL error: ${result.errors.map((e) => e.message).join(', ')}`);
  }

  const issue = result.data?.issue;
  if (!issue) throw new Error(`Linear issue not found: ${issueId}`);

  // Linear descriptions are already Markdown
  const body = issue.description || '';

  // Linear priority: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
  const linearPriorityMap: Record<number, string> = {
    0: 'unknown',
    1: 'Critical',
    2: 'High',
    3: 'Medium',
    4: 'Low',
  };
  const nativePriority = linearPriorityMap[issue.priority] || issue.priorityLabel;

  return {
    source: 'linear',
    issueId: issue.identifier,
    title: issue.title,
    issueLink: issue.url,
    summary: parseSummary(body) || issue.title,
    acceptanceCriteria: parseAcceptanceCriteria(body),
    testUrls: parseTestUrls(body),
    credentials: parseCredentials(body),
    apiEndpoints: parseApiEndpoints(body),
    priority: parsePriority(body, nativePriority),
    rawBody: body,
  };
}
