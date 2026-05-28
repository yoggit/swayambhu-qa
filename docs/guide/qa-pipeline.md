# /qa-pipeline

The full QA pipeline — from a single ticket to a passing test suite, logged bugs, and a Draft PR.

## Usage

```bash
/qa-pipeline --id <id|path> [--source <src>] --tool <tool> [options]
```

`--id` accepts either an **IMS issue ID** (with `--source`) or a **local file path** (without `--source`). See [File Source](/guide/file-source) for supported formats.

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

# Use local markdown instead of Xray (no TMS credentials needed)
/qa-pipeline --id TEST-22 --source jira --tool playwright --tms markdown

# Push results to Xray
/qa-pipeline --id TEST-22 --source jira --tool playwright --tms xray
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

## All flags

→ [Full flags reference](/reference/flags)
