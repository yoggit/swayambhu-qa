/**
 * GitHub comment poster — posts a comment on a GitHub Issue via gh CLI.
 */

import { execSync } from 'child_process';
import { IssueComment, PostedComment } from './types';

export function postGitHubComment(comment: IssueComment): PostedComment {
  if (!comment.repo) {
    throw new Error('GitHub comment posting requires --repo owner/repo');
  }

  // gh issue comment returns the comment URL
  const result = execSync(
    `gh issue comment ${comment.issueId} \
      --repo "${comment.repo}" \
      --body "${escapeShell(comment.body)}"`,
    { encoding: 'utf-8' }
  ).trim();

  // URL format: https://github.com/owner/repo/issues/42#issuecomment-123456789
  const commentId = result.split('#issuecomment-').pop() || result;

  return {
    source: 'github',
    commentId,
    issueId: comment.issueId,
  };
}

function escapeShell(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/`/g, '\\`');
}
