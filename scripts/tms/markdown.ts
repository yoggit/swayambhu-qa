/**
 * Markdown TMS connector — reads and writes test cases as .md files in test-cases/.
 * This is the default TMS when no external system is configured.
 *
 * File convention:
 *   test-cases/TC-<issueId>-<feature-slug>.md
 *
 * Each file contains one or more ## TC-<id>: <title> sections.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  TestCase, TestResult, TCStep, TCType, TCPriority,
  TMSReadResult, TMSPushResult, TMSUpdateResult,
} from './types';

const TC_DIR = path.join(process.cwd(), 'test-cases');

// ─── READ ─────────────────────────────────────────────────────────────────────

export function readMarkdownTCs(opts: {
  issueId?: string;
  suite?: string;   // matches filename slug
  caseIds?: string[];
}): TMSReadResult {
  const files = fs.readdirSync(TC_DIR).filter((f) => f.endsWith('.md'));

  let targetFiles: string[] = files;
  if (opts.issueId) {
    targetFiles = files.filter((f) => f.includes(`TC-${opts.issueId!}-`) || f.includes(`TC-${opts.issueId!.replace(/-/g, '')}-`));
  } else if (opts.suite) {
    targetFiles = files.filter((f) => f.toLowerCase().includes(opts.suite!.toLowerCase().replace(/\s/g, '-')));
  }

  const testCases: TestCase[] = [];

  for (const file of targetFiles) {
    const content = fs.readFileSync(path.join(TC_DIR, file), 'utf-8');
    const parsed = parseMarkdownFile(content);
    if (opts.caseIds?.length) {
      testCases.push(...parsed.filter((tc) => opts.caseIds!.includes(tc.id)));
    } else {
      testCases.push(...parsed);
    }
  }

  return { tms: 'markdown', testCases };
}

function parseMarkdownFile(content: string): TestCase[] {
  const tcBlocks = content.split(/(?=^## TC-)/m).filter((b) => b.trim().startsWith('## TC-'));
  return tcBlocks.map(parseTC).filter((tc): tc is TestCase => tc !== null);
}

function parseTC(block: string): TestCase | null {
  const titleMatch = block.match(/^## (TC-[\w-]+):\s*(.+)/m);
  if (!titleMatch) return null;

  const id = titleMatch[1];
  const title = titleMatch[2].trim();

  const getField = (label: string) =>
    block.match(new RegExp(`\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*(.+?)\\s*\\|`, 'i'))?.[1]?.trim() || '';

  const type = (getField('Type').split('/')[0].trim() || 'Functional') as TCType;
  const priorityRaw = getField('Priority');
  const priority = (priorityRaw.match(/P[0-3]/)?.[0] || 'P2') as TCPriority;
  const automated = getField('Automated').toLowerCase().startsWith('yes');
  const tool = getField('Automated').replace(/yes\s*[—-]\s*/i, '').trim() || undefined;

  const preconditionSection = block.match(/### Preconditions\n([\s\S]*?)(?=###|$)/)?.[1] || '';
  const preconditions = preconditionSection
    .split('\n')
    .filter((l) => l.trim().startsWith('- ['))
    .map((l) => l.replace(/^- \[.?\]\s*/, '').trim())
    .filter(Boolean);

  const stepsSection = block.match(/### Steps\n([\s\S]*?)(?=###|$)/)?.[1] || '';
  const stepRows = stepsSection
    .split('\n')
    .filter((l) => l.includes('|') && !l.match(/^[\|\s\-:]+$/) && !l.match(/\|\s*#\s*\|/));

  const steps: TCStep[] = stepRows.map((row) => {
    const cols = row.split('|').map((c) => c.trim()).filter(Boolean);
    return {
      stepNumber: parseInt(cols[0]) || 0,
      action: cols[1] || '',
      testData: cols[2] || '',
      expectedResult: cols[3] || '',
    };
  }).filter((s) => s.stepNumber > 0);

  return { id, title, type, priority, preconditions, steps, automated, tool, status: 'Ready', nativeId: id };
}

// ─── PUSH (save to file) ──────────────────────────────────────────────────────

export function saveMarkdownTCs(opts: {
  issueId: string;
  featureSlug: string;
  content: string;
}): TMSPushResult {
  if (!fs.existsSync(TC_DIR)) fs.mkdirSync(TC_DIR, { recursive: true });

  const filename = `TC-${opts.issueId}-${opts.featureSlug}.md`;
  const filepath = path.join(TC_DIR, filename);
  fs.writeFileSync(filepath, opts.content, 'utf-8');

  // Count TC IDs in the written content
  const ids = (opts.content.match(/^## (TC-[\w-]+):/gm) || []).map((m) => m.replace(/^## /, '').replace(/:$/, ''));

  return {
    tms: 'markdown',
    issueId: opts.issueId,
    suiteName: filename,
    pushedIds: ids,
  };
}

// ─── UPDATE (write execution results back into the markdown) ──────────────────

export function updateMarkdownResults(opts: {
  issueId: string;
  featureSlug: string;
  results: TestResult[];
}): TMSUpdateResult {
  const filename = `TC-${opts.issueId}-${opts.featureSlug}.md`;
  const filepath = path.join(TC_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return { tms: 'markdown', updated: 0, failed: opts.results.length };
  }

  let content = fs.readFileSync(filepath, 'utf-8');
  let updated = 0;

  for (const result of opts.results) {
    const statusEmoji = { passed: '✅', failed: '❌', flaky: '⚠️', skipped: '⏭', blocked: '🚫' }[result.status];
    const actualResult = result.errorMessage
      ? `${statusEmoji} ${result.status} — ${result.errorMessage}`
      : `${statusEmoji} ${result.status}`;

    // Replace the "*(filled in after execution)*" placeholder under the matching TC
    const tcPattern = new RegExp(
      `(## ${result.tcId}:[\\s\\S]*?### Actual Result\\n)\\*\\(filled in after execution\\)\\*`,
      'm'
    );

    if (tcPattern.test(content)) {
      content = content.replace(tcPattern, `$1${actualResult}`);
      updated++;
    }
  }

  fs.writeFileSync(filepath, content, 'utf-8');
  return { tms: 'markdown', updated, failed: opts.results.length - updated };
}
