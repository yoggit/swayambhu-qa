# Command Combinations

All agents, all flags, all supported combinations in one place.

## `/qa-pipeline`

Full pipeline: ticket → test cases → automation → heal → bugs → TMS → PR.

### By issue source

```bash
# Local file (no credentials needed)
/qa-pipeline --id "./story.md" --tool playwright
/qa-pipeline --id "./story.txt" --tool restassured
/qa-pipeline --id "./requirements.pdf" --tool cypress

# JIRA
/qa-pipeline --id TEST-22 --source jira --tool playwright
/qa-pipeline --id TEST-22 --source jira --tool playwright,restassured

# GitHub Issues
/qa-pipeline --id 42 --source github --repo myorg/myrepo --tool playwright

# Zero Setup Mode — no --id needed
/qa-pipeline --tool playwright
/qa-pipeline --tool cypress
```

### By test runner

```bash
# Playwright (UI)
/qa-pipeline --id TEST-22 --source jira --tool playwright

# Cypress (UI)
/qa-pipeline --id TEST-22 --source jira --tool cypress

# Selenium — defaults to TestNG
/qa-pipeline --id TEST-22 --source jira --tool selenium
/qa-pipeline --id TEST-22 --source jira --tool selenium:testng
/qa-pipeline --id TEST-22 --source jira --tool selenium:junit
/qa-pipeline --id TEST-22 --source jira --tool selenium:cucumber

# REST Assured (API) — defaults to TestNG
/qa-pipeline --id TEST-22 --source jira --tool restassured
/qa-pipeline --id TEST-22 --source jira --tool restassured:testng
/qa-pipeline --id TEST-22 --source jira --tool restassured:junit
/qa-pipeline --id TEST-22 --source jira --tool restassured:cucumber

# Robot Framework
/qa-pipeline --id TEST-22 --source jira --tool robot
/qa-pipeline --id TEST-22 --source jira --tool robot:ui
/qa-pipeline --id TEST-22 --source jira --tool robot:api
```

### Combined runs (UI + API)

```bash
/qa-pipeline --id TEST-22 --source jira --tool playwright,restassured
/qa-pipeline --id TEST-22 --source jira --tool cypress,restassured
/qa-pipeline --id TEST-22 --source jira --tool selenium,restassured
/qa-pipeline --id TEST-22 --source jira --tool robot:ui,robot:api
/qa-pipeline --id TEST-22 --source jira --tool selenium:cucumber,restassured:cucumber
```

### By TMS

```bash
# Markdown mode (default — no TMS credentials needed)
/qa-pipeline --id TEST-22 --source jira --tool playwright

# Xray (JIRA plugin)
/qa-pipeline --id TEST-22 --source jira --tool playwright --tms xray
```

### Multi-issue runs

```bash
/qa-pipeline --id "TEST-22,TEST-62" --source jira --tool playwright
/qa-pipeline --id "./story1.md,./story2.md" --tool cypress
```

### Skip PR

```bash
/qa-pipeline --id TEST-22 --source jira --tool playwright --no-pr
```

---

## `/create-test-cases`

Generate and push test cases only — no automation.

```bash
# From JIRA
/create-test-cases --id TEST-22 --source jira

# From GitHub
/create-test-cases --id 42 --source github --repo myorg/myrepo

# From local file
/create-test-cases --id "./story.md"

# Push to Xray
/create-test-cases --id TEST-22 --source jira --tms xray

# Specify tool (affects TC format)
/create-test-cases --id TEST-22 --source jira --tool playwright
/create-test-cases --id TEST-22 --source jira --tool restassured
/create-test-cases --id TEST-22 --source jira --tool cypress
/create-test-cases --id TEST-22 --source jira --tool selenium
/create-test-cases --id TEST-22 --source jira --tool robot:ui
```

---

## `/automate-from-tms`

Read existing test cases from TMS → generate automation → run → heal → log bugs.

### By TC selection

```bash
# By issue — automates all TCs linked to an issue
/automate-from-tms --id TEST-22 --tool playwright

# By suite name
/automate-from-tms --suite "Login Tests" --tool playwright

# By specific TC IDs (most granular)
/automate-from-tms --case "TC-22-1,TC-22-2" --tool playwright
```

### By test runner

```bash
/automate-from-tms --id TEST-22 --tool playwright
/automate-from-tms --id TEST-22 --tool cypress
/automate-from-tms --id TEST-22 --tool selenium
/automate-from-tms --id TEST-22 --tool selenium:testng
/automate-from-tms --id TEST-22 --tool selenium:junit
/automate-from-tms --id TEST-22 --tool selenium:cucumber
/automate-from-tms --id TEST-22 --tool restassured
/automate-from-tms --id TEST-22 --tool restassured:testng
/automate-from-tms --id TEST-22 --tool restassured:junit
/automate-from-tms --id TEST-22 --tool restassured:cucumber
/automate-from-tms --id TEST-22 --tool robot:ui
/automate-from-tms --id TEST-22 --tool robot:api
/automate-from-tms --id TEST-22 --tool playwright,restassured
```

### By TMS source

