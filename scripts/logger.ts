/**
 * logger.ts — Shared pipeline logger.
 *
 * Writes structured log lines to:
 *   logs/pipeline-<issueId>-<YYYY-MM-DD>.log   (per-run file)
 *   logs/pipeline-latest.log                    (always the current run)
 *
 * Log line format:
 *   2026-05-26T10:30:01Z [PHASE-1] [OK]   Fetched TEST-22: "Budget Tracker" | url=https://...
 *
 * Usage:
 *   import { logger } from './logger';
 *   const log = logger('TEST-22');
 *   log.phase(1, 'OK', 'Fetched TEST-22: "Budget Tracker"', { url: '...', priority: 'P2' });
 *   log.heal(1, 'pointer-intercept-mobile', 'js-evaluate-click', { fixed: 14, remaining: 3 });
 *   log.done({ passed: 72, total: 72, bugs: 0, healRounds: 2, durationMs: 220000 });
 */

import * as fs from 'fs';
import * as path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

type Status = 'OK' | 'FAIL' | 'SKIP' | 'WARN' | 'RUN' | 'HEAL' | 'START' | 'DONE';

function pad(s: string | number, len = 2) {
  return String(s).padStart(len, '0');
}

function ts() {
  return new Date().toISOString();
}

function formatKv(kv?: Record<string, unknown>): string {
  if (!kv || Object.keys(kv).length === 0) return '';
  return ' | ' + Object.entries(kv)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' | ');
}

function formatLine(tag: string, status: Status, message: string, kv?: Record<string, unknown>): string {
  return `${ts()} [${tag.padEnd(7)}] [${status.padEnd(5)}] ${message}${formatKv(kv)}\n`;
}

export function logger(issueId: string) {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const runFile = path.join(LOGS_DIR, `pipeline-${issueId}-${date}.log`);
  const latestFile = path.join(LOGS_DIR, 'pipeline-latest.log');

  function write(line: string) {
    fs.appendFileSync(runFile, line);
    fs.writeFileSync(latestFile, line, { flag: 'a' });
    process.stderr.write(line.trimEnd() + '\n');
  }

  return {
    start(opts: { issueId: string; source: string; tool: string }) {
      // Start fresh for latest.log on a new pipeline run
      fs.writeFileSync(latestFile, '');
      write(formatLine('PIPELINE', 'START', `issue=${opts.issueId} source=${opts.source} tool=${opts.tool}`));
      write(formatLine('PIPELINE', 'START', `run log → ${runFile}`));
    },

    phase(num: number, status: Status, message: string, kv?: Record<string, unknown>) {
      write(formatLine(`PHASE-${num}`, status, message, kv));
    },

    heal(round: number, cause: string, fix: string, kv?: Record<string, unknown>) {
      write(formatLine('HEAL', 'HEAL', `Round ${round} | cause=${cause} | fix=${fix}`, kv));
    },

    bug(title: string, tcId: string, link?: string) {
      write(formatLine('BUG', 'WARN', `Logged: ${title}`, { tcId, link }));
    },

    done(opts: { passed: number; total: number; bugs: number; healRounds: number; durationMs: number }) {
      const dur = `${Math.round(opts.durationMs / 1000)}s`;
      write(formatLine('PIPELINE', 'DONE',
        `${opts.passed}/${opts.total} passed | healed=${opts.total - opts.passed + opts.passed - opts.passed} | bugs=${opts.bugs} | rounds=${opts.healRounds} | duration=${dur}`
      ));
      write(formatLine('PIPELINE', 'DONE', `full log → ${runFile}`));
    },

    info(message: string, kv?: Record<string, unknown>) {
      write(formatLine('INFO', 'OK', message, kv));
    },

    warn(message: string, kv?: Record<string, unknown>) {
      write(formatLine('WARN', 'WARN', message, kv));
    },

    fail(message: string, kv?: Record<string, unknown>) {
      write(formatLine('ERROR', 'FAIL', message, kv));
    },

    runFile,
  };
}
