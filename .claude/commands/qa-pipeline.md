# /qa-pipeline

You are the **swayambhu-qa Orchestrator** — a self-manifested QA agent.

You run the full QA lifecycle end-to-end, automatically:

```
Issue Tracker  →  Scrape App  →  Generate Test Cases  →  Automate
     →  Run Tests  →  Auto-Heal (up to 2 rounds)  →  Publish Report
```

No human involvement between steps unless a step explicitly says **⏸ PAUSE**.

---

## Input

```
/qa-pipeline --issue <id> [--source <source>] [--tool <tools>] [--repo <owner/repo>] [--tms <tms>] [--no-pr]
```

### Flags

| Flag | Required? | Supported values | Default | When to omit |
|---|---|---|---|---|
| `--issue` | **Always** | Any issue ID | — | Never. JIRA: `TEST-22`, GitHub: `42`, ADO: `12345`, Linear: `ENG-456` |
| `--source` | No | `github`, `jira`, `ado`, `linear` | `github` | Omit if using GitHub Issues |
| `--repo` | GitHub only | e.g. `myorg/myrepo` | — | Omit for JIRA, ADO, Linear — only needed with `--source github` |
| `--tool` | No | `playwright`, `cypress`, `selenium`, `selenium:testng`, `selenium:junit`, `restassured`, `restassured:junit`, `appium`, `robot:ui`, `robot:api` | `playwright` | Omit to default to Playwright. Combine: `playwright,restassured` |
| `--tms` | No | `xray`, `testrail`, `zephyr`, `markdown` | `markdown` | Omit to write results locally. Add `--tms xray` (or `testrail`/`zephyr`) only if you have credentials configured in `.env` |
| `--no-pr` | No | _(flag, no value)_ | _(PR is created)_ | Omit to get a Draft PR. Add to skip for local runs or no git remote |

### Examples
```bash
# JIRA → Playwright only
/qa-pipeline --issue TEST-22 --source jira --tool playwright

# JIRA → Playwright + REST Assured (UI + API)
/qa-pipeline --issue TEST-22 --source jira --tool playwright,restassured

# ADO → Selenium + TestNG
/qa-pipeline --issue 12345 --source ado --tool selenium:testng

# Linear → Cypress + REST Assured
/qa-pipeline --issue ENG-456 --source linear --tool cypress,restassured

# GitHub → Playwright, skip PR
/qa-pipeline --issue 42 --source github --repo myorg/myrepo --tool playwright --no-pr

# No TMS (write test cases as local markdown files)
/qa-pipeline --issue TEST-22 --source jira --tool playwright --tms markdown
```

---

## Logging

Every phase writes a structured log line automatically via `scripts/logger.ts`.

Log files:
- `logs/pipeline-<issueId>-<YYYY-MM-DD>.log` — full run log, one file per issue per day
- `logs/pipeline-latest.log` — always overwritten with the most recent run (useful for quick inspection)

Log line format:
```
2026-05-26T10:30:01Z [PHASE-1] [OK   ] Fetched TEST-22: "Budget Tracker" | priority="P2" | ui="https://..."
2026-05-26T10:31:00Z [PHASE-2] [OK   ] Scrape complete | inputs=4 | buttons=2 | testids=0 | interactionsClicked=1
2026-05-26T10:32:00Z [PHASE-3] [OK   ] Pushed 7 test cases to xray | ids="TEST-23, TEST-24, ..."
2026-05-26T10:33:00Z [PHASE-5] [FAIL ] 14 failed / 72 total
2026-05-26T10:33:01Z [HEAL   ] [HEAL ] Round 1 | cause=pointer-intercept-mobile | fix=js-evaluate-click | fixed=14 | remaining=3
2026-05-26T10:33:30Z [HEAL   ] [HEAL ] Round 2 | cause=pointer-intercept-mobile | fix=js-evaluate-click | fixed=3 | remaining=0
2026-05-26T10:34:00Z [PIPELINE] [DONE ] 72/72 passed | bugs=0 | rounds=2 | duration=220s
```

The `fetch-issue.ts`, `scrape-app.ts`, `push-to-tms.ts`, and `update-tms-status.ts` scripts log automatically.

For phases the agent handles directly (Phase 4 spec generation, Phase 6 heal decisions, Phase 7 bugs), emit log entries using:
```bash
npx ts-node -e "
  const { logger } = require('./scripts/logger');
  const log = logger('<issueId>');
  log.phase(<n>, '<STATUS>', '<message>', { key: 'value' });
"
```

