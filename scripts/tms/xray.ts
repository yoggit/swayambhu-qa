/**
 * Xray TMS connector — read, push, and update test cases via Xray REST API.
 * Xray is a JIRA plugin — tests are JIRA issues of type "Test".
 *
 * Required env vars:
 *   XRAY_CLIENT_ID       from Xray API Management page
 *   XRAY_CLIENT_SECRET   from Xray API Management page
 *   XRAY_PROJECT_KEY     JIRA project key, e.g. QA
 *   JIRA_BASE_URL        e.g. https://yourcompany.atlassian.net (shared with JIRA source)
 */

import {
  TestCase, TestResult, TCStep, TCType, TCPriority, ExecutionStatus,
  TMSReadResult, TMSPushResult, TMSUpdateResult,
} from './types';

const XRAY_BASE = 'https://xray.cloud.getxray.app/api/v2';

async function getXrayToken(): Promise<string> {
  const clientId = process.env.XRAY_CLIENT_ID;
  const clientSecret = process.env.XRAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Xray requires: XRAY_CLIENT_ID, XRAY_CLIENT_SECRET');
  }

  const res = await fetch(`${XRAY_BASE}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xray authentication failed ${res.status}: ${err}`);
  }

  // Returns a bare JWT string (not JSON object)
  return (await res.text()).replace(/^"|"$/g, '');
}

