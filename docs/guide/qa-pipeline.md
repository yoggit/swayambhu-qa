# /qa-pipeline

The full QA pipeline — from a single ticket to a passing test suite, logged bugs, and a Draft PR.

## Usage

```bash
/qa-pipeline --id <id|path> [--source <src>] --tool <tool> [options]
```

`--id` accepts either an **IMS issue ID** (with `--source`) or a **local file path** (without `--source`). See [File Source](/guide/file-source) for supported formats.

::: tip All command combinations
Every `--tool`, `--source`, and `--tms` option in one place → [Command Combinations](/reference/commands)
:::

## Common examples

```bash
# From a local file — no IMS or credentials needed
/qa-pipeline --id "./story.md" --tool playwright
/qa-pipeline --id "requirements/login-feature.docx" --tool playwright,restassured

# JIRA + Playwright only
/qa-pipeline --id TEST-22 --source jira --tool playwright

# JIRA + Playwright + REST Assured (UI + API together)
/qa-pipeline --id QA-42 --source jira --tool playwright,restassured

# GitHub Issue + Playwright
/qa-pipeline --id 42 --source github --repo myorg/myrepo

# Skip PR creation
/qa-pipeline --id TEST-22 --source jira --tool playwright --no-pr

# Use local markdown (no TMS credentials needed)
/qa-pipeline --id TEST-22 --source jira --tool playwright --tms markdown

# Push results to Xray
/qa-pipeline --id TEST-22 --source jira --tool playwright --tms xray

# Push results to TestRail
/qa-pipeline --id TEST-22 --source jira --tool playwright --tms testRail
```

## Multi-run — multiple tickets or files in one command

`--id` accepts a comma-separated list of issue IDs and/or file paths. Each item runs the full pipeline (Phases 1–9) sequentially, with a 5-second cooldown between items. A combined summary is printed at the end.

```bash
# Two JIRA tickets, back-to-back
/qa-pipeline --id "TEST-22,TEST-62" --source jira --tool playwright

# Mixed: two tickets + one local file (no credentials needed for the file)
/qa-pipeline --id "TEST-22,TEST-62,./docs/extra-feature.md" --source jira --tool playwright

# Three local files — no IMS at all
/qa-pipeline --id "./feature-a.md,./feature-b.md,./feature-c.txt" --tool playwright
```

If one item fails (ticket not found, file missing), it is marked ❌ and the next item starts automatically.

## Phases

| Phase | UI tools (Playwright, Cypress, Selenium…) | API tools (REST Assured, Robot API…) |
|---|---|---|
| **1** | Fetch ticket — requirement, ACs, test URLs | ← same |
| **2** | Scrape live app for DOM selectors & form fields | Read API URL, Swagger / OpenAPI docs from ticket |
| **3** | Generate test cases → push to TMS → **human review pause** | ← same |
| **4** | Write UI specs using scraped selectors | Write API specs using endpoint definitions |
| **5** | Run specs | ← same |
| **6** | Heal broken selectors and timing issues | Heal auth errors, base URL drift, schema mismatches |
| **7** | Log confirmed bugs to issue tracker | ← same |
| **8** | Push results to TMS → create Test Execution | ← same |
| **9** | Open Draft PR with generated test files | ← same |

When both UI + API tools are selected (`--tool playwright,restassured`), Phases 2, 4, and 6 run in both tracks simultaneously.

## Human review pause (Phase 3)

After generating test cases, the pipeline pauses and shows you the full TC table. You can approve or give plain-English instructions before any code is written:

```
yes                                            → approve and continue
Remove the accessibility test case             → removes it, re-generates
Add a test case for negative amount entry      → adds it, re-generates
TC-TEST22-03 should be an Edge case            → changes type, re-generates
Focus only on Happy Path test cases            → narrows scope, re-generates
```

## Re-run behavior

If `tc-mapping-<issueId>.json` already exists (TCs were pushed to TMS on a previous run), the pipeline detects this and asks:

> Re-run tests against existing TCs, or regenerate everything from scratch?

Choose **Re-run** to skip Phases 1–3 and go straight to running the existing specs.

## Zero Setup Mode

If you run `/qa-pipeline` without `--id`, the pipeline doesn't error — it creates a sample feature file for you to start with. Works with any supported `--tool`.

```bash
/qa-pipeline --tool playwright
/qa-pipeline --tool cypress
/qa-pipeline --tool selenium
/qa-pipeline --tool restassured
/qa-pipeline --tool robot:ui
```

What happens:

1. A file `./sample-feature.txt` is written in your project with a User Login feature — 5 acceptance criteria, a UI URL, an API URL, and 3 endpoints.
2. The pipeline shows you what was created and pauses:

```
📄 No --id provided — I've created a sample feature file to get you started:

   ./sample-feature.txt

   It describes a User Login feature with 5 acceptance criteria, UI and API endpoints.
   This is the same format you can use for any real feature.

   ➡️  To proceed with this sample, reply: yes
   ✏️  To use your own feature instead:
       1. Edit or replace ./sample-feature.txt (or create any .md / .txt file)
       2. Reply with the file path, e.g: ./my-feature.txt
```

3. Reply `yes` to run with the sample, or give a file path to use your own.

This is useful for trying out the pipeline on a fresh project before wiring up JIRA or GitHub.

## Project Scaffolding

If you open an empty folder (no `package.json`, no `pom.xml`, no test framework installed) and run `/qa-pipeline`, the pipeline detects this and sets up the project for you before doing anything else.

What gets generated depends on `--tool`:

| Tool | Files created | Install run |
|---|---|---|
| `playwright` | `package.json`, `playwright.config.ts` | `npm install && npx playwright install --with-deps chromium` |
| `cypress` | `package.json`, `cypress.config.ts` | `npm install` |
| `selenium`, `restassured` | `pom.xml` (with all dependencies pre-wired) | `mvn test-compile -q` |
| `robot:ui`, `robot:api` | `requirements.txt` | `pip install -r requirements.txt -q` |

In all cases, the pipeline also creates `reports/`, `test-cases/`, and the generated test output folder.

After scaffolding completes, the pipeline continues from Phase 1 — no manual setup needed.

## All flags

→ [Full flags reference](/reference/flags)
