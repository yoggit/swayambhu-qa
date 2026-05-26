/**
 * Shared TMS types — normalized shapes for reading, pushing, and updating test cases.
 * All TMS connectors (TestRail, Xray, Zephyr, Markdown) use these types so the
 * pipeline remains TMS-agnostic.
 */

export type TMSType = 'testRail' | 'xray' | 'zephyr' | 'markdown';

export type TCType = 'Functional' | 'Negative' | 'Role-based' | 'API' | 'Mobile' | 'Accessibility';
export type TCPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type TCStatus = 'Draft' | 'Ready' | 'Blocked';

export type ExecutionStatus = 'passed' | 'failed' | 'flaky' | 'skipped' | 'blocked';

export interface TCStep {
  stepNumber: number;
  action: string;
  testData: string;
  expectedResult: string;
}

export interface TestCase {
  id: string;              // e.g. "TC-1-01" (markdown) | "C1001" (TestRail) | "PROJ-200" (Xray)
  title: string;
  type: TCType;
  priority: TCPriority;
  preconditions: string[];
  steps: TCStep[];
  automated: boolean;
  tool?: string;           // e.g. "Playwright", "REST Assured"
  status: TCStatus;
  nativeId?: string;       // Raw ID in the TMS (e.g. TestRail case ID integer)
}

export interface TestResult {
  tcId: string;            // Matches TestCase.id
  nativeId?: string;       // TMS-native ID, needed to write results back
  status: ExecutionStatus;
  tool: string;
  errorMessage?: string;
  notes?: string;
  durationMs?: number;
  healAttempts?: number;   // Auto-heal rounds this test went through (0 = passed first time)
  healCause?: string;      // Root cause identified (e.g. "pointer-intercept-mobile")
  healFix?: string;        // Fix applied (e.g. "js-evaluate-click")
}

export interface TMSPushResult {
  tms: TMSType;
  issueId: string;
  suiteName?: string;
  pushedIds: string[];     // Native TMS IDs of created TCs
}

export interface TMSReadResult {
  tms: TMSType;
  testCases: TestCase[];
  suiteId?: string;
  suiteName?: string;
}

export interface TMSUpdateResult {
  tms: TMSType;
  updated: number;
  failed: number;
}
