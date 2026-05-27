# Your First Pipeline Run

This page walks through a complete pipeline run — what each phase does and what to expect.

## Example command

```bash
/qa-pipeline --id TEST-22 --source jira --tool playwright --tms xray
```

## Phase 1 — Fetch the ticket

The pipeline reads your JIRA issue and extracts:
- Title and description
- Acceptance criteria
- `Test URL:` and `API URL:` lines (if present)

If neither a `Test URL:` line nor a `BASE_URL` in `.env` is found, the pipeline asks you for the URL before continuing.

## Phase 2 — Scrape the app

The scraper visits the test URL, captures the DOM structure, identifies:
- Form fields, labels, placeholders
- Buttons and CTAs
- Navigation elements
- Any `data-testid` attributes

This snapshot informs the test selectors that will be generated.

## Phase 3 — Generate test cases

Based on the acceptance criteria and scraped app structure, the pipeline generates test cases:
- Happy path scenarios
- Negative / edge cases
- Accessibility checks

**Human review pause:** Before pushing to Xray, the pipeline prints the full TC table and waits. You can:
- Type `yes` to approve and continue
- Give plain-English instructions to modify ("remove the accessibility TC", "make TC-3 an edge case")

Once approved, TCs are pushed to Xray and get Xray keys (e.g. `TEST-22-01`).

## Phase 4 — Generate automation code

Playwright spec files are written to `tests/generated/<slug>.spec.ts`.
TC steps map to Playwright actions. Expected results map to `expect()` assertions.

## Phase 5 — Run the tests

```bash
npx playwright test tests/generated/<slug>.spec.ts --reporter=json
```

Results are written to `reports/results-TEST22.json`.

## Phase 6 — Heal failures

For each failing test, the pipeline classifies the failure:
- **Selector issue** — auto-fixed and re-run
- **Timing issue** — adds appropriate wait and re-run
- **Logic mismatch** — flagged for human review
- **Real app bug** → escalated to Phase 7

## Phase 7 — Log bugs

Confirmed bugs are logged back to JIRA with:
- Which TC failed
- Which tool caught it
- Error message + stack trace
- Steps to reproduce (from TC steps)

## Phase 8 — Update TMS

Each TC's result is pushed back to Xray:
- Passed → ✅
- Failed (bug logged) → ❌
- Failed (test healed) → ✅
- Flaky → ⚠️ Retest

A Test Execution ticket is created in Xray with all results attached.

## Phase 9 — Draft PR

A Draft PR is opened with the generated test files. You review and approve — the pipeline never merges.

## Without a TMS (`--tms markdown`)

If you omit `--tms` (or use `--tms markdown`), no Xray credentials are needed:
- Test cases are written to `test-cases/TC-<issueId>-*.md`
- Results are written to `reports/results-<issueId>.json`
- No external push happens

## Re-runs

If you run the same `--id` again, the pipeline detects that TCs already exist in Xray (`tc-mapping-<issueId>.json` is present) and asks:

> TCs for TEST-22 already exist in Xray. Re-run tests or regenerate everything?

Choose "Re-run tests" to skip Phases 1–3 and go straight to running the existing specs.
