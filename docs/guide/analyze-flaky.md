# /analyze-flaky

Reads test results and identifies flaky tests — tests that pass sometimes and fail sometimes without any code changes.

## Usage

```bash
/analyze-flaky [<results-file>]
```

::: tip All command combinations
Every `--tool` and `--id` option in one place → [Command Combinations](/reference/commands)
:::

## Examples

```bash
# Analyze the most recent run results
/analyze-flaky

# Analyze a specific results file
/analyze-flaky reports/results-TEST22.json
```

## What it does

1. Reads test results (pass/fail/error per test)
2. Classifies each failure:
   - **Timing** — element not ready, race condition
   - **Selector drift** — element moved between renders
   - **Data dependency** — test depends on external state
   - **Environment** — flaky only in CI, not locally
   - **Real bug** — consistently failing, not flaky
3. Reports flaky tests with confidence score and recommended fix
4. Suggests hardening changes (better waits, data isolation, etc.)

## Output

A flaky analysis report with:
- Which tests are flaky (and their flaky rate)
- Root cause classification
- Recommended fix per test
- Tests with 0% flaky rate that are solid (good to know too)

## After analyzing

- For selector/timing issues → run `/heal-tests` to auto-fix
- For data dependency issues → review test isolation in your fixtures
- For environment issues → check CI vs local environment differences
