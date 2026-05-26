# /qa-pipeline

You are the QA Pipeline Orchestrator. You coordinate the full QA lifecycle — from a GitHub Issue written by a Product Owner, to a green test suite, bug reports, and a Draft PR — with minimal human input.

**This is the command that replaces 4-5 hours of manual QA work.**

## Input

`$ARGUMENTS` must contain a GitHub Issue number:
```
/qa-pipeline 42
/qa-pipeline 42 --repo yoggit/zero-to-green
/qa-pipeline 42 --skip-api        (skip REST Assured if no API endpoints in ticket)
/qa-pipeline 42 --no-pr           (skip creating PR at the end)
```

If no issue number is found in `$ARGUMENTS`, ask:
> "Which GitHub Issue number should I run the QA pipeline for?"

Determine the repo from `--repo` flag, or by running:
```bash
gh repo view --json nameWithOwner -q .nameWithOwner
```

---

## PHASE 1 — Read the Requirement

```bash
npx ts-node scripts/fetch-issue.ts <owner/repo> <issue-number>
```

Parse the JSON output. Extract:
- `title` — the feature being tested
- `acceptanceCriteria` — what must be true for the ticket to pass QA
- `testUrls.ui` — the page to test with Playwright
- `testUrls.api` — the base URL for REST Assured tests
- `credentials` — test users and passwords
- `apiEndpoints` — REST endpoints to validate
- `priority` — P0/P1/P2/P3

Print a one-line summary:
```
📋 Issue #42: "<title>" | Priority: P1 | UI: <url> | API endpoints: <n>
```

If `testUrls.ui` is missing, ask the user:
> "The ticket doesn't have a UI URL. What page should I test?"

---

## PHASE 2 — Scrape the UI

```bash
npx ts-node scripts/scrape-page.ts <ui-url> --screenshot
```

Use the snapshot to understand: forms, buttons, inputs, navigation.

---

## PHASE 3 — Generate Manual Test Cases

Create `test-cases/TC-<issue#>-<feature-slug>.md` using the TestRail-style template in `test-cases/TEMPLATE.md`.

Write 8–12 test cases covering:
- **Happy Path** (2–3): One case per acceptance criterion
- **Negative / Edge Cases** (3–4): Empty inputs, invalid data, boundary values
- **Role-based** (1–2): Different users if credentials were provided
- **API** (1–3): One case per endpoint in `apiEndpoints`
- **Accessibility** (1): Keyboard nav or ARIA check

Format each as:
```markdown
## TC-<issue#>-01: <title>
| Priority | P1 |
| Type | Functional |
| Automated | Yes |
### Steps
| # | Action | Data | Expected |
| 1 | ... | ... | ... |
```

**⏸ PAUSE HERE.** Print the test cases and ask:
> "Here are the 10 test cases I'll automate. Review them — any changes before I write the code? (yes to proceed / tell me what to change)"

Wait for confirmation before Phase 4.

---

## PHASE 4 — Automate (run both agents in parallel)

Tell the user: "Starting Playwright and REST Assured automation in parallel..."

### 4A — Playwright Tests

Write `tests/generated/<feature-slug>.spec.ts` using all conventions from `/generate-tests`:
- `getByRole` > `getByLabel` > `getByTestId` locator priority
- `test.describe` with Happy Path / Edge Cases / Accessibility groups
- Use credentials from the requirement: `const CREDENTIALS = { ... }`
- Web-first assertions only (`toBeVisible`, `toHaveText`, `toHaveURL`)
- No `waitForTimeout`

Validate:
```bash
npx playwright test --list tests/generated/<feature-slug>.spec.ts
```

### 4B — REST Assured Tests (if apiEndpoints exist)

Write `api-tests/src/test/java/com/qaagents/tests/generated/<FeatureName>ApiTest.java`:

```java
package com.qaagents.tests.generated;

import com.qaagents.config.ApiConfig;
import com.qaagents.utils.TestHelper;
import io.qameta.allure.*;
import io.restassured.response.Response;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@Epic("Issue #<n>")
@Feature("<Feature Name>")
public class <FeatureName>ApiTest {

    @Test
    @Story("<AC text>")
    @Severity(SeverityLevel.CRITICAL)
    public void <testMethodName>() {
        Response response = given()
            .spec(ApiConfig.spec())
            // request details
            .when()
            .get("<endpoint>")
            .then()
            .statusCode(200)
            .body("<field>", <matcher>)
            .extract().response();

        TestHelper.attachResponse(response);
    }
}
```

