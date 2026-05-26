/**
 * Shared BugReport type — the normalized input to every bug logger.
 * All sources (GitHub, JIRA, ADO, Linear) receive this shape so the
 * rest of the pipeline remains completely source-agnostic.
 */

export type BugSource = 'github' | 'jira' | 'ado' | 'linear';

export interface BugReport {
  title: string;           // Short bug title, e.g. "Logout does not navigate back to login"
  tcId: string;            // TC that caught it, e.g. "TC-1-05"
  tcTitle: string;         // TC title, e.g. "User can log out and return to login page"
  tool: string;            // Automation tool, e.g. "Playwright", "REST Assured"
  featureSlug: string;     // Feature under test, e.g. "secure-bank-login"
  stepsToReproduce: string[];  // Steps from TC
  expectedResult: string;  // Expected result from TC
  actualResult: string;    // What actually happened
  errorMessage: string;    // Error or assertion message from test output
  stackTrace?: string;     // Stack trace (optional, may be long)
  issueId?: string;        // Original requirement issue ID (to link the bug back)
  issueSource?: BugSource; // Source of the original requirement
  repo?: string;           // GitHub: owner/repo (required for github source)
}

export interface CreatedBug {
  source: BugSource;
  bugId: string;           // GitHub: "42" | JIRA: "PROJ-456" | ADO: "78901" | Linear: "ENG-789"
  bugLink: string;         // URL to the created bug
  title: string;
}
