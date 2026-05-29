/**
 * run-tests.ts — Phase 5: run generated tests and produce a results JSON.
 *
 * Dispatches to the correct runner based on --tool:
 *   playwright              → npx playwright test (JSON reporter)
 *   selenium                → mvn test (Surefire XML)
 *   selenium:testng         → mvn test (Surefire XML, TestNG runner)
 *   selenium:junit          → mvn test (Surefire XML, JUnit runner)
 *   selenium:cucumber       → mvn test (Cucumber JSON report)
 *   restassured             → mvn test (Surefire XML, TestNG runner — default)
 *   restassured:testng      → mvn test (Surefire XML, TestNG runner)
 *   restassured:junit       → mvn test (Surefire XML, JUnit runner)
 *   restassured:cucumber    → mvn test (Cucumber JSON)
 *
 * For Playwright: --spec is the .spec.ts file path.
 * For Maven tools: --spec is the Java class name (e.g. com.swayambhuqa.tests.generated.LoginTest)
 *   or a Cucumber runner class.
 *
 * TC ID conventions:
 *   Playwright   → test.info().annotations.push({ type: 'tcId', description: 'TC-TEST22-01' })
 *   Selenium     → method name contains TC_ISSUEID_SEQ (e.g. TC_TEST22_01_loginHappyPath)
 *   Cucumber     → scenario tag @TC-TEST22-01
 *
 * Usage:
 *   npx ts-node scripts/run-tests.ts \
 *     --id TEST-22 \
 *     --spec tests/generated/budget-tracker.spec.ts \
 *     [--tool playwright]
 *
 *   npx ts-node scripts/run-tests.ts \
 *     --id TEST-22 \
 *     --spec com.swayambhuqa.tests.generated.LoginTest \
 *     --tool selenium:testng
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { logger } from './logger';
import { TestResult, ExecutionStatus } from './tms/types';

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const issueId  = getArg('--id')      || '';
const specFile = getArg('--spec')    || '';
const tool     = getArg('--tool')    || 'playwright';
const project  = getArg('--project');        // Playwright only

if (!issueId || !specFile) {
  console.error('Error: --id <id> and --spec <path> are required');
  process.exit(1);
}

// ─── TC mapping ───────────────────────────────────────────────────────────────

function loadTcMapping(issue: string): Record<string, string> {
  const mappingPath = path.join('reports', `tc-mapping-${issue}.json`);
  if (!fs.existsSync(mappingPath)) {
    console.error(`Warning: TC mapping not found at ${mappingPath} — nativeId will be empty`);
    return {};
  }
  return JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
}

// ─── Playwright ───────────────────────────────────────────────────────────────

interface PwResult { status: string; duration: number; error?: { message: string } }
interface PwTest   { status: string; annotations: { type: string; description: string }[]; results: PwResult[] }
interface PwSpec   { title: string; ok: boolean; annotations: { type: string; description: string }[]; tests: PwTest[] }
interface PwSuite  { title: string; specs: PwSpec[]; suites: PwSuite[] }
interface PwReport { suites: PwSuite[] }

function flattenSpecs(suite: PwSuite): PwSpec[] {
  return [...(suite.specs || []), ...(suite.suites || []).flatMap(flattenSpecs)];
}

function getTcId(spec: PwSpec): string | undefined {
  for (const t of spec.tests || []) {
    const ann = t.annotations?.find((a) => a.type === 'tcId');
    if (ann) return ann.description;
  }
  return spec.annotations?.find((a) => a.type === 'tcId')?.description;
}

function runPlaywright(jsonReport: string): boolean {
  const projectFlag = project ? `--project="${project}"` : '';
  try {
    execSync(
      `npx playwright test "${specFile}" --reporter=json ${projectFlag} 1>"${jsonReport}" 2>/dev/null`,
      { shell: true },
    );
    return false;
  } catch {
    return true;
  }
}

function parsePlaywrightResults(jsonReport: string, tcMapping: Record<string, string>): TestResult[] {
  const report: PwReport = JSON.parse(fs.readFileSync(jsonReport, 'utf-8'));
  const allSpecs = report.suites.flatMap(flattenSpecs);

  const tcGroups: Record<string, PwSpec[]> = {};
  for (const spec of allSpecs) {
    const tcId = getTcId(spec);
    if (!tcId) continue;
    if (!tcGroups[tcId]) tcGroups[tcId] = [];
    tcGroups[tcId].push(spec);
  }

  return Object.entries(tcGroups).map(([tcId, specs]) => {
    const anyFailed = specs.some((s) => !s.ok);
    const errorMessages = specs
      .flatMap((s) => s.tests || [])
      .flatMap((t) => t.results || [])
      .map((r) => r.error?.message)
      .filter(Boolean)
      .slice(0, 2)
      .join(' | ');
    const totalDuration = specs
      .flatMap((s) => s.tests || [])
      .flatMap((t) => t.results || [])
      .reduce((sum, r) => sum + (r.duration || 0), 0);

    return {
      tcId,
      nativeId: tcMapping[tcId] || '',
      status: (anyFailed ? 'failed' : 'passed') as ExecutionStatus,
      tool: 'Playwright',
      errorMessage: errorMessages || undefined,
      durationMs: totalDuration,
      healAttempts: 0,
    };
  });
}

// ─── Cypress ──────────────────────────────────────────────────────────────────

interface MochaTest {
  title: string;
  fullTitle: string;
  duration?: number;
  err?: { message?: string };
}

interface MochaReport {
  passes:   MochaTest[];
  failures: MochaTest[];
  pending:  MochaTest[];
}

/**
 * Extract TC ID from a Cypress it() title.
 * Convention: '[TC-ISSUEID-SEQ] description' → TC-ISSUEID-SEQ
 * Example: '[TC-TEST22-01] should login' → TC-TEST22-01
 */
