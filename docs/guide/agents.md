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
/qa-pipeline --id TEST-22 --source jira --tool playwright --tms xray
/qa-pipeline --id QA-42 --source jira --tool playwright,restassured
/qa-pipeline --id 42 --repo myorg/myrepo --no-pr
```

→ [Full reference](/guide/qa-pipeline)

---

### `/create-test-cases`

Reads a ticket and generates test case documents only — no automation code written. Good for teams that review TCs in Xray before writing any automation.

```bash
/create-test-cases --id TEST-22 --source jira --tms xray
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
/automate-from-tms --id QA-42 --source jira --test-mgmt xray --tool playwright
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
/bug-to-test --id BUG-123 --source jira
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
/qa-report --id TEST-22 --source jira
```

→ [Full reference](/guide/qa-report)

---

## Multi-run mode

Four agents support running against multiple issues or files in a single command. The others don't — here's why.

### Which agents support multi-run

| Agent | Multi-run? | Example |
|---|---|---|
| `/qa-pipeline` | ✅ Yes | `--id TEST-22,TEST-62` |
| `/create-test-cases` | ✅ Yes | `QA-42,QA-43,./local-spec.txt` |
| `/automate-from-tms` | ✅ Yes | `--id QA-42,QA-43,./test-cases/TC-login.md` |
| `/bug-to-test` | ✅ Yes | `--jira BUG-101,BUG-102 --file ./bug3.txt` |
| `/heal-tests` | ❌ No | — |
| `/analyze-flaky` | ❌ No | — |
| `/generate-tests` | ❌ No | — |
| `/qa-report` | ❌ No | — |

### Why only these four?

**`/qa-pipeline`, `/create-test-cases`, `/automate-from-tms`, `/bug-to-test`** all share the same input model: they take an **issue ID or file path** as their primary input. Repeating that input is a natural and common need — a QA lead wants to automate three tickets at once, or a team has a batch of bug reports to convert to regression tests. Multi-run is simply "run the same agent N times, sequentially, with results collected."

The other agents have a fundamentally different input model:

- **`/heal-tests`** — takes a **failing spec file**, not an issue ID. It already handles every failing test within that spec in one run. Running it across multiple spec files is handled by the agent naturally, not by a separate multi-run loop.

- **`/analyze-flaky`** — takes a **test results JSON**. Flakiness analysis is cross-run by design: the agent reads multiple execution histories from one results file and reasons across all of them. There is no meaningful "batch" version — you aggregate results first, then analyze.

- **`/generate-tests`** — takes a **live URL**. Multi-URL support is possible but rarely needed: you'd normally produce one focused spec per URL. For multiple pages, call the agent once per URL.

- **`/qa-report`** — aggregates test results into one report. Reports are already a many-to-one operation — one report covers all tests in a run. Running the reporter twice against different inputs would produce two separate reports, not a combined one.

### How multi-run works

All four agents run sequentially with a 5-second cooldown between items:

```
🗂️  Multi-run — 3 items queued: QA-42, QA-43, ./local-spec.txt
    Processing sequentially (5s cooldown between items).

--- Item 1 of 3: QA-42 ---
[... full agent run ...]
✅ QA-42 complete. Starting next in 5 seconds...

--- Item 2 of 3: QA-43 ---
[... full agent run ...]
✅ QA-43 complete. Starting next in 5 seconds...
```

If one item fails (ticket not found, file missing), it is marked ❌ and the agent continues with the next. A combined summary is printed after all items complete.

### Mixed mode — ticket IDs + file paths in one command

All four agents accept a mix of issue IDs and local file paths in the same command. File paths are detected automatically by prefix (`./`, `/`) or extension (`.md`, `.txt`, `.docx`, `.doc`, `.pdf`). No IMS credentials are required for file entries.

```bash
# Two JIRA tickets + one local spec file
/qa-pipeline --id "TEST-22,TEST-62,./docs/my-feature.md" --source jira --tool playwright

# JIRA ticket + local file (no credentials needed for the file entry)
/create-test-cases "QA-42,./local-spec.txt" --source jira

# Ticket + local TC markdown file
/automate-from-tms --id "QA-42,./test-cases/TC-login.md" --source jira --test-mgmt xray --tool playwright

# JIRA bug + local bug report file
/bug-to-test --jira BUG-101 --file "./bugs/manual-bug.txt"
```

---

::: tip All command combinations
Every agent, every `--tool`, `--source`, and `--tms` option in one place → [Command Combinations](/reference/commands)
:::
