/**
 * Shared QARequirement type — the normalized output of every issue fetcher.
 * All sources (GitHub, JIRA, ADO, Linear) must return this shape so the
 * rest of the pipeline remains completely source-agnostic.
 */

export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'unknown';
export type Source = 'github' | 'jira' | 'ado' | 'linear';

export interface Credential {
  role: string;
  username: string;
  password: string;
}

export interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
}

export interface TestUrls {
  ui?: string;
  api?: string;
}

export interface QARequirement {
  source: Source;
  issueId: string;           // GitHub: "42" | JIRA: "PROJ-123" | ADO: "12345" | Linear: "ENG-456"
  title: string;
  issueLink: string;         // URL to the original ticket
  summary: string;
  acceptanceCriteria: string[];
  testUrls: TestUrls;
  credentials: Credential[];
  apiEndpoints: ApiEndpoint[];
  priority: Priority;
  rawBody: string;           // raw description for fallback / AI parsing
}

// ─── Shared text parsers (used by all fetchers) ───────────────────────────────

export function extractSection(text: string, heading: string): string {
  const regex = new RegExp(`##?[^#]*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  return text.match(regex)?.[1]?.trim() || '';
}

export function parseAcceptanceCriteria(text: string): string[] {
  const section = extractSection(text, 'Acceptance Criteria');
  const source = section || text;
  return source
    .split('\n')
    .filter((l) => l.trim().match(/^[-*]\s*(\[.?\])?\s*.+/))
    .map((l) => l.replace(/^[-*]\s*(\[.?\])?\s*/, '').trim())
    .filter(Boolean);
}

export function parseTestUrls(text: string): TestUrls {
  const section = extractSection(text, 'URL') || text;
  const uiMatch = section.match(/UI[^:]*:\s*(https?:\/\/[^\s\n`]+)/i);
  const apiMatch = section.match(/API[^:]*:\s*(https?:\/\/[^\s\n`]+)/i);
  return {
    ui: uiMatch?.[1]?.replace(/[`*]/g, ''),
    api: apiMatch?.[1]?.replace(/[`*]/g, ''),
  };
}

export function parseCredentials(text: string): Credential[] {
  const section = extractSection(text, 'Credentials') || text;
  return section
    .split('\n')
    .filter((l) => l.includes('|') && !l.match(/^[\|\s\-:]+$/))
    .map((row) => {
      const cols = row.split('|').map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 3 && cols[0] !== 'Role' && cols[1] !== 'Username') {
        return { role: cols[0], username: cols[1], password: cols[2] };
      }
      return null;
    })
    .filter((r): r is Credential => r !== null);
}

export function parseApiEndpoints(text: string): ApiEndpoint[] {
  const section = extractSection(text, 'API Endpoint') || text;
  // Table format: | METHOD | /path | description |
  const tableRows = section
    .split('\n')
    .filter((l) => l.includes('|') && !l.match(/^[\|\s\-:]+$/))
    .map((row) => {
      const cols = row.split('|').map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 2 && cols[0].match(/^(GET|POST|PUT|DELETE|PATCH)$/i)) {
        return { method: cols[0].toUpperCase(), path: cols[1], description: cols[2] || '' };
      }
      return null;
    })
    .filter((r): r is ApiEndpoint => r !== null);

  if (tableRows.length) return tableRows;

  // Inline format: - POST /api/login
  return section
    .split('\n')
    .filter((l) => l.trim().match(/^[-*]?\s*`?(GET|POST|PUT|DELETE|PATCH)\s+\//i))
    .map((l) => {
      const m = l.match(/(GET|POST|PUT|DELETE|PATCH)\s+(\S+)\s*(.*)/i);
      if (!m) return null;
      return { method: m[1].toUpperCase(), path: m[2], description: m[3].trim() };
    })
    .filter((r): r is ApiEndpoint => r !== null);
}

export function parsePriority(text: string, nativePriority?: string): Priority {
  // Try native priority field first (e.g. from JIRA/ADO priority field)
  if (nativePriority) {
    if (nativePriority.match(/critical|blocker|p0/i)) return 'P0';
    if (nativePriority.match(/high|p1/i)) return 'P1';
    if (nativePriority.match(/medium|normal|p2/i)) return 'P2';
    if (nativePriority.match(/low|minor|p3/i)) return 'P3';
  }
  // Fall back to text scan
  if (text.match(/\[x\]\s*P0|priority[:\s]*P0/i)) return 'P0';
  if (text.match(/\[x\]\s*P1|priority[:\s]*P1/i)) return 'P1';
  if (text.match(/\[x\]\s*P2|priority[:\s]*P2/i)) return 'P2';
  if (text.match(/\[x\]\s*P3|priority[:\s]*P3/i)) return 'P3';
  return 'unknown';
}

export function parseSummary(text: string): string {
  const section = extractSection(text, 'Summary');
  return (
    section.split('\n').find((l) => l.trim() && !l.startsWith('<!--')) ||
    text.split('\n').find((l) => l.trim()) ||
    ''
  );
}

// Strip HTML tags (used by ADO which returns HTML descriptions)
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Convert Atlassian Document Format (ADF) JSON to plain text (used by JIRA)
export function adfToText(adf: unknown): string {
  if (!adf || typeof adf !== 'object') return '';
  const node = adf as { type?: string; text?: string; content?: unknown[] };
  if (node.type === 'text') return node.text || '';
  if (!node.content) return '';
  return node.content
    .map((child) => {
      const c = child as { type?: string; content?: unknown[]; text?: string };
      const text = adfToText(child);
      if (c.type === 'paragraph') return text + '\n';
      if (c.type === 'listItem') return '- ' + text;
      if (c.type === 'heading') return '## ' + text + '\n';
      return text;
    })
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
