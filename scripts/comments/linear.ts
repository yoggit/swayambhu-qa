/**
 * Linear comment poster — adds a comment to a Linear issue via GraphQL API.
 *
 * Required env vars:
 *   LINEAR_API_KEY
 */

import { IssueComment, PostedComment } from './types';

const LINEAR_API = 'https://api.linear.app/graphql';

export async function postLinearComment(comment: IssueComment): Promise<PostedComment> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    throw new Error('Linear comment posting requires: LINEAR_API_KEY');
  }

  // Linear uses issue ID (UUID) not identifier (ENG-456) for mutations.
  // Resolve identifier → UUID first.
  const issueUuid = await resolveLinearIssueId(apiKey, comment.issueId);

  const mutation = `
    mutation CreateComment($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        success
        comment {
          id
        }
      }
    }
  `;

  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: { issueId: issueUuid, body: comment.body },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Linear API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    data?: { commentCreate?: { success: boolean; comment?: { id: string } } };
    errors?: { message: string }[];
  };

  if (data.errors?.length) {
    throw new Error(`Linear GraphQL error: ${data.errors.map((e) => e.message).join(', ')}`);
  }

  const commentId = data.data?.commentCreate?.comment?.id || '';

  return {
    source: 'linear',
    commentId,
    issueId: comment.issueId,
  };
}

async function resolveLinearIssueId(apiKey: string, identifier: string): Promise<string> {
  // If it looks like a UUID already, return as-is
  if (identifier.match(/^[0-9a-f-]{36}$/)) return identifier;

  const query = `
    query FindIssue($identifier: String!) {
      issue(id: $identifier) { id }
    }
  `;

  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { identifier } }),
  });

  const data = (await res.json()) as { data?: { issue?: { id: string } } };
  const uuid = data.data?.issue?.id;

  if (!uuid) {
    throw new Error(`Could not resolve Linear issue identifier: ${identifier}`);
  }

  return uuid;
}
