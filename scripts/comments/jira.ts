/**
 * JIRA comment poster — adds a comment to a JIRA issue via REST API v3.
 *
 * Required env vars:
 *   JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
 */

import { IssueComment, PostedComment } from './types';

export async function postJiraComment(comment: IssueComment): Promise<PostedComment> {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !token) {
    throw new Error('JIRA comment posting requires: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN');
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  // JIRA v3 comments use Atlassian Document Format (ADF)
  const payload = {
    body: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: comment.body }],
        },
      ],
    },
  };

  const res = await fetch(
    `${baseUrl}/rest/api/3/issue/${comment.issueId}/comment`,
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
    throw new Error(`JIRA API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { id: string };

  return {
    source: 'jira',
    commentId: data.id,
    issueId: comment.issueId,
  };
}
