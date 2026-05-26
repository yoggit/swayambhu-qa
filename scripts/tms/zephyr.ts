/**
 * Zephyr Scale TMS connector — read, push, and update test cases via Zephyr Scale REST API.
 * Zephyr Scale is a JIRA plugin by SmartBear (formerly TM4J).
 *
 * Required env vars:
 *   ZEPHYR_BASE_URL      e.g. https://yourcompany.atlassian.net  (same as JIRA_BASE_URL)
 *   ZEPHYR_API_TOKEN     Zephyr Scale API token (from Atlassian API Tokens)
 *   ZEPHYR_PROJECT_KEY   JIRA project key, e.g. QA
 */

import {
  TestCase, TestResult, TCStep, TCType, TCPriority, ExecutionStatus,
  TMSReadResult, TMSPushResult, TMSUpdateResult,
} from './types';

function getConfig() {
  const baseUrl = process.env.ZEPHYR_BASE_URL?.replace(/\/$/, '');
  const token = process.env.ZEPHYR_API_TOKEN;
  const projectKey = process.env.ZEPHYR_PROJECT_KEY;

  if (!baseUrl || !token || !projectKey) {
    throw new Error('Zephyr requires: ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN, ZEPHYR_PROJECT_KEY');
  }

  return { baseUrl, token, projectKey };
}

async function zFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const { baseUrl, token } = getConfig();
  const res = await fetch(`${baseUrl}/rest/atm/1.0${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zephyr API error ${res.status} on ${path}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function readZephyrTCs(opts: {
  issueId?: string;
  suite?: string;
  caseIds?: string[];
}): Promise<TMSReadResult> {
  const { projectKey } = getConfig();

  let tests: ZephyrTest[];

  if (opts.caseIds?.length) {
    tests = await Promise.all(
      opts.caseIds.map((id) => zFetch<ZephyrTest>(`/testcase/${id}`))
    );
  } else if (opts.issueId) {
    // Find test cases linked to this requirement via Zephyr's JQL-like query
    const result = await zFetch<{ values: ZephyrTest[] }>(
      `/testcase/search?query=projectKey="${projectKey}"+AND+issueLinks+IN+("${opts.issueId}")`
    );
    tests = result.values;
  } else if (opts.suite) {
    // Find by folder/label name
    const result = await zFetch<{ values: ZephyrTest[] }>(
      `/testcase/search?query=projectKey="${projectKey}"+AND+folder="/Test Suites/${encodeURIComponent(opts.suite)}"`
    );
    tests = result.values;
  } else {
    throw new Error('Provide --issue, --suite, or --case to read from Zephyr');
  }

  return {
    tms: 'zephyr',
    testCases: tests.map(normalizeZephyrTest),
    suiteName: opts.suite,
  };
}

// ─── PUSH ─────────────────────────────────────────────────────────────────────

export async function pushToZephyr(opts: {
  issueId: string;
  suiteName: string;
  testCases: TestCase[];
}): Promise<TMSPushResult> {
  const { projectKey } = getConfig();

  // Create a folder (test suite) for this batch
  await zFetch('/folder', {
    method: 'POST',
    body: JSON.stringify({
      projectKey,
      name: opts.suiteName,
      type: 'TEST_CASE',
    }),
  }).catch(() => { /* folder may already exist */ });

  const pushedIds: string[] = [];

  for (const tc of opts.testCases) {
    const payload = {
      projectKey,
      name: `${tc.id}: ${tc.title}`,
      priority: zephyrPriority(tc.priority),
      status: 'Approved',
      folder: `/Test Suites/${opts.suiteName}`,
      labels: ['swayambhu-qa'],
      issueLinks: opts.issueId ? [opts.issueId] : [],
      precondition: tc.preconditions.join('\n'),
      testScript: {
        type: 'STEP_BY_STEP',
        steps: tc.steps.map((s) => ({
          description: s.action,
          testData: s.testData,
          expectedResult: s.expectedResult,
        })),
      },
    };

    const created = await zFetch<{ key: string }>('/testcase', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    pushedIds.push(created.key);
    console.error(`  Created: ${created.key} — ${tc.title}`);
  }

  return { tms: 'zephyr', issueId: opts.issueId, suiteName: opts.suiteName, pushedIds };
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateZephyrResults(opts: {
  issueId: string;
  results: TestResult[];
}): Promise<TMSUpdateResult> {
  const { projectKey } = getConfig();

  // Create a Test Cycle to group the execution
  const cycle = await zFetch<{ key: string }>('/testrun', {
    method: 'POST',
    body: JSON.stringify({
      projectKey,
      name: `swayambhu-qa — ${opts.issueId} — ${new Date().toISOString().split('T')[0]}`,
      status: 'In Progress',
      items: opts.results.map((r) => ({ testCaseKey: r.nativeId || r.tcId })),
    }),
  });

  let updated = 0;
  let failed = 0;

  for (const result of opts.results) {
    try {
      // Find the test run item key for this TC
      const items = await zFetch<{ values: { id: string; testCaseKey: string }[] }>(
        `/testrun/${cycle.key}/testrunitems`
      );
      const item = items.values.find((i) => i.testCaseKey === (result.nativeId || result.tcId));
      if (!item) { failed++; continue; }

      await zFetch(`/testrun/${cycle.key}/testresults`, {
        method: 'POST',
        body: JSON.stringify({
          testCaseKey: result.nativeId || result.tcId,
          status: executionStatusToZephyr(result.status),
          comment: result.errorMessage || `${result.status} via ${result.tool} — swayambhu-qa`,
        }),
      });

      updated++;
    } catch (err) {
      console.error(`Zephyr update failed for ${result.tcId}:`, err);
      failed++;
    }
  }

  return { tms: 'zephyr', updated, failed };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ZephyrTest {
  key: string;
  name: string;
  priority: string;
  status: string;
  folder?: string;
  labels?: string[];
  testScript?: {
    steps: { description: string; testData: string; expectedResult: string }[];
  };
}

function normalizeZephyrTest(test: ZephyrTest): TestCase {
  const steps: TCStep[] = (test.testScript?.steps || []).map((s, i) => ({
    stepNumber: i + 1,
    action: s.description,
    testData: s.testData,
    expectedResult: s.expectedResult,
  }));

  return {
    id: test.key,
    title: test.name,
    type: 'Functional' as TCType,
    priority: zephyrPriorityToTC(test.priority),
    preconditions: [],
    steps,
    automated: false,
    status: 'Ready',
    nativeId: test.key,
  };
}

function zephyrPriority(priority: TCPriority): string {
  return { P0: 'Critical', P1: 'High', P2: 'Normal', P3: 'Low' }[priority];
}

function zephyrPriorityToTC(name: string): TCPriority {
  if (!name) return 'P2';
  if (name.match(/critical/i)) return 'P0';
  if (name.match(/high/i)) return 'P1';
  if (name.match(/low/i)) return 'P3';
  return 'P2';
}

function executionStatusToZephyr(status: ExecutionStatus): string {
  return {
    passed: 'Pass', failed: 'Fail', flaky: 'Fail',
    skipped: 'Not Executed', blocked: 'Blocked',
  }[status] || 'Not Executed';
}