async function xrayFetch<T>(path: string, token: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${XRAY_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xray API error ${res.status} on ${path}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function readXrayTCs(opts: {
  issueId?: string;
  suite?: string;
  caseIds?: string[];
}): Promise<TMSReadResult> {
  const token = await getXrayToken();
  const projectKey = process.env.XRAY_PROJECT_KEY;
  if (!projectKey) throw new Error('Xray requires: XRAY_PROJECT_KEY');

  // Xray Cloud uses GraphQL for querying tests
  const getTestsQuery = `
    query GetTests($jql: String!, $limit: Int!) {
      getTests(jql: $jql, limit: $limit) {
        total
        results {
          issueId
          jira(fields: ["key", "summary", "priority"])
          testType { name }
          steps { id action data result }
        }
      }
    }
  `;

  let jql: string;
  if (opts.caseIds?.length) {
    jql = `project = ${projectKey} AND issueKey in (${opts.caseIds.join(',')})`;
  } else if (opts.issueId) {
    jql = `project = ${projectKey} AND issueType = Test AND issue in linkedIssues("${opts.issueId}")`;
  } else if (opts.suite) {
    jql = `project = ${projectKey} AND labels = "${opts.suite}"`;
  } else {
    throw new Error('Provide --issue, --suite, or --case to read from Xray');
  }

  const res = await fetch('https://xray.cloud.getxray.app/api/v2/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: getTestsQuery, variables: { jql, limit: 100 } }),
  });
  const data = (await res.json()) as any;
  const tests: XrayTest[] = (data?.data?.getTests?.results || []);

  return {
    tms: 'xray',
    testCases: tests.map(normalizeXrayTest),
  };
}

// ─── PUSH ─────────────────────────────────────────────────────────────────────

export async function pushToXray(opts: {
  issueId: string;
  suiteName: string;
  testCases: TestCase[];
}): Promise<TMSPushResult> {
  const token = await getXrayToken();
  const projectKey = process.env.XRAY_PROJECT_KEY;
  if (!projectKey) throw new Error('Xray requires: XRAY_PROJECT_KEY');

  const mutation = `
    mutation CreateTest($jira: JSON!, $testType: UpdateTestTypeInput, $steps: [CreateStepInput]) {
      createTest(jira: $jira, testType: $testType, steps: $steps) {
        test {
          issueId
          jira(fields: ["key", "summary"])
        }
        warnings
      }
    }
  `;

  const pushedIds: string[] = [];

  for (const tc of opts.testCases) {
    const variables = {
      jira: {
        fields: {
          summary: `${tc.id}: ${tc.title}`,
          project: { key: projectKey },
          priority: { name: xrayPriority(tc.priority) },
          issuetype: { name: 'Test' },
        },
      },
      testType: { name: tc.type === 'API' ? 'Generic' : 'Manual' },
      // Generic (API) tests don't support steps in Xray — encode steps in description instead
      ...(tc.type !== 'API' ? {
        steps: tc.steps.map((s) => ({
          action: s.action,
          data: s.testData,
          result: s.expectedResult,
        })),
      } : {}),
    };

    const res = await fetch('https://xray.cloud.getxray.app/api/v2/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables }),
    });

    const data = (await res.json()) as any;
    const key = data?.data?.createTest?.test?.jira?.key;
    if (key) {
      pushedIds.push(key);
      console.error(`  Created: ${key} — ${tc.title}`);
    } else {
      console.error(`  ⚠️  Failed to create: ${tc.id} — ${data?.errors?.[0]?.message || 'unknown error'}`);
    }
  }

  // Link all created tests to the requirement issue via JIRA issue link API
  if (pushedIds.length && opts.issueId) {
    const base = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
    const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
    for (const testKey of pushedIds) {
      await fetch(`${base}/rest/api/3/issueLink`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: { name: 'Test' },
          inwardIssue: { key: testKey },
          outwardIssue: { key: opts.issueId },
        }),
      });
    }
    console.error(`  🔗 Linked ${pushedIds.length} tests to ${opts.issueId}`);
  }

  return { tms: 'xray', issueId: opts.issueId, suiteName: opts.suiteName, pushedIds };
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateXrayResults(opts: {
  issueId: string;
  results: TestResult[];
  executionSummary?: string;
}): Promise<TMSUpdateResult & { executionKey?: string }> {
  const token = await getXrayToken();
  const projectKey = process.env.XRAY_PROJECT_KEY;
  if (!projectKey) throw new Error('Xray requires: XRAY_PROJECT_KEY');

  const passed = opts.results.filter((r) => r.status === 'passed').length;
  const failed = opts.results.filter((r) => r.status === 'failed').length;
  const healed = opts.results.filter((r) => (r.healAttempts || 0) > 0).length;

  const summary = opts.executionSummary
    || `swayambhu-qa — ${opts.issueId} | ${passed}✅ ${failed}❌ ${healed} healed`;

  // Build per-test comment that includes heal tracking
  const buildComment = (r: TestResult): string => {
    const parts: string[] = [`${r.status} via ${r.tool}`];
    if ((r.healAttempts || 0) > 0) {
      parts.push(`Auto-healed in ${r.healAttempts} round(s): ${r.healCause || 'unknown cause'} → ${r.healFix || 'fix applied'}`);
    }
    if (r.errorMessage) parts.push(`Error: ${r.errorMessage}`);
    return parts.join(' | ');
  };

  // Build heal summary lines for the description
  const healedResults = opts.results.filter((r) => (r.healAttempts || 0) > 0);
  const healLines = healedResults.map(
    (r) => `  - ${r.nativeId || r.tcId}: healed in ${r.healAttempts} round(s): ${r.healCause || 'unknown'} -> ${r.healFix || 'fix applied'}`,
  );

  // Use GraphQL createTestExecution — synchronous, returns the execution key immediately
  const mutation = `
    mutation CreateTestExecution($jira: JSON!, $tests: [String!]) {
      createTestExecution(jira: $jira, tests: $tests) {
        testExecution {
          issueId
          jira(fields: ["key", "summary"])
        }
        warnings
      }
    }
  `;

  // Support both nativeId (Playwright) and tmsKey (REST Assured / manual results)
  const xrayKey = (r: TestResult) => (r as any).tmsKey || r.nativeId || '';

  const testKeys = opts.results
    .map(xrayKey)
    .filter((k) => k.match(/^[A-Z]+-\d+$/)); // Only valid Xray issue keys

  let executionKey: string | undefined;

  try {
    const res = await fetch('https://xray.cloud.getxray.app/api/v2/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: mutation,
        variables: {
          jira: {
            fields: {
              summary,
              project: { key: projectKey },
              issuetype: { name: 'Test Execution' },
              description: [
                `Requirement: ${opts.issueId}`,
                `Tests run: ${opts.results.length}`,
                `Passed: ${passed}  Failed: ${failed}  Healed: ${healed}`,
                '',
                ...(healLines.length ? ['Auto-healed test cases:', ...healLines] : []),
              ].join('\n'),
            },
          },
          tests: testKeys,
        },
      }),
    });

    const data = (await res.json()) as any;
    executionKey = data?.data?.createTestExecution?.testExecution?.jira?.key;

    if (executionKey) {
      console.error(`  📋 Test Execution created: ${executionKey}`);
    } else {
      console.error('  ⚠️  Could not create Test Execution via GraphQL, falling back to REST import');
    }
  } catch (err) {
    console.error('  GraphQL createTestExecution failed, falling back:', err);
  }

  // Whether or not GraphQL worked, push the detailed results via REST import/execution
  // This updates each test's status and comment (including heal info) inside the execution
  const executionPayload = {
    ...(executionKey ? { testExecutionKey: executionKey } : {}),
    info: {
      project: projectKey,
      summary,
    },
    tests: opts.results.map((r) => ({
      testKey: xrayKey(r) || r.tcId,
      status: executionStatusToXray(r.status),
      comment: buildComment(r),
    })),
  };

  try {
    const importRes = await fetch('https://xray.cloud.getxray.app/api/v1/import/execution', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(executionPayload),
    });
    if (importRes.ok) {
      const importData = (await importRes.json()) as any;
      // v1 REST returns { testExecIssue: { key: "..." } }; guard both shapes
      executionKey = executionKey || importData?.testExecIssue?.key || importData?.key;
      if (executionKey) console.error(`  📋 Test Execution created via REST: ${executionKey}`);
    } else {
      console.error(`  ⚠️  REST import returned ${importRes.status}: ${await importRes.text()}`);
    }
  } catch (e) { console.error('  REST import error:', e); }

  // Xray REST import does not populate the Jira description field.
  // Write it directly via the Jira REST API now that we have the execution key.
  if (executionKey) {
    await setJiraDescription(executionKey, {
      issueId: opts.issueId,
      total: opts.results.length,
      passed,
      failed,
      healed,
      healLines,
    });
  }

  if (!executionKey) {
    console.error('  ⚠️  No Test Execution ticket created — both GraphQL and REST import failed');
  }

  return {
    tms: 'xray',
    updated: executionKey ? opts.results.length : 0,
    failed: executionKey ? 0 : opts.results.length,
    executionKey,
  };
}

