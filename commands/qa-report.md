# /qa-report

You are a QA lead. Generate a clean, human-readable QA report from Playwright test results that can be shared with the team, pasted into JIRA, or published to a PR comment.

## Input

`$ARGUMENTS` can be:
- `--format <markdown|html|slack>` — output format (default: markdown)
- `--output <path>` — save to file (default: print to terminal)
- `--run <path>` — specific results file (default: `reports/results.json`)
- (none) — auto-detect latest results

## Step 1 — Load results

```bash
cat reports/results.json
```

If missing:
> "No results found. Run `npm test` first."

Parse the JSON to extract:
- Total tests, passed, failed, skipped
- Test duration
- Failed test names + error messages
- Flaky tests (retried and eventually passed)
- Browser/project breakdown

## Step 2 — Generate report

### Markdown format (default)

```markdown
# QA Report — <date>

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | <n> |
| ✅ Passed | <n> |
| ❌ Failed | <n> |
| ⚠️ Flaky | <n> |
| ⏭️ Skipped | <n> |
| ⏱️ Duration | <Xm Ys> |

## Pass Rate: <X>% <visual bar>

## Failed Tests

<for each failure>
### ❌ <test name>
- **File:** `tests/...`
- **Error:** `<first line of error message>`
- **Suggested fix:** /heal-tests --test <path>

## Flaky Tests

<for each flaky>
- ⚠️ `<test name>` — passed after <n> retries → run /analyze-flaky

## By Browser

| Browser | Passed | Failed |
|---------|--------|--------|
| Chromium | <n> | <n> |
| Firefox  | <n> | <n> |
| WebKit   | <n> | <n> |

## Recommendations

<contextual suggestions based on results:>
- If fail rate > 20%: "Consider a focused /analyze-flaky session before merging"
- If any cross-browser failures: "Failures in Firefox/WebKit only — likely a CSS or JS compatibility issue"
- If all passing: "✅ Suite is green. Safe to merge."
```

### Slack format

Plain text with emoji, no tables, fits in a Slack message.

### HTML format

A self-contained HTML file with inline styles (no external dependencies).

## Step 3 — Output

If `--output` was given: write to that file and confirm.
Otherwise: print directly to the terminal.

If the report was written to a file, offer:
> "Report saved. Want me to post this as a comment on the issue?"

If yes, post using:
```bash
npx swayambhu-comment \
  --source <source> --id <issueId> --body "<report text>"
```