function tcIdFromCypressTitle(title: string): string | undefined {
  const m = title.match(/\[TC-([^\]]+)\]/);
  return m ? `TC-${m[1]}` : undefined;
}

function runCypress(specFile: string, jsonReport: string): boolean {
  try {
    execSync(
      `npx cypress run --spec "${specFile}" --headless --reporter json 1>"${jsonReport}" 2>/dev/null`,
      { shell: true },
    );
    return false;
  } catch {
    return true;
  }
}

function parseCypressResults(jsonReport: string, tcMapping: Record<string, string>): TestResult[] {
  const report: MochaReport = JSON.parse(fs.readFileSync(jsonReport, 'utf-8'));

  const tcGroups: Record<string, { failed: boolean; errorMessage?: string; durationMs: number }[]> = {};

  const collect = (tests: MochaTest[], failed: boolean) => {
    for (const t of tests) {
      const tcId = tcIdFromCypressTitle(t.title) || tcIdFromCypressTitle(t.fullTitle);
      if (!tcId) continue;
      if (!tcGroups[tcId]) tcGroups[tcId] = [];
      tcGroups[tcId].push({
        failed,
        errorMessage: t.err?.message?.slice(0, 200),
        durationMs: t.duration || 0,
      });
    }
  };

  collect(report.passes   || [], false);
  collect(report.failures || [], true);

  return Object.entries(tcGroups).map(([tcId, runs]) => ({
    tcId,
    nativeId:     tcMapping[tcId] || '',
    status:       (runs.some((r) => r.failed) ? 'failed' : 'passed') as ExecutionStatus,
    tool:         'Cypress',
    errorMessage: runs.find((r) => r.errorMessage)?.errorMessage,
    durationMs:   runs.reduce((s, r) => s + r.durationMs, 0),
    healAttempts: 0,
  }));
}

// ─── Robot Framework ──────────────────────────────────────────────────────────

/**
 * Extract TC ID from a Robot Framework test case name.
 * Convention: 'TC-ISSUEID-SEQ Description' → TC-ISSUEID-SEQ
 * Example: 'TC-TEST22-01 Login With Valid Credentials' → TC-TEST22-01
 */
function tcIdFromRobotName(name: string): string | undefined {
  const m = name.match(/^(TC-[A-Za-z0-9]+-\d+)/);
  return m ? m[1] : undefined;
}