Or for the heal loop specifically:
```bash
npx ts-node -e "
  const { logger } = require('./scripts/logger');
  const log = logger('<issueId>');
  log.heal(<round>, '<cause>', '<fix>', { fixed: <n>, remaining: <n> });
"
```

---

## Pre-flight: Argument & Env Check

### Step 1 — Parse & apply defaults

Parse from `$ARGUMENTS` and apply defaults for anything not provided:

| Argument | Provided? | Value to use |
|---|---|---|
| `--issue`  | Required — **stop if missing** | Issue ID: JIRA `TEST-22`, GitHub `42`, ADO `12345`, Linear `ENG-456` |
| `--source` | Optional | Provided value, else **default: `github`** |
| `--tool`   | Optional | Provided value (comma-separated), else **default: `playwright`** |
| `--tms`    | Optional | Provided value, else **default: `markdown`** (writes locally, no external TMS needed) |
| `--repo`   | Conditional | Required **only when `--source github`** — stop if missing |
| `--no-pr`  | Optional flag | If present: skip PR. If absent: create Draft PR |

If `--issue` is missing, stop immediately:
> ❌ `--issue` is required. Example: `/qa-pipeline --issue TEST-22 --source jira --tool playwright`

If `--source github` but `--repo` is missing, stop:
> ❌ `--repo owner/repo` is required when using `--source github`. Example: `/qa-pipeline --issue 42 --source github --repo myorg/myrepo --tool playwright`

### Step 2 — Validate env vars for the resolved source

Check `.env` for the credentials required by the chosen `--source`:

| Source | Required env vars | How to get them |
|---|---|---|
| `github` | gh CLI auth — run `gh auth status` to verify | `gh auth login` |
| `jira`   | `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | Atlassian → My Profile → API Tokens |
| `ado`    | `ADO_ORG`, `ADO_PROJECT`, `ADO_PAT` | Azure DevOps → User Settings → Personal Access Tokens |
| `linear` | `LINEAR_API_KEY` | Linear → Settings → API → Personal API Keys |

If any are missing or empty, stop and list exactly which vars need to be added to `.env`:
> ❌ Missing env vars for `--source jira`: `JIRA_API_TOKEN`. Add it to your `.env` file and re-run.

### Step 3 — Validate env vars for the resolved TMS (skip if `--tms markdown`)

| TMS | Required env vars | How to get them |
|---|---|---|
| `xray`     | `XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET`, `XRAY_PROJECT_KEY` | JIRA → Apps → Xray → API Keys |
| `testrail` | `TESTRAIL_URL`, `TESTRAIL_USER`, `TESTRAIL_API_KEY`, `TESTRAIL_PROJECT_ID` | TestRail → My Settings → API Keys |
| `zephyr`   | `ZEPHYR_BASE_URL`, `ZEPHYR_API_TOKEN`, `ZEPHYR_PROJECT_KEY` | JIRA → Zephyr Scale → API Tokens |
| `markdown` | _(none — results written to `reports/` folder)_ | — |

If TMS vars are missing, stop:
> ❌ Missing env vars for `--tms xray`: `XRAY_CLIENT_SECRET`. Add it to `.env` or use `--tms markdown` to skip TMS sync.

### Step 4 — Print the resolved plan and confirm

Print everything that was resolved (including which values came from defaults) before running a single phase:

```
🚀 swayambhu-qa Pipeline
   Issue:   TEST-22  (jira)
   Tool:    playwright                     ← default
   TMS:     markdown                       ← default (no external TMS)
   PR:      yes
   
   ⚡ Starting in 3 seconds — Ctrl+C to abort
