# All Agents Overview

swayambhu-qa ships 8 agents. Each handles a specific job in the QA lifecycle. Use the full pipeline for end-to-end runs, or call individual agents when you need just one step.

## When to use which agent

| Agent | Starts from | Use when |
|---|---|---|
| `/qa-pipeline` | Requirement ticket | Full run — ticket → TCs → automation → results → PR |
| `/create-test-cases` | Requirement ticket | QA lead wants to write & review TCs before automating |
| `/generate-tests` | A live URL | Quick automation from any URL — no ticket or TCs needed |
| `/automate-from-tms` | Existing TCs in TMS | TCs are already in Xray/TestRail — just need automation code |
| `/heal-tests` | Failing spec file | Tests broke after a UI change — fix selectors automatically |
| `/bug-to-test` | Bug report | Turn a confirmed bug into a regression test |
| `/analyze-flaky` | Test results JSON | Identify which tests are flaky and why |
| `/qa-report` | Test results JSON | Generate a shareable report to post or present |

## Agent details

### `/qa-pipeline`

The full orchestrator. Runs all phases from ticket fetch to Draft PR.

```bash
/qa-pipeline --issue TEST-22 --source jira --tool playwright --tms xray
/qa-pipeline --issue QA-42 --source jira --tool playwright,restassured
/qa-pipeline --issue 42 --repo myorg/myrepo --no-pr
```

→ [Full reference](/guide/qa-pipeline)

---

### `/create-test-cases`

Reads a ticket and generates test case documents only — no automation code written. Good for teams that review TCs in Xray before writing any automation.

```bash
/create-test-cases --issue TEST-22 --source jira --tms xray
```

After TCs are approved in Xray, run `/automate-from-tms` to generate the code.

→ [Full reference](/guide/create-test-cases)

---

### `/generate-tests`

Takes a live URL, scrapes the page, and writes a Playwright spec file directly — no ticket or TCs needed.

```bash
/generate-tests https://myapp.com/login
/generate-tests https://myapp.com/checkout --screenshot
```

→ [Full reference](/guide/generate-tests)

---

### `/automate-from-tms`

Reads existing test cases from your TMS (Xray, TestRail, Zephyr, or local markdown files) and generates automation code, runs it, heals failures, and logs bugs.

```bash
/automate-from-tms --issue QA-42 --source jira --test-mgmt xray --tool playwright
/automate-from-tms --suite "Login Tests" --test-mgmt testRail --tool playwright,restassured
/automate-from-tms --case TC-1-01,TC-1-03 --test-mgmt markdown --tool playwright
```

→ [Full reference](/guide/automate-from-tms)

---

### `/heal-tests`

Auto-fixes broken selectors and timing issues in a failing spec file. Skips failures that are real app bugs (those get escalated to bug reports).

```bash
/heal-tests tests/generated/login.spec.ts
```

→ [Full reference](/guide/heal-tests)

---

### `/bug-to-test`

Takes a bug report (issue ID or description) and writes a regression test that fails on the bug and passes after it's fixed.

```bash
/bug-to-test --issue BUG-123 --source jira
```

→ [Full reference](/guide/bug-to-test)

---

### `/analyze-flaky`

Reads test results across multiple runs and identifies flaky tests, their failure rate, and the likely cause.

```bash
/analyze-flaky reports/results-TEST22.json
```

→ [Full reference](/guide/analyze-flaky)

---

### `/qa-report`

Generates a structured QA report from test results — suitable for posting to JIRA, Slack, or a PR comment.

```bash
/qa-report --issue TEST-22 --source jira
```

→ [Full reference](/guide/qa-report)
