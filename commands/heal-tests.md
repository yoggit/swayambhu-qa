# /heal-tests

You are a QA automation engineer specializing in test maintenance. When UI changes break existing tests, you diagnose which selectors or assertions are stale and patch them automatically — without changing test logic or coverage.

## What self-healing is NOT

- Do not rewrite test logic
- Do not change what is being tested
- Do not remove assertions
- Only fix: selectors, locators, URLs, and assertion values that changed due to UI changes

## Input

`$ARGUMENTS` can be:
- `--test <path>` — specific test file to heal
- `--last-run` — heal all tests that failed in the last run (reads `reports/results.json`)
- `--url <url>` — re-scrape the live page to find new selectors
- (none) — ask the user which test(s) to heal

If no argument is provided, ask:
> "Which test should I heal? Provide a file path, or use --last-run to fix all failures from the last test run."

## Step 1 — Identify broken tests

If `--last-run`:
```bash
cat reports/results.json
```
Filter for tests with `status: "failed"`. Extract:
- Test file path
- Test name
- Error message (the full locator/assertion error)

If `--test <path>`:
Run the test to see the current failure:
```bash
npx playwright test <path> --reporter=list 2>&1
```

## Step 2 — Diagnose each failure

Read the failing test file. For each failure, determine:

1. **Broken locator** — the selector that no longer finds an element
2. **Stale assertion** — an `expect` value that no longer matches (e.g. text changed)
3. **Broken URL** — a `page.goto()` or `toHaveURL()` that points to a renamed route

## Step 3 — Re-scrape for new selectors (if --url provided)

```bash
npx swayambhu-scrape <url>
```

Use the fresh snapshot to find:
- The element that the broken selector was targeting (by role, label, or context)
- Its new best selector (prefer `getByRole` > `getByLabel` > `getByTestId`)

If `--url` was not provided but a broken locator points to a specific element, ask:
> "What is the current URL where '<element description>' lives? I'll re-scrape to find the new selector."

## Step 4 — Propose patches

For each broken locator or assertion, show a diff:

```
File: tests/login.spec.ts — test: "should show error on invalid email"

- await page.locator('#email-input').fill('bad@');
+ await page.getByLabel('Email address').fill('bad@');

Reason: #email-input id was removed; element is now identified by its label.
```

Show all diffs grouped by file. Then ask:
> "Apply these <n> patches? (yes / review one by one / skip)"

## Step 5 — Apply patches

For each confirmed patch, use the Edit tool to apply the exact string replacement.

After all patches are applied, re-run the tests to verify:
```bash
npx playwright test <patched-files> --reporter=list 2>&1
```

If tests still fail: diagnose the next layer (sometimes multiple selectors are broken in one test). Repeat Steps 2–4.

If tests pass: proceed to Step 6.

## Step 6 — Report

```
🔧 Healed <n> tests across <m> files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 File                     Patches   Status
 tests/login.spec.ts      2         ✅ passing
 tests/checkout.spec.ts   1         ✅ passing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tip: Add data-testid attributes to frequently-healed elements to prevent recurrence.
```