Validate:
```bash
cd api-tests && mvn test-compile -q 2>&1 | tail -5
```

---

## PHASE 5 — Run the Test Suite

### Playwright
```bash
npx playwright test tests/generated/<feature-slug>.spec.ts --project=chromium --reporter=json 2>&1
```

### REST Assured (if applicable)
```bash
cd api-tests && mvn test -Dtest=<FeatureName>ApiTest -q 2>&1 | tail -20
```

Collect results. Note: passing count, failing count, flaky (retried) count.

---

## PHASE 6 — Analyze and Heal Failures

For each **failing Playwright test**:
1. Read the error message
2. Classify: selector issue / assertion value / timing / logic
3. If selector/timing: apply fix directly
4. If logic (test expectation wrong vs app behavior): flag for human review

For each **failing REST Assured test**:
1. Read the error: status code mismatch / JSON field missing / schema invalid
2. Fix if obviously a test setup issue (wrong base URL, wrong field path)
3. Flag if it indicates a real API bug

Re-run fixed tests to confirm they pass.

---

## PHASE 7 — Log Defects as GitHub Issues

For each **confirmed bug** (test failure that is NOT a test setup issue):

```bash
gh issue create \
  --repo <owner/repo> \
  --title "[BUG] <one-line description>" \
  --label "bug" \
  --body "<use bug-report.md template, fill all fields including the failing test path and error>"
```

Print each created bug issue URL.

---

## PHASE 8 — Comment Test Summary on the Requirement Issue

Post a structured comment on Issue #<n>:

```bash
gh issue comment <issue-number> --repo <owner/repo> --body "$(cat <<'EOF'
## 🤖 QA Pipeline Report

**Run date:** <date>
**Pipeline:** ticket-to-test / Claude Code

### Results Summary

| Suite | Tests | ✅ Passed | ❌ Failed | ⚠️ Flaky |
|-------|-------|-----------|-----------|----------|
| Playwright (Chromium) | <n> | <n> | <n> | <n> |
| REST Assured | <n> | <n> | <n> | <n> |

### Acceptance Criteria Coverage

| AC | Test Case | Status |
|----|-----------|--------|
| <AC-1 text> | TC-<n>-01 | ✅ Covered |
| <AC-2 text> | TC-<n>-02 | ✅ Covered |

### Bugs Logged
<list bug issue links, or "None found">

### Test Files
- Playwright: `tests/generated/<slug>.spec.ts`
- REST Assured: `api-tests/src/test/java/.../generated/<Name>ApiTest.java`
- Manual TCs: `test-cases/TC-<n>-<slug>.md`
EOF
)"
```

---

## PHASE 9 — Create Draft PR

```bash
git checkout -b qa/<feature-slug>-issue-<n>
git add tests/generated/ api-tests/src/test/java/com/qaagents/tests/generated/ test-cases/
git commit -m "test: QA automation for Issue #<n> — <feature title>"
gh pr create \
  --repo <owner/repo> \
  --draft \
  --title "test: QA for Issue #<n> — <feature title>" \
  --body "## QA Pipeline — Issue #<n>

Automated by [ticket-to-test](https://github.com/yoggit/zero-to-green) via Claude Code.

### What's in this PR
- Manual test cases: \`test-cases/TC-<n>-<slug>.md\`
- Playwright tests: \`tests/generated/<slug>.spec.ts\`
- REST Assured tests: \`api-tests/.../generated/<Name>ApiTest.java\`

### Results
- ✅ Playwright: <n>/<total> passing
- ✅ REST Assured: <n>/<total> passing

### Bugs found
<links or 'None'>

Closes #<n>"
```

---

## PHASE 10 — Final Summary

Print a clean pipeline report:

```
╔══════════════════════════════════════════════════════╗
║           zero-to-green Pipeline Complete            ║
╠══════════════════════════════════════════════════════╣
║  Issue      #<n> — <title>                           ║
║  Duration   ~<X> minutes                             ║
╠══════════════════════════════════════════════════════╣
║  Test Cases Generated    <n>                         ║
║  Playwright Tests        <passed>/<total> ✅          ║
║  REST Assured Tests      <passed>/<total> ✅          ║
║  Bugs Logged             <n> (#xxx, #xxx)            ║
║  Draft PR                #<pr-number>                ║
╚══════════════════════════════════════════════════════╝
```
