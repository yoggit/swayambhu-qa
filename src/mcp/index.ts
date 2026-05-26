#!/usr/bin/env node
/**
 * swayambhu-qa MCP Server
 *
 * Exposes QA pipeline capabilities as MCP tools so Claude Code can call them
 * without any agent files living in the user's project.
 *
 * User's .claude/settings.json:
 * {
 *   "mcpServers": {
 *     "swayambhu-qa": {
 *       "command": "npx",
 *       "args": ["@swayambhu-qa/core", "--mcp"]
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'swayambhu-qa', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// ─── Tool definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'fetch_issue',
      description: 'Fetch a ticket from JIRA, GitHub Issues, Azure DevOps, or Linear and return structured issue data including title, acceptance criteria, test URLs, and credentials.',
      inputSchema: {
        type: 'object',
        properties: {
          issue_id: { type: 'string', description: 'Issue ID — e.g. TEST-22, 42, ENG-456' },
          source: { type: 'string', enum: ['jira', 'github', 'ado', 'linear'], description: 'Issue tracker source' },
          repo: { type: 'string', description: 'GitHub only — owner/repo e.g. myorg/myrepo' },
        },
        required: ['issue_id', 'source'],
      },
    },
    {
      name: 'scrape_app',
      description: 'Launch a real Playwright browser against a URL, click all visible buttons to reveal hidden forms, and return all interactive elements with their selectors (inputs, buttons, dropdowns, data-testids).',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The UI app URL to scrape' },
          issue_id: { type: 'string', description: 'Issue ID — used for logging' },
        },
        required: ['url'],
      },
    },
    {
      name: 'push_to_tms',
      description: 'Push generated test cases to a TMS (Xray, TestRail, Zephyr, or Markdown). Writes a tc-mapping file mapping TC IDs to native TMS keys for use by run_tests.',
      inputSchema: {
        type: 'object',
        properties: {
          issue_id: { type: 'string' },
          tms: { type: 'string', enum: ['xray', 'testRail', 'zephyr', 'markdown'] },
          file: { type: 'string', description: 'Path to generated TC markdown file' },
        },
        required: ['issue_id', 'tms', 'file'],
      },
    },
    {
      name: 'run_tests',
      description: 'Run generated Playwright tests using the JSON reporter. Maps results back to TC IDs via test annotations and the tc-mapping file. Returns pass/fail per TC and writes reports/results-<issueId>.json.',
      inputSchema: {
        type: 'object',
        properties: {
          issue_id: { type: 'string' },
          spec: { type: 'string', description: 'Path to the spec file, e.g. tests/generated/budget-tracker.spec.ts' },
          tool: { type: 'string', description: 'Test tool — playwright | cypress | restassured | selenium | robot' },
        },
        required: ['issue_id', 'spec', 'tool'],
      },
    },
    {
      name: 'update_tms',
      description: 'Create a Test Execution ticket in Xray/TestRail/Zephyr with per-TC pass/fail statuses and auto-heal details in the description. Writes the description via Jira REST API.',
      inputSchema: {
        type: 'object',
        properties: {
          issue_id: { type: 'string' },
          tms: { type: 'string', enum: ['xray', 'testRail', 'zephyr', 'markdown'] },
          results: { type: 'string', description: 'Path to results JSON file, e.g. reports/results-TEST22.json' },
        },
        required: ['issue_id', 'tms', 'results'],
      },
    },
    {
      name: 'create_bug',
      description: 'Log a bug back to the issue tracker (JIRA, GitHub, ADO, or Linear) for a test that could not be healed after 2 rounds.',
      inputSchema: {
        type: 'object',
        properties: {
          issue_id: { type: 'string', description: 'Parent story ID to link the bug to' },
          source: { type: 'string', enum: ['jira', 'github', 'ado', 'linear'] },
          title: { type: 'string', description: 'Bug title, e.g. "[BUG] Total does not update after delete"' },
          tc_id: { type: 'string', description: 'TC ID that uncovered this bug, e.g. TC-TEST22-04' },
          tool: { type: 'string', description: 'Tool that surfaced the failure, e.g. Playwright' },
          error: { type: 'string', description: 'The error message / assertion failure text' },
        },
        required: ['issue_id', 'source', 'title', 'tc_id', 'tool', 'error'],
      },
    },
    {
      name: 'comment_issue',
      description: 'Post a structured QA report comment on the original story ticket summarising test results, heal rounds, and bug links.',
      inputSchema: {
        type: 'object',
        properties: {
          issue_id: { type: 'string' },
          source: { type: 'string', enum: ['jira', 'github', 'ado', 'linear'] },
          body: { type: 'string', description: 'Markdown comment body' },
        },
        required: ['issue_id', 'source', 'body'],
      },
    },
  ],
}));

// ─── Tool handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Each tool shells out to the compiled script in dist/scripts/
  // Phase B will wire these up fully
  switch (name) {
    case 'fetch_issue':
      return callScript('fetch-issue', args);
    case 'scrape_app':
      return callScript('scrape-app', args);
    case 'push_to_tms':
      return callScript('push-to-tms', args);
    case 'run_tests':
      return callScript('run-tests', args);
    case 'update_tms':
      return callScript('update-tms-status', args);
    case 'create_bug':
      return callScript('create-bug', args);
    case 'comment_issue':
      return callScript('comment-issue', args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ─── Argument name mapping (MCP tool arg → CLI flag) ─────────────────────────
// MCP args use snake_case; CLI scripts use their own flag names.

const ARG_MAP: Record<string, string> = {
  issue_id: 'issue',
  tc_id:    'tc-id',
  // all others map 1:1 with underscores replaced by hyphens
};

function toFlag(key: string): string {
  return ARG_MAP[key] ?? key.replace(/_/g, '-');
}

// ─── Script runner ────────────────────────────────────────────────────────────

function callScript(script: string, args: Record<string, unknown>) {
  const { execSync } = require('child_process');
  const path = require('path');

  const scriptPath = path.join(__dirname, 'scripts', `${script}.js`);

  // Build CLI flags from args object using the flag mapping
  const flags = Object.entries(args)
    .map(([k, v]) => `--${toFlag(k)} "${v}"`)
    .join(' ');

  try {
    const output = execSync(`node "${scriptPath}" ${flags}`, {
      encoding: 'utf-8',
      env: { ...process.env },
    });
    return { content: [{ type: 'text', text: output }] };
  } catch (err: any) {
    const msg = err.stderr || err.message || String(err);
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
