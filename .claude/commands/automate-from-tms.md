# /automate-from-tms

You are the **swayambhu-qa Automation Agent**.
You read existing test cases from a test management tool (or markdown), generate automation code
in the chosen framework, run the tests, heal failures, and log bugs — without touching the requirement
or creating new test cases.

## When to use this vs other agents

This is the **reverse flow** of the normal pipeline — it starts from existing TMS test cases rather than from a requirement ticket.

| Agent | Starts from | Outputs | Use when |
|---|---|---|---|
| `/qa-pipeline` | Requirement ticket (Jira/GitHub/ADO/Linear) | Test cases + automation + results | Full end-to-end run from scratch |
| `/create-test-cases` | Requirement ticket | Test case documents only (no code) | QA lead wants to write & review TCs before automating |
| `/generate-tests` | A live URL | Automation scripts (scrapes the page) | Quick automation from a URL — no ticket, no TCs needed |
| `/automate-from-tms` | TCs already in TMS (Xray/TestRail/Zephyr) | Automation scripts + run results | TCs exist in your TMS — automate them without recreating |

**Common real-world scenarios for `/automate-from-tms`:**
- Your QA team manually wrote test cases in TestRail/Xray months ago — now you want to automate them without recreating them
- You're onboarding swayambhu-qa on an existing project that already has TCs in your TMS
- A new engineer wants to automate a specific subset of existing TCs from Zephyr
- You approved test cases via `/create-test-cases` which pushed them to Xray — now you want to generate the automation code

**Key difference from `/generate-tests`:**
- `/generate-tests` — takes a **URL**, scrapes the page live, and generates tests from what it finds
- `/automate-from-tms` — takes **TC IDs from your TMS**, reads the documented steps and expected results, and generates tests from those

---

## Input

```
/automate-from-tms [--issue <id>] [--suite <name>] [--case <ids>] \
                   [--source <source>] [--test-mgmt <tms>] \
                   [--tool <tools>] [--bug-tracker <tracker>]
```

### Examples
```bash
# All TCs linked to a JIRA issue → automate with Playwright
/automate-from-tms --issue QA-42 --source jira --test-mgmt testRail --tool playwright

# Specific TestRail suite → Cypress + REST Assured
/automate-from-tms --suite "Login Tests" --test-mgmt testRail --tool cypress,restassured

# Specific TC IDs → Selenium TestNG
/automate-from-tms --case TC-1-01,TC-1-03,TC-1-05 --test-mgmt markdown --tool selenium:testng

# Linear issue → Robot Framework (UI + API)
/automate-from-tms --issue ENG-456 --source linear --test-mgmt xray --tool robot:ui,api

# ADO work item → Playwright, log bugs back to ADO
/automate-from-tms --issue 12345 --source ado --test-mgmt zephyr --tool playwright --bug-tracker ado
```

### Arguments
- `--issue` — ticket ID to find linked test cases (e.g. `QA-42`, `ENG-456`, `42`)
- `--suite` — test suite/folder name in TMS (e.g. `"Login Tests"`)
- `--case` — comma-separated TC IDs (e.g. `TC-1-01,TC-1-03`) — most granular
- `--source` — issue tracker for bug logging (default: `github`)
- `--test-mgmt` — where to read TCs from: `testRail` | `xray` | `zephyr` | `markdown` (default: `markdown`)
- `--tool` — automation framework(s) to use (default: `playwright`)
- `--bug-tracker` — where to log bugs (default: same as `--source`)

**Priority of TC selection:** `--case` > `--suite` > `--issue`

---

## Argument Resolution

If neither `--issue`, `--suite`, nor `--case` is provided, ask:
> "Which test cases should I automate? Provide one of:
> - `--issue <id>` to automate all TCs linked to a ticket
> - `--suite <name>` to automate a full suite
> - `--case TC-1-01,TC-1-02` for specific test cases"

**Env var check:**

| TMS | Required vars |
|---|---|
| `testRail` | `TESTRAIL_URL`, `TESTRAIL_USER`, `TESTRAIL_API_KEY` |
| `xray` | `XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET` |
| `zephyr` | `ZEPHYR_BASE_URL`, `ZEPHYR_API_TOKEN` |
| `markdown` | none — reads from `test-cases/` folder |

Print resolved plan:
```
🤖 automate-from-tms
   Reading from:  TestRail — suite "Login Tests"
   Tool:          Playwright (TypeScript)
   Bug tracker:   JIRA
```

---

## STEP 1 — Read Test Cases from TMS

### If --test-mgmt is markdown
Read the file `test-cases/TC-<issueId>-*.md` or match `--suite` / `--case` pattern.
Parse each `## TC-*` section into a structured list.

### If --test-mgmt is testRail
```bash
npx ts-node scripts/read-from-tms.ts \
  --tms testRail \
  --issue <issueId>     # or --suite <name> or --case <ids>
```
Returns structured TC list: ID, title, steps, test data, expected results.

### If --test-mgmt is xray
```bash
npx ts-node scripts/read-from-tms.ts --tms xray --issue <issueId>
```

### If --test-mgmt is zephyr
```bash
npx ts-node scripts/read-from-tms.ts --tms zephyr --issue <issueId>
```

