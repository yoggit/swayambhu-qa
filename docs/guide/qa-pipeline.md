# /qa-pipeline

The full QA pipeline — from a single ticket to a passing test suite, logged bugs, and a Draft PR.

## Usage

```bash
/qa-pipeline --issue <id> --source <src> --tool <tool> [options]
```

## Required flags

| Flag | Description |
|---|---|
| `--issue <id>` | Issue ID — e.g. `TEST-22`, `42`, `ENG-456` |

## Common examples

```bash
# JIRA + Playwright only
/qa-pipeline --issue TEST-22 --source jira --tool playwright

# JIRA + Playwright + REST Assured (UI + API together)
/qa-pipeline --issue QA-42 --source jira --tool playwright,restassured

# GitHub Issue + Playwright (no --source needed)
/qa-pipeline --issue 42 --repo myorg/myrepo

# Skip PR creation
/qa-pipeline --issue TEST-22 --source jira --tool playwright --no-pr

# Use local markdown instead of Xray (no TMS credentials needed)
/qa-pipeline --issue TEST-22 --source jira --tool playwright --tms markdown

# Push results to Xray
/qa-pipeline --issue TEST-22 --source jira --tool playwright --tms xray
```

## Phases

| Phase | What happens |
|---|---|
| 1 | Fetch ticket from issue tracker |
| 2 | Scrape app URL for selectors and structure |
| 3 | Generate test cases → push to TMS (or write locally) → **human review pause** |
| 4 | Generate automation code (Playwright / REST Assured) |
| 5 | Run tests |
| 6 | Heal failures (selector drift, timing) |
| 7 | Log confirmed bugs to issue tracker |
| 8 | Push results to TMS → create Test Execution ticket |
| 9 | Open Draft PR |

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