```

If any value came from a default (not explicitly passed), mark it with `← default` so the user knows what was inferred.

---

## PHASE 1 — Read the Requirement

```bash
npx ts-node scripts/fetch-issue.ts --issue <id> --source <source> [--repo owner/repo]
```

Extract from the JSON output:
- `title` — feature name
- `acceptanceCriteria` — what must pass
- `testUrls.ui` — app URL for UI tools
- `testUrls.api` — base URL for API tools
- `credentials` — test users/passwords
- `apiEndpoints` — REST endpoints
- `priority` — P0/P1/P2/P3

**URL resolution order** (first found wins):
1. `--url` CLI flag
2. `testUrls.ui` / `testUrls.api` from the issue description (`Test URL:` / `API URL:` labels)
3. `BASE_URL` / `API_BASE_URL` from `.env`

If `testUrls.ui` is missing and a UI tool is selected, ask:
> "No UI URL found in the ticket. What page should I test?"

Print:
```
📋 TEST-22: "Budget Tracker" | Priority: P2 | UI: qaplayground.dev/apps/budget-tracker/
```

If `apiEndpoints` is empty and an API tool is selected, ask:
> "No API endpoints found in the ticket. Should I skip API tests or would you like to add endpoints?"

---

## PHASE 2 — Scrape the App

**Skip if API-only tools selected** (e.g. `--tool restassured`, `--tool robot:api`).

**Skip this phase if selected tools are API-only** (e.g. `--tool restassured`, `--tool robot:api`).

```bash
npx ts-node scripts/scrape-app.ts --url <testUrls.ui>
```

This runs a real Playwright browser (headless Chromium) against the live app.
It clicks all visible buttons to reveal hidden forms, then collects:
- All `input`, `select`, `textarea` elements with `id`, `name`, `placeholder`, `class`, `data-testid`
- All `button` elements with text, `class`, `data-testid`
- All `[data-testid]` elements
- Page headings and labels

Use these real selectors when writing the automation scripts in Phase 4.
**Never invent selectors — only use what the scrape returns.**

---

## PHASE 3 — Generate Test Cases

Create `test-cases/TC-<issueId>-<feature-slug>.md`.

Write test cases covering:
- **Happy Path** (2–3): one per main acceptance criterion
- **Negative / Edge** (2–3): empty inputs, invalid data, boundary values
- **Role-based** (1–2): if credentials exist in the issue
- **API** (1–3): one per endpoint — only if API tool selected
- **Accessibility** (1): keyboard nav — only if UI web tool selected

Each TC must have: ID, priority, type, steps table (# | Action | Test Data | Expected Result), Preconditions.

Then push to TMS if configured:
```bash
npx ts-node scripts/push-to-tms.ts --tms <tms> --issue <id> --file test-cases/TC-<issueId>-*.md
```

**⏸ PAUSE — Show test cases and ask:**
> "Here are the N test cases I'll automate. Review them — any changes before I write the code?
> Reply **yes** to proceed or tell me what to change."

Wait for human confirmation before Phase 4.

---

## PHASE 4 — Generate Automation Scripts

Use the selectors from Phase 2 and the test cases from Phase 3.
Generate scripts for all selected tools simultaneously.

### Playwright (`--tool playwright`)

Before writing the spec, check if `playwright.config.ts` and `tsconfig.json` exist. If either is missing, create them now:

**`playwright.config.ts`** (if missing):
```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: { headless: true, screenshot: 'only-on-failure' },
  reporter: [['json', { outputFile: 'reports/pw-results.json' }], ['line']],
});
```

**`tsconfig.json`** (if missing):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": false,
    "esModuleInterop": true,
    "outDir": "dist"
  },
  "include": ["tests/**/*", "scripts/**/*"]
}
```

Write `tests/generated/<feature-slug>.spec.ts`:
- Locator priority: `getByRole` → `getByLabel` → `getByPlaceholder` → `page.locator('.class')` → `getByTestId`
- Group into `test.describe`: Happy Path / Negative Cases / Accessibility
- Web-first assertions only (`toBeVisible`, `toHaveText`, `toHaveURL`, `toHaveValue`)
- No `waitForTimeout` — use `waitForSelector` or assertion retries instead
- If a button is inside a table cell or behind a sticky nav on mobile, use `.evaluate(el => el.click())` to avoid pointer intercept

Validate the spec compiles:
```bash
npx playwright test --list tests/generated/<feature-slug>.spec.ts
```

### Cypress (`--tool cypress`)

Write `cypress/e2e/generated/<feature-slug>.cy.ts`:
- Locator priority: `cy.get('[data-testid="..."]')` → `cy.contains()` → `cy.get('.class')`
- No `cy.wait(<number>)` — use `cy.intercept()` or `cy.should()` retry

### Selenium (`--tool selenium[:testng|junit|cucumber]`)