function runRobot(specFile: string, outputXml: string): boolean {
  const outputDir  = path.dirname(outputXml);
  const outputFile = path.basename(outputXml);
  fs.mkdirSync(outputDir, { recursive: true });
  try {
    execSync(
      `robot --outputdir "${outputDir}" --output "${outputFile}" --log NONE --report NONE "${specFile}" 2>/dev/null`,
      { shell: true },
    );
    return false;
  } catch {
    return true;
  }
}

/**
 * Parse Robot Framework output.xml.
 * Flattens all <test> elements from nested <suite> elements.
 */
function parseRobotResults(outputXml: string, tcMapping: Record<string, string>, toolName: string): TestResult[] {
  if (!fs.existsSync(outputXml)) {
    console.error(`Warning: Robot output not found at ${outputXml}`);
    return [];
  }

  const xml = fs.readFileSync(outputXml, 'utf-8');
  const results: TestResult[] = [];

  // Match each <test name="..."> block
  const testPattern = /<test\s+[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/test>/g;
  let match: RegExpExecArray | null;

  while ((match = testPattern.exec(xml)) !== null) {
    const testName = match[1];
    const body     = match[2];

    const tcId = tcIdFromRobotName(testName);
    if (!tcId) continue;

    const statusMatch = body.match(/<status\s+status="([^"]+)"[^>]*(?:elapsed="([^"]*)")?[^>]*>([^<]*)<\/status>/);
    const status      = statusMatch?.[1] || 'FAIL';
    const elapsed     = parseFloat(statusMatch?.[2] || '0');
    const errorMsg    = status === 'FAIL' ? statusMatch?.[3]?.trim().slice(0, 200) : undefined;

    results.push({
      tcId,
      nativeId:     tcMapping[tcId] || '',
      status:       (status === 'PASS' ? 'passed' : 'failed') as ExecutionStatus,
      tool:         toolName,
      errorMessage: errorMsg || undefined,
      durationMs:   Math.round(elapsed * 1000),
      healAttempts: 0,
    });
  }

  return results;
}

// ─── Maven / Surefire ─────────────────────────────────────────────────────────

function runMaven(className: string): boolean {
  try {
    execSync(`mvn test -Dtest="${className}" -q 2>&1`, { shell: true, stdio: 'pipe' });
    return false;
  } catch {
    return true;
  }
}

/**
 * Extract TC ID from a Surefire test method name.
 * Convention: TC_ISSUEID_SEQ_description → TC-ISSUEID-SEQ
 * Example: TC_TEST22_01_loginHappyPath → TC-TEST22-01
 */
function tcIdFromMethodName(name: string): string | undefined {
  const m = name.match(/TC_([A-Za-z0-9]+)_(\d+)/);
  return m ? `TC-${m[1]}-${m[2]}` : undefined;
}

/**
 * Parse all Surefire XML reports in target/surefire-reports/.
 * Handles both self-closing <testcase .../> (passed) and
 * <testcase ...><failure .../></testcase> (failed).
 */
function parseSurefireResults(tcMapping: Record<string, string>, toolName: string): TestResult[] {
  const surefireDir = path.join('target', 'surefire-reports');
  if (!fs.existsSync(surefireDir)) {
    console.error(`Warning: surefire-reports not found at ${surefireDir}`);
    return [];
  }

  const xmlFiles = fs.readdirSync(surefireDir)
    .filter((f) => f.startsWith('TEST-') && f.endsWith('.xml'))
    .map((f) => path.join(surefireDir, f));

  const tcGroups: Record<string, { failed: boolean; errorMessage?: string; durationMs: number }[]> = {};

  for (const xmlFile of xmlFiles) {
    const xml = fs.readFileSync(xmlFile, 'utf-8');

    // Match each <testcase ...> block (self-closing or with children)
    const testcasePattern = /<testcase\s([^>]+?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
    let match: RegExpExecArray | null;

    while ((match = testcasePattern.exec(xml)) !== null) {
      const attrs = match[1];
      const body  = match[2] || '';

      const nameMatch = attrs.match(/name="([^"]+)"/);
      const timeMatch = attrs.match(/time="([^"]+)"/);
      if (!nameMatch) continue;

      const methodName  = nameMatch[1];
      const durationMs  = timeMatch ? Math.round(parseFloat(timeMatch[1]) * 1000) : 0;
      const failed      = /<failure|<error/.test(body);
      const errorMatch  = body.match(/<(?:failure|error)[^>]*message="([^"]*)"/) ||
                          body.match(/<(?:failure|error)[^>]*>([\s\S]*?)<\/(?:failure|error)>/);
      const errorMsg    = errorMatch ? errorMatch[1].trim().slice(0, 200) : undefined;

      const tcId = tcIdFromMethodName(methodName);
      if (!tcId) continue;

      if (!tcGroups[tcId]) tcGroups[tcId] = [];
      tcGroups[tcId].push({ failed, errorMessage: errorMsg, durationMs });
    }
  }

  return Object.entries(tcGroups).map(([tcId, runs]) => {
    const anyFailed   = runs.some((r) => r.failed);
    const errorMsg    = runs.find((r) => r.errorMessage)?.errorMessage;
    const totalDur    = runs.reduce((s, r) => s + r.durationMs, 0);

    return {
      tcId,
      nativeId:     tcMapping[tcId] || '',
      status:       (anyFailed ? 'failed' : 'passed') as ExecutionStatus,
      tool:         toolName,
      errorMessage: errorMsg,
      durationMs:   totalDur,
      healAttempts: 0,
    };
  });
}