Print what was loaded:
```
📋 Loaded 10 test cases from TestRail — suite "Login Tests"
   Happy Path: 3 | Negative: 4 | API: 2 | Accessibility: 1
```

---

## STEP 2 — Scrape the UI (if UI tool selected)

If any UI tool is in `--tool` (playwright, cypress, selenium, robot:ui, appium):
```bash
npx ts-node scripts/scrape-page.ts <ui-url> --screenshot
```

Extract selectors, test IDs, form fields to inform the automation code.

Skip this step if `--tool` is API-only (restassured, robot:api).

---

## STEP 3 — Generate Automation Code

For each tool in `--tool`, generate code derived directly from the loaded test cases.
Each TC's steps map to automation actions. Each expected result maps to an assertion.

Run all tool agents in parallel.

---

### 3-PLAYWRIGHT
Write `tests/generated/<feature-slug>.spec.ts`.
Map TC steps → Playwright actions. Map expected results → `expect()` assertions.
Group by TC type: Happy Path / Negative / Accessibility.

Validate: `npx playwright test --list tests/generated/<feature-slug>.spec.ts`

---

### 3-CYPRESS
Write `cypress/e2e/generated/<feature-slug>.cy.ts`.
Map TC steps → `cy.*` commands. Map expected results → `cy.should()` assertions.

Validate: `npx cypress run --spec <file> --headless 2>&1 | head -20`

---

### 3-SELENIUM (testng / junit / cucumber)
Write Java test class in `src/test/java/com/swayambhuqa/tests/generated/`.
Map TC steps → WebDriver actions. Map expected results → Assert/assertEquals.
For cucumber: generate `.feature` file from TC titles + steps, then step definitions.

Validate: `mvn test-compile -q 2>&1 | tail -5`

---

### 3-RESTASSURED (testng / junit / cucumber)
Write Java API test in `api-tests/src/test/java/com/swayambhuqa/tests/generated/`.
Map each API TC → a `given().when().then()` chain.
For cucumber: generate `.feature` file with API scenarios.

Validate: `cd api-tests && mvn test-compile -q 2>&1 | tail -5`

---

### 3-APPIUM
Write Java Appium test in `src/test/java/com/swayambhuqa/tests/generated/`.
Ask platform (Android/iOS) if not clear from TCs.
Map TC steps → MobileElement interactions.

Validate: `mvn test-compile -q 2>&1 | tail -5`

---

### 3-ROBOT
Write `tests/robot/generated/<feature-slug>.robot`.
Map TC steps → Robot keywords using appropriate library:
- SeleniumLibrary for UI steps
- RequestsLibrary for API steps
- AppiumLibrary for mobile steps

Validate: `robot --dryrun tests/robot/generated/<feature-slug>.robot 2>&1 | tail -10`

---

## STEP 4 — Run the Tests

Run all selected tool suites:

**Playwright:**
```bash
npx playwright test tests/generated/<feature-slug>.spec.ts --project=chromium --reporter=json
```

**Cypress:**
```bash
npx cypress run --spec cypress/e2e/generated/<feature-slug>.cy.ts --headless
```

**Selenium / REST Assured / Appium:**
```bash
mvn test -Dtest=<ClassName> -q 2>&1 | tail -20
```

**Robot:**
```bash
robot --outputdir reports/robot tests/robot/generated/<feature-slug>.robot
```

Collect: passed, failed, flaky per tool.

---

## STEP 5 — Analyze and Heal Failures

For each failing test:
1. Classify: selector / timing / data / logic / real bug
2. Auto-fix selector and timing issues → re-run to verify
3. Flag logic mismatches for human review
4. Escalate real bugs to Step 6

---

## STEP 6 — Log Bugs

For each confirmed bug, log to `--bug-tracker` (defaults to `--source`):

**GitHub:** `gh issue create --label "bug" ...`
**JIRA/ADO/Linear:** `npx ts-node scripts/create-bug.ts --source <tracker> ...`

Include in each bug:
- Which TC failed
- Which tool caught it
- Error message + stack trace
- Steps to reproduce (from TC steps)

---

## STEP 7 — Update Test Status in TMS

Mark each TC with its execution result back in the TMS:

```bash
npx ts-node scripts/update-tms-status.ts \
  --tms <testRail|xray|zephyr|markdown> \
  --results reports/results.json
```

| TC Result | TMS Status |
|---|---|
| Passed | Passed ✅ |
| Failed (bug logged) | Failed ❌ |
| Failed (test fixed) | Passed ✅ |
| Flaky | Retest ⚠️ |

---

## STEP 8 — Final Summary

```
╔══════════════════════════════════════════════════════════╗
║         swayambhu-qa — Automation Complete               ║
╠══════════════════════════════════════════════════════════╣
║  Test Cases Read    <n> from <TMS>                       ║
║  Tools Used         <tool list>                          ║
╠══════════════════════════════════════════════════════════╣
║  UI Tests           <passed>/<total> ✅  (<tool>)        ║
║  API Tests          <passed>/<total> ✅  (<tool>)        ║
║  Bugs Logged        <n>                                  ║
║  TMS Updated        ✅                                   ║
╚══════════════════════════════════════════════════════════╝
```
