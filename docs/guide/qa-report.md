# /qa-report

Generates a structured QA report from test results — suitable for posting to JIRA, sharing in a PR comment, or presenting to stakeholders.

## Usage

```bash
/qa-report [--id <id>] [--source <src>]
```

::: tip All command combinations
Every `--source` and `--no-post` option in one place → [Command Combinations](/reference/commands)
:::

## Examples

```bash
# Generate report and post to JIRA issue
/qa-report --id TEST-22 --source jira

# Generate report only (no post)
/qa-report
```

## What it does

1. Reads `reports/results-<issueId>.json`
2. Generates a formatted QA summary:
   - Total tests: passed / failed / healed / skipped
   - Bug count logged
   - Flaky test count
   - Coverage by test type (Happy Path, Negative, Edge, Accessibility)
3. Asks you whether to post the report as a comment on the original ticket
4. If confirmed, posts via `comment-issue.js --body "..."`

## Report format

```
📊 QA Summary — TEST-22
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tests       9/9 passed ✅
Bugs        0 logged
Healed      2 (selector + timing)
Flaky       0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Happy Path  3/3 ✅
Negative    4/4 ✅
Edge        1/1 ✅
A11y        1/1 ✅
```