```bash
# Markdown (default — reads from test-cases/ folder)
/automate-from-tms --id TEST-22 --tool playwright

# Xray
/automate-from-tms --id TEST-22 --test-mgmt xray --tool playwright
```

---

## `/generate-tests`

Generate a spec directly from a URL or API spec — no ticket needed.

```bash
# From a UI URL
/generate-tests --url https://example.com/login --tool playwright
/generate-tests --url https://example.com/login --tool cypress
/generate-tests --url https://example.com/login --tool selenium
/generate-tests --url https://example.com/login --tool robot:ui

# From an API spec / Swagger URL
/generate-tests --url https://api.example.com/docs --tool restassured
/generate-tests --url https://api.example.com/docs --tool restassured:cucumber
/generate-tests --url https://api.example.com/docs --tool robot:api

# Combined
/generate-tests --url https://example.com/login --api-url https://api.example.com/docs --tool playwright,restassured
```

---

## `/heal-tests`

Auto-fix broken selectors, timing issues, auth errors.

```bash
# Heal the last run's failures
/heal-tests

# Heal for a specific issue
/heal-tests --id TEST-22

# Specify runner (if project uses multiple)
/heal-tests --id TEST-22 --tool playwright
/heal-tests --id TEST-22 --tool cypress
/heal-tests --id TEST-22 --tool selenium
/heal-tests --id TEST-22 --tool restassured
/heal-tests --id TEST-22 --tool robot:ui
```

---

## `/bug-to-test`

Turn a confirmed bug into a regression test.

```bash
# From a JIRA bug
/bug-to-test --id BUG-99 --source jira --tool playwright
/bug-to-test --id BUG-99 --source jira --tool cypress
/bug-to-test --id BUG-99 --source jira --tool selenium
/bug-to-test --id BUG-99 --source jira --tool restassured
/bug-to-test --id BUG-99 --source jira --tool robot:ui

# From GitHub
/bug-to-test --id 101 --source github --repo myorg/myrepo --tool playwright

# From a local bug description
/bug-to-test --id "./bug-report.md" --tool playwright
```

---

## `/analyze-flaky`

Classify flaky tests from results — what's truly flaky vs real failures.

```bash
# Analyze last run
/analyze-flaky

# Analyze for a specific issue
/analyze-flaky --id TEST-22

# Specify runner
/analyze-flaky --id TEST-22 --tool playwright
/analyze-flaky --id TEST-22 --tool cypress
/analyze-flaky --id TEST-22 --tool selenium
/analyze-flaky --id TEST-22 --tool restassured
/analyze-flaky --id TEST-22 --tool robot:ui
```

---

## `/qa-report`

Generate a shareable QA summary and post it to JIRA.

```bash
# Report for an issue
/qa-report --id TEST-22 --source jira

# From GitHub
/qa-report --id 42 --source github --repo myorg/myrepo

# Without posting — local markdown only
/qa-report --id TEST-22 --no-post
```

---

## Flag Quick Reference

| Flag | Agents | Supported values |
|---|---|---|
| `--id` | All | Issue ID, file path, comma-separated mix |
| `--source` | All | `jira` ✅, `github` ✅, `ado` ✅, `linear` ✅ |
| `--repo` | All | `owner/repo` — required with `--source github` |
| `--tool` | `qa-pipeline`, `create-test-cases`, `automate-from-tms`, `generate-tests`, `heal-tests`, `bug-to-test`, `analyze-flaky` | See table below |
| `--tms` | `qa-pipeline`, `create-test-cases` | `xray` ✅, `markdown` ✅, `testrail` ✅ |
| `--test-mgmt` | `automate-from-tms` | `xray` ✅, `markdown` ✅ |
| `--url` | `generate-tests` | Any UI URL |
| `--api-url` | `generate-tests`, `qa-pipeline` | Any API / Swagger URL |
| `--suite` | `automate-from-tms` | Suite name string |
| `--case` | `automate-from-tms` | Comma-separated TC IDs |
| `--no-pr` | `qa-pipeline` | Flag only — skips Draft PR phase |
| `--no-post` | `qa-report` | Flag only — skips posting to JIRA |

## `--tool` values

| Value | Type | Runner | Status |
|---|---|---|---|
| `playwright` | UI | Playwright + TypeScript | ✅ |
| `cypress` | UI | Cypress + TypeScript | ✅ |
| `selenium` | UI | Selenium + TestNG (default) | ✅ |
| `selenium:testng` | UI | Selenium + TestNG | ✅ |
| `selenium:junit` | UI | Selenium + JUnit 5 | ✅ |
| `selenium:cucumber` | UI | Selenium + Cucumber (BDD) | ✅ |
| `restassured` | API | REST Assured + TestNG (default) | ✅ |
| `restassured:testng` | API | REST Assured + TestNG | ✅ |
| `restassured:junit` | API | REST Assured + JUnit 5 | ✅ |
| `restassured:cucumber` | API | REST Assured + Cucumber (BDD) | ✅ |
| `robot` | UI | Robot Framework + SeleniumLibrary | ✅ (defaults to `robot:ui`) |
| `robot:ui` | UI | Robot Framework + SeleniumLibrary | ✅ |
| `robot:api` | API | Robot Framework + RequestsLibrary | ✅ |