Write `src/test/java/com/swayambhuqa/tests/generated/<Feature>Test.java`.
Runner defaults to TestNG unless `:junit` or `:cucumber` specified.
Validate: `mvn test-compile -q 2>&1 | tail -5`

### REST Assured (`--tool restassured[:testng|junit|cucumber]`)

Write `api-tests/src/test/java/com/swayambhuqa/tests/generated/<Feature>ApiTest.java`.
Use `ApiConfig.spec()` for base URL — reads from `API_BASE_URL` env var.
Validate: `cd api-tests && mvn test-compile -q 2>&1 | tail -5`

### Appium (`--tool appium`)

Write `src/test/java/com/swayambhuqa/tests/generated/<Feature>AppTest.java`.
Ask platform (Android/iOS) if not in the issue.
Validate: `mvn test-compile -q 2>&1 | tail -5`

### Robot Framework (`--tool robot:ui|api|android|ios`)

Write `tests/robot/generated/<feature-slug>.robot`.
Import: SeleniumLibrary (ui) / RequestsLibrary (api) / AppiumLibrary (android|ios).
Validate: `robot --dryrun tests/robot/generated/<feature-slug>.robot 2>&1 | tail -5`

---

## PHASE 5 — Run Tests

Run all selected tools via the run-tests wrapper, which maps Playwright test results
back to TC IDs (using `test.info().annotations`) and writes `reports/results-<issueId>.json`.

**Playwright:**
```bash
npx ts-node scripts/run-tests.ts --issue <issueId> --spec tests/generated/<feature-slug>.spec.ts
```

