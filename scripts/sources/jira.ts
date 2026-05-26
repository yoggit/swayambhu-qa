/**
 * JIRA (Atlassian) issue fetcher
 * Reads a JIRA issue via REST API v3 and returns a normalized QARequirement.
 *
 * Env vars required:
 *   JIRA_BASE_URL   — https://yourcompany.atlassian.net
 *   JIRA_EMAIL      — your Atlassian account email
 *   JIRA_API_TOKEN  — API token from https://id.atlassian.com/manage-profile/security/api-tokens
 *
 * Issue ID format:  PROJECT-123  (e.g. QA-42, SW-12345)
 * Usage:            npx ts-node scripts/fetch-issue.ts QA-42 --source jira
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
  adfToText,
} from './types';

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}. See .env.example for setup instructions.`);
  return val;
}

function httpsGet(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`JIRA API error ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
  });
}

export async function fetchJiraIssue(issueId: string): Promise<QARequirement> {
  const baseUrl = getEnv('JIRA_BASE_URL').replace(/\/$/, '');
  const email = getEnv('JIRA_EMAIL');
  const token = getEnv('JIRA_API_TOKEN');

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const url = `${baseUrl}/rest/api/3/issue/${issueId}`;

  const raw = await httpsGet(url, {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
  });

  const issue = JSON.parse(raw) as {
    key: string;
    fields: {
      summary: string;
      description: unknown;     // Atlassian Document Format (ADF) JSON
      priority?: { name: string };
      labels?: string[];
      status?: { name: string };
      assignee?: { displayName: string };
    };
  };

  const { fields } = issue;

  // JIRA descriptions are ADF JSON objects — convert to plain text
  const bodyText = adfToText(fields.description);
  const nativePriority = fields.priority?.name;

  return {
    source: 'jira',
    issueId: issue.key,
    title: fields.summary,
    issueLink: `${baseUrl}/browse/${issue.key}`,
    summary: parseSummary(bodyText) || fields.summary,
    acceptanceCriteria: parseAcceptanceCriteria(bodyText),
    testUrls: parseTestUrls(bodyText),
    credentials: parseCredentials(bodyText),
    apiEndpoints: parseApiEndpoints(bodyText),
    priority: parsePriority(bodyText, nativePriority),
    rawBody: bodyText,
  };
}
