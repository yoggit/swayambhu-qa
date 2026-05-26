/**
 * Azure DevOps comment poster — adds a comment to a Work Item via REST API.
 *
 * Required env vars:
 *   ADO_ORG, ADO_PROJECT, ADO_PAT
 */

import { IssueComment, PostedComment } from './types';

export async function postAdoComment(comment: IssueComment): Promise<PostedComment> {
  const org = process.env.ADO_ORG;
  const project = process.env.ADO_PROJECT;
  const pat = process.env.ADO_PAT;

  if (!org || !project || !pat) {
    throw new Error('ADO comment posting requires: ADO_ORG, ADO_PROJECT, ADO_PAT');
  }

  const auth = Buffer.from(`:${pat}`).toString('base64');
  const baseUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}`;

  // ADO Work Item comments use HTML
  const htmlBody = markdownToHtml(comment.body);

  const payload = { text: htmlBody };

  const res = await fetch(
    `${baseUrl}/_apis/wit/workItems/${comment.issueId}/comments?api-version=7.1-preview.3`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ADO API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { id: number };

  return {
    source: 'ado',
    commentId: String(data.id),
    issueId: comment.issueId,
  };
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```[\s\S]*?```/g, (block) => `<pre>${block.replace(/```\w*\n?/g, '')}</pre>`)
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br/>');
}