This reads `reports/tc-mapping-<issueId>.json` (written by Phase 3's push-to-tms) to resolve
each TC's native TMS key, then writes `reports/results-<issueId>.json` with one entry per TC.

**Cypress:**
```bash
npx cypress run --spec cypress/e2e/generated/<feature-slug>.cy.ts --headless
```

**Selenium / REST Assured / Appium:**
```bash
mvn test -Dtest=<Feature>Test,<Feature>ApiTest -q 2>&1 | tail -20
```

**Robot:**
```bash
robot --outputdir reports/robot tests/robot/generated/<feature-slug>.robot
```

After running, classify every test as: ✅ passed | ❌ failed | ⚠️ flaky (passed on retry).

---

## PHASE 6 — Auto-Heal Loop

This phase runs automatically — no human input needed.

```
ROUND 1
  For each failing test:
    1. Read the exact error message and stack trace
    2. Classify the failure:
       - Selector/locator broken   → re-scrape, find new selector, patch spec
       - Timing/wait issue         → replace waitForTimeout with proper assertion
       - Wrong test data           → correct the data in the spec
       - Pointer intercept (mobile)→ use .evaluate(el => el.click())
       - Logic mismatch            → flag for human review (skip heal, go to Phase 7)
       - Real app bug              → skip heal, go to Phase 7
    3. Apply the patch to the test file
  Re-run all previously-failing tests
  
  → If all pass now: proceed to Phase 7 ✅
  → If some still fail: go to ROUND 2

ROUND 2
  Repeat the same classify → patch → re-run cycle for remaining failures.
  
  → If all pass now: proceed to Phase 7 ✅
  → If still failing after Round 2: mark as CONFIRMED FAILURES
    Print for each:
      ❌ <test name> — could not heal after 2 rounds
         Likely cause: <classification>
         Error: <error message>
    Proceed to Phase 7 with confirmed failures as bug candidates
```

**Heal rules:**
- Never change what a test is asserting to make it pass — only fix how it reaches the assertion
- If the app behaviour genuinely differs from the AC, that is a bug, not a test fix
- Selector fixes must come from a fresh scrape, not guessing
- Maximum 2 rounds — do not loop indefinitely

---

## PHASE 7 — Log Bugs

For every test that failed after 2 heal rounds:

```bash
npx ts-node scripts/create-bug.ts \
  --source <source> \
  --issue <issueId> \
  --title "[BUG] <one-line description from error>" \
  --tc-id <TC-id> \
  --tool <tool> \
  --feature <feature-slug> \
  --error "<error message>"
```

Print each created bug URL.
If zero confirmed failures: print "✅ No bugs to log — all tests green."

---

## PHASE 8 — Update TMS & Comment on Issue

**Always run this phase regardless of which tool was used (Playwright, REST Assured, Cypress, etc.).**

Use the `--tms` value resolved in Pre-flight (**default: `markdown`** — do NOT skip this phase; if `--tms` was not passed, use `markdown` which writes results locally without needing any external TMS credentials).

Push pass/fail results back to TMS. The results file is always at `reports/results-<issueId>.json`:

```bash
node node_modules/@swayambhu-qa/core/dist/scripts/update-tms-status.js \
  --tms <tms> --issue <issueId> --results reports/results-<issueId>.json
```

Log the Test Execution ticket ID from the output (e.g. `TEST-69`) and include it in the Phase 10 final summary.

Post a structured comment on the original issue:
```bash
npx ts-node scripts/comment-issue.ts --source <source> --issue <issueId> --body "..."
```

Comment format:
```
## 🤖 swayambhu-qa Report — <issueId>

**Date:** <date>   **Tools:** <tool list>   **Heal rounds used:** <0|1|2>

### Results

| Suite | Tests | ✅ Passed | ❌ Failed | 🔁 Healed |
|-------|-------|-----------|-----------|-----------|
| UI    | <n>   | <n>       | <n>       | <n>       |
| API   | <n>   | <n>       | <n>       | <n>       |

### Acceptance Criteria Coverage

| AC | Test Case | Result |
|----|-----------|--------|
| <AC text> | TC-<id>-01 | ✅ Passed |

### Bugs Logged
<links or "None">

### Generated Files
<list of spec files>
```

---

## PHASE 9 — Draft PR

**Skip if `--no-pr` flag passed or if this is not a git repo.**

First detect the remote hosting platform:
```bash
git remote get-url origin
```

Verify the appropriate CLI is authenticated before proceeding:
- `github.com` → `gh auth status`
- `gitlab.com` → `glab auth status`
- `bitbucket.org` → `bb whoami`
- `dev.azure.com` / `visualstudio.com` → `az devops configure --list`

If the CLI is not authenticated, skip Phase 9 and note it in the final summary.

```bash
git checkout -b qa/<feature-slug>-<issueId>
git add test-cases/ tests/generated/ tests/robot/generated/ \
        cypress/e2e/generated/ \
        src/test/java/com/swayambhuqa/tests/generated/ \
        api-tests/src/test/java/com/swayambhuqa/tests/generated/
git commit -m "test: QA automation for <issueId> — <feature title>"
git push -u origin HEAD
```

**GitHub** (remote contains `github.com`) — requires `gh auth login`:
```bash
gh pr create --draft \
  --title "test: QA for <issueId> — <feature title>" \
  --body "Automated by swayambhu-qa. <passed>/<total> tests green. Bugs: <n>."
```

**GitLab** (remote contains `gitlab.com`) — requires `glab auth login`:
```bash
glab mr create --draft \
  --title "test: QA for <issueId> — <feature title>" \
  --description "Automated by swayambhu-qa. <passed>/<total> tests green. Bugs: <n>."
```

**Bitbucket** (remote contains `bitbucket.org`) — requires `bb` CLI:
```bash
bb pr create \
  --title "test: QA for <issueId> — <feature title>" \
  --description "Automated by swayambhu-qa. <passed>/<total> tests green. Bugs: <n>."
```

**Azure DevOps** (remote contains `dev.azure.com` or `visualstudio.com`) — requires `az devops` CLI:
```bash
az repos pr create --draft \
  --title "test: QA for <issueId> — <feature title>" \
  --description "Automated by swayambhu-qa. <passed>/<total> tests green. Bugs: <n>."
```

---

## PHASE 10 — Final Summary

Always end with this block:

```
╔══════════════════════════════════════════════════════════╗
║              swayambhu-qa Pipeline Complete              ║
╠══════════════════════════════════════════════════════════╣
║  Issue       <issueId> — <title>                         ║
║  Source      <source>                                    ║
║  Tools       <tool list>                                 ║
╠══════════════════════════════════════════════════════════╣
║  Test Cases  <n> generated                               ║
║  UI Tests    <passed>/<total>  (<tool>)                  ║
║  API Tests   <passed>/<total>  (<tool>)                  ║
║  Healed      <n> tests across <0|1|2> rounds             ║
║  Bugs Logged <n>                                         ║
║  Xray Exec   <executionKey> (or "not created")           ║
║  Draft PR    #<number> (or skipped)                      ║
╚══════════════════════════════════════════════════════════╝
```
