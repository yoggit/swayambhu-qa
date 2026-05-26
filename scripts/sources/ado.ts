/**
 * Azure DevOps (ADO) work item fetcher
 * Reads an ADO work item via REST API and returns a normalized QARequirement.
 *
 * Env vars required:
 *   ADO_ORG      — your Azure DevOps organization name (e.g. "mycompany")
 *   ADO_PROJECT  — your project name (e.g. "MyApp")
 *   ADO_PAT      — Personal Access Token (needs Work Items Read scope)
 *                  Create at: dev.azure.com → User Settings → Personal Access Tokens
 *
 * Issue ID format:  12345  (numeric work item ID)
 * Usage:            npx ts-node scripts/fetch-issue.ts 12345 --source ado
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
  stripHtml,
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
          reject(new Error(`ADO API error ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
  });
}

export async function fetchAdoWorkItem(workItemId: string): Promise<QARequirement> {
  const org = getEnv('ADO_ORG');
  const project = encodeURIComponent(getEnv('ADO_PROJECT'));
  const pat = getEnv('ADO_PAT');

  // ADO PAT auth: Basic base64(:pat) — note the leading colon
  const auth = Buffer.from(`:${pat}`).toString('base64');

  const url = `https://dev.azure.com/${org}/${project}/_apis/wit/workitems/${workItemId}?api-version=7.0&$expand=all`;

  const raw = await httpsGet(url, {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
  });

  const item = JSON.parse(raw) as {
    id: number;
    fields: {
      'System.Title': string;
      'System.Description'?: string;           // HTML
      'System.WorkItemType': string;
      'Microsoft.VSTS.Common.Priority'?: number;
      'Microsoft.VSTS.Common.AcceptanceCriteria'?: string;  // HTML, separate field
      'System.Tags'?: string;
      'System.AreaPath'?: string;
      'System.TeamProject': string;
    };
    _links?: { html?: { href?: string } };
  };

  const { fields } = item;

  // ADO descriptions are HTML — strip tags to get plain text
  const descriptionHtml = fields['System.Description'] || '';
  const acHtml = fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '';

  const descText = stripHtml(descriptionHtml);
  const acText = stripHtml(acHtml);

  // Combine: acceptance criteria may be in a dedicated field OR embedded in description
  const fullText = acText
    ? `## Acceptance Criteria\n${acText}\n\n${descText}`
    : descText;

  // ADO priority is numeric: 1=Critical, 2=High, 3=Medium, 4=Low
  const adoPriorityMap: Record<number, string> = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' };
  const nativePriority = adoPriorityMap[fields['Microsoft.VSTS.Common.Priority'] ?? 3];

  const issueLink =
    item._links?.html?.href ||
    `https://dev.azure.com/${org}/${project}/_workitems/edit/${item.id}`;

  return {
    source: 'ado',
    issueId: String(item.id),
    title: fields['System.Title'],
    issueLink,
    summary: parseSummary(fullText) || fields['System.Title'],
    acceptanceCriteria: parseAcceptanceCriteria(fullText),
    testUrls: parseTestUrls(fullText),
    credentials: parseCredentials(fullText),
    apiEndpoints: parseApiEndpoints(fullText),
    priority: parsePriority(fullText, nativePriority),
    rawBody: fullText,
  };
}