// ─── Cucumber JSON ────────────────────────────────────────────────────────────

interface CucumberTag      { name: string }
interface CucumberStep     { result: { status: string; error_message?: string; duration?: number } }
interface CucumberElement  { name: string; tags: CucumberTag[]; steps: CucumberStep[]; type: string }
interface CucumberFeature  { elements: CucumberElement[] }

/**
 * Locate the Cucumber JSON report. Checks common Maven output locations.
 */
function findCucumberJson(): string | undefined {
  const candidates = [
    path.join('target', 'cucumber-reports', 'cucumber.json'),
    path.join('target', 'cucumber.json'),
    path.join('target', 'cucumber-results.json'),
  ];
  return candidates.find(fs.existsSync);
}

/**
 * Extract TC ID from Cucumber scenario tags.
 * Convention: @TC-ISSUEID-SEQ on the scenario
 */
function tcIdFromTags(tags: CucumberTag[]): string | undefined {
  const tag = tags?.find((t) => /^@TC-/.test(t.name));
  return tag ? tag.name.replace('@', '') : undefined;
}

function parseCucumberResults(tcMapping: Record<string, string>, toolName: string): TestResult[] {
  const jsonPath = findCucumberJson();
  if (!jsonPath) {
    console.error('Warning: Cucumber JSON report not found — checked target/cucumber-reports/cucumber.json and target/cucumber.json');
    return [];
  }

  const features: CucumberFeature[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const tcGroups: Record<string, { failed: boolean; errorMessage?: string; durationMs: number }[]> = {};

  for (const feature of features) {
    for (const element of feature.elements || []) {
      if (element.type === 'background') continue;

      const tcId = tcIdFromTags(element.tags || []);
      if (!tcId) continue;

      const failed = element.steps.some((s) => s.result?.status === 'failed' || s.result?.status === 'undefined');
      const errorMsg = element.steps
        .map((s) => s.result?.error_message)
        .filter(Boolean)[0]?.slice(0, 200);
      const durationMs = Math.round(
        element.steps.reduce((sum, s) => sum + (s.result?.duration || 0), 0) / 1_000_000,
      );

      if (!tcGroups[tcId]) tcGroups[tcId] = [];
      tcGroups[tcId].push({ failed, errorMessage: errorMsg, durationMs });
    }
  }

  return Object.entries(tcGroups).map(([tcId, runs]) => ({
    tcId,
    nativeId:     tcMapping[tcId] || '',
    status:       (runs.some((r) => r.failed) ? 'failed' : 'passed') as ExecutionStatus,
    tool:         toolName,
    errorMessage: runs.find((r) => r.errorMessage)?.errorMessage,
    durationMs:   runs.reduce((s, r) => s + r.durationMs, 0),
    healAttempts: 0,
  }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const log = logger(issueId);
  const tcMapping = loadTcMapping(issueId);

  fs.mkdirSync('reports', { recursive: true });

  const toolLabel = tool.charAt(0).toUpperCase() + tool.slice(1);
  log.phase(5, 'RUN', `Running ${tool} tests`, { spec: specFile });
  console.error(`🧪 Running tests: ${specFile} (${tool})`);

  let results: TestResult[] = [];
  let runFailed = false;

  // ── Playwright ──────────────────────────────────────────────────────────────
  if (tool === 'playwright') {
    const jsonReport = path.join('reports', `pw-results-${issueId}.json`);
    runFailed = runPlaywright(jsonReport);

    if (!fs.existsSync(jsonReport) || fs.statSync(jsonReport).size === 0) {
      log.phase(5, 'FAIL', 'Playwright produced no JSON output');
      console.error('Playwright produced no JSON output — is Playwright installed? (npx playwright install)');
      process.exit(1);
    }

    results = parsePlaywrightResults(jsonReport, tcMapping);
  }

  // ── Cypress ─────────────────────────────────────────────────────────────────
  else if (tool === 'cypress') {
    const jsonReport = path.join('reports', `cy-results-${issueId}.json`);
    runFailed = runCypress(specFile, jsonReport);

    if (!fs.existsSync(jsonReport) || fs.statSync(jsonReport).size === 0) {
      log.phase(5, 'FAIL', 'Cypress produced no JSON output');
      console.error('Cypress produced no JSON output — is Cypress installed? (npx cypress install)');
      process.exit(1);
    }

    results = parseCypressResults(jsonReport, tcMapping);

    if (results.length === 0) {
      log.phase(5, 'FAIL', 'No TC IDs found in Cypress results');
      console.error('No TC IDs found — ensure each it() title is prefixed with [TC-ISSUEID-SEQ]');
      process.exit(1);
    }
  }

  // ── Robot Framework ──────────────────────────────────────────────────────────
  else if (tool.startsWith('robot')) {
    const outputXml = path.join('reports', 'robot', `robot-output-${issueId}.xml`);
    runFailed = runRobot(specFile, outputXml);
    results = parseRobotResults(outputXml, tcMapping, toolLabel);

    if (results.length === 0) {
      log.phase(5, 'FAIL', 'No TC IDs found in Robot results');
      console.error('No TC IDs found — ensure each test case name starts with TC-ISSUEID-SEQ');
      process.exit(1);
    }
  }

  // ── Selenium / REST Assured — Cucumber ─────────────────────────────────────
  else if (tool === 'selenium:cucumber' || tool === 'restassured:cucumber') {
    runFailed = runMaven(specFile);
    results = parseCucumberResults(tcMapping, toolLabel);

    if (results.length === 0) {
      log.phase(5, 'FAIL', 'No Cucumber results parsed');
      console.error('No Cucumber results found — ensure the runner writes a JSON report to target/cucumber-reports/cucumber.json');
      process.exit(1);
    }
  }

  // ── Selenium TestNG / JUnit / REST Assured ──────────────────────────────────
  else if (
    tool === 'selenium'         ||
    tool === 'selenium:testng'  ||
    tool === 'selenium:junit'   ||
    tool === 'restassured'      ||
    tool === 'restassured:junit'||
    tool === 'restassured:testng'
  ) {
    runFailed = runMaven(specFile);
    results = parseSurefireResults(tcMapping, toolLabel);

    if (results.length === 0) {
      log.phase(5, 'FAIL', 'No Surefire results parsed');
      console.error('No Surefire results found — ensure Maven is installed and the test class was compiled');
      process.exit(1);
    }
  }

  else {
    console.error(`Unknown tool: "${tool}". Supported: playwright, cypress, selenium, selenium:testng, selenium:junit, selenium:cucumber, restassured, restassured:junit, restassured:testng, restassured:cucumber, robot:ui, robot:api, robot:android, robot:ios`);
    process.exit(1);
  }

  // ── Write results ───────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  log.phase(5, runFailed && failed > 0 ? 'FAIL' : 'OK', 'Tests complete', {
    total: results.length, passed, failed,
  });

  console.error(`${failed > 0 ? '❌' : '✅'} Tests: ${passed} passed, ${failed} failed (${results.length} TCs)`);

  const resultsPath = path.join('reports', `results-${issueId}.json`);
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.error(`   Results written: ${resultsPath}`);

  console.log(JSON.stringify(results, null, 2));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('run-tests failed:', err);
  process.exit(1);
});
