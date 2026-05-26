/**
 * Shared IssueComment type — the normalized input to every comment poster.
 */

export type CommentSource = 'github' | 'jira' | 'ado' | 'linear';

export interface IssueComment {
  issueId: string;        // e.g. "42", "QA-42", "12345", "ENG-456"
  body: string;           // Markdown comment body
  repo?: string;          // GitHub: owner/repo (required for github source)
}

export interface PostedComment {
  source: CommentSource;
  commentId: string;
  issueId: string;
}