async function setJiraDescription(
  issueKey: string,
  info: { issueId: string; total: number; passed: number; failed: number; healed: number; healLines: string[] },
): Promise<void> {
  const base = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!base || !email || !token) return;

  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  // Build Atlassian Document Format (ADF) content blocks
  const paragraphs = (lines: string[]) =>
    lines.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    }));

  const contentBlocks: object[] = [
    ...paragraphs([
      `Requirement: ${info.issueId}`,
      `Tests run: ${info.total}   Passed: ${info.passed}   Failed: ${info.failed}   Healed: ${info.healed}`,
    ]),
  ];

  if (info.healLines.length) {
    contentBlocks.push(
      { type: 'paragraph', content: [{ type: 'text', text: 'Auto-healed test cases:', marks: [{ type: 'strong' }] }] },
      ...paragraphs(info.healLines),
    );
  }


  try {
    const res = await fetch(`${base}/rest/api/3/issue/${issueKey}`, {
      method: 'PUT',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          description: { type: 'doc', version: 1, content: contentBlocks },
        },
      }),
    });
    if (res.ok || res.status === 204) {
      console.error(`  📝 Description written to ${issueKey}`);
    } else {
      console.error(`  ⚠️  Could not update description on ${issueKey}: ${res.status} ${await res.text()}`);
    }
  } catch (e) {
    console.error(`  ⚠️  Description update failed for ${issueKey}:`, e);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// GraphQL response shape
interface XrayTest {
  issueId: string;
  jira: { key: string; summary: string; priority?: { name: string } };
  testType?: { name: string };
  steps?: { id: string; action: string; data: string; result: string }[];
}

function normalizeXrayTest(test: XrayTest): TestCase {
  const steps: TCStep[] = (test.steps || []).map((s, i) => ({
    stepNumber: i + 1,
    action: s.action,
    testData: s.data,
    expectedResult: s.result,
  }));

  const typeMap: Record<string, TCType> = {
    Manual: 'Functional', Generic: 'API', Cucumber: 'Functional',
  };

  return {
    id: test.jira?.key || test.issueId,
    title: test.jira?.summary || '',
    type: typeMap[test.testType?.name || 'Manual'] || 'Functional',
    priority: xrayPriorityToTC(test.jira?.priority?.name || ''),
    preconditions: [],
    steps,
    automated: false,
    status: 'Ready',
    nativeId: test.jira?.key,
  };
}

function xrayPriority(priority: TCPriority): string {
  return { P0: 'Highest', P1: 'High', P2: 'Medium', P3: 'Low' }[priority];
}

function xrayPriorityToTC(name: string): TCPriority {
  if (!name) return 'P2';
  if (name.match(/critical/i)) return 'P0';
  if (name.match(/high/i)) return 'P1';
  if (name.match(/low/i)) return 'P3';
  return 'P2';
}

function executionStatusToXray(status: ExecutionStatus): string {
  return { passed: 'PASSED', failed: 'FAILED', flaky: 'FAILED', skipped: 'TODO', blocked: 'BLOCKED' }[status] || 'TODO';
}
