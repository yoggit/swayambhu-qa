/**
 * Azure DevOps bug logger — creates a Work Item of type "Bug" via REST API.
 *
 * Required env vars:
 *   ADO_ORG      e.g. myorg
 *   ADO_PROJECT  e.g. MyProject
 *   ADO_PAT      your Personal Access Token
 */

import { BugReport, CreatedBug } from './types';

export async function logAdoBug(bug: BugReport): Promise<CreatedBug> {
  const org = process.env.ADO_ORG;
  const project = process.env.ADO_PROJECT;
  const pat = process.env.ADO_PAT;

  if (!org || !project || !pat) {
    throw new Error('ADO bug logging requires: ADO_ORG, ADO_PROJECT, ADO_PAT');
  }

  const auth = Buffer.from(`:${pat}`).toString('base64');
  const baseUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}`;

  const reproSteps = buildAdoReproSteps(bug);
  const description = buildAdoDescription(bug);

  // ADO Work Items use JSON Patch for field updates
  const payload = [
    { op: 'add', path: '/fields/System.Title', value: bug.title },
    { op: 'add', path: '/fields/System.WorkItemType', value: 'Bug' },
    { op: 'add', path: '/fields/Microsoft.VSTS.TCM.ReproSteps', value: reproSteps },
    { op: 'add', path: '/fields/System.Description', value: description },
    { op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: 2 }, // High
    { op: 'add', path: '/fields/System.Tags', value: 'swayambhu-qa; automated-detection' },
  ];

  const res = await fetch(
    `${baseUrl}/_apis/wit/workitems/$Bug?api-version=7.1`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json-patch+json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ADO API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { id: number; _links: { html: { href: string } } };
  const bugId = String(data.id);
  const bugLink = data._links.html.href;

  // Link to original requirement if provided
  if (bug.issueId) {
    await linkAdoWorkItems(baseUrl, auth, bugId, bug.issueId);
  }

  return {
    source: 'ado',
    bugId,
    bugLink,
    title: bug.title,
  };
}

async function linkAdoWorkItems(
  baseUrl: string,
  auth: string,
  bugId: string,
  requirementId: string
): Promise<void> {
  const payload = [
    {
      op: 'add',
      path: '/relations/-',
      value: {
        rel: 'System.LinkTypes.Hierarchy-Reverse', // Bug found in Requirement
        url: `${baseUrl}/_apis/wit/workItems/${requirementId}`,
        attributes: { comment: 'Bug detected by swayambhu-qa' },
      },
    },
  ];

  await fetch(`${baseUrl}/_apis/wit/workitems/${bugId}?api-version=7.1`, {
    method: 'PATCH',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json-patch+json',
    },
    body: JSON.stringify(payload),
  });
  // Link failure is non-fatal
}

function buildAdoReproSteps(bug: BugReport): string {
  const steps = bug.stepsToReproduce
    .map((s, i) => `<li>${i + 1}. ${s}</li>`)
    .join('');

  return `<b>Caught by:</b> ${bug.tool} — ${bug.tcId}: ${bug.tcTitle}<br/>
<b>Feature:</b> ${bug.featureSlug}<br/>
${bug.issueId ? `<b>Requirement:</b> ${bug.issueId}<br/>` : ''}
<br/>
<b>Steps to Reproduce:</b>
<ol>${steps}</ol>
<b>Expected Result:</b><br/>${bug.expectedResult}<br/>
<b>Actual Result:</b><br/>${bug.actualResult}`;
}

function buildAdoDescription(bug: BugReport): string {
  return `<b>Error:</b><br/>
<pre>${bug.errorMessage}${bug.stackTrace ? '\n\n' + bug.stackTrace : ''}</pre>
<br/>
<i>Logged automatically by <a href="https://github.com/yoggit/swayambhu-qa">swayambhu-qa</a></i>`;
}
