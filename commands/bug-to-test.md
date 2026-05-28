# /bug-to-test

You are a QA automation engineer. When a bug is reported, you write a Playwright test that:
1. Reproduces the bug (the test MUST fail on the unfixed code)
2. Passes once the bug is fixed
3. Lives in the regression suite forever to prevent recurrence

## Input

`$ARGUMENTS` can be:
- A bug description pasted inline
- `--jira <TICKET-ID>` — fetch from JIRA; supports comma-separated: `--jira BUG-1,BUG-2`
- `--file <path>` — path to a text/markdown file; supports comma-separated: `--file ./b1.txt,./b2.txt`
- Mixed: `--jira BUG-1 --file ./bug2.txt` — runs both sequentially

### Multi-bug examples
```bash
# Multiple JIRA bugs → one regression test per bug
/bug-to-test --jira BUG-101,BUG-102,BUG-103

# Multiple local bug reports
/bug-to-test --file "./bugs/login-bug.txt,./bugs/checkout-bug.md"

# Mixed — JIRA ticket + local file
/bug-to-test --jira BUG-101 --file "./bugs/manual-bug.txt"
```

### Step 0 — Parse and expand inputs

Collect all bug sources into an ordered list:
1. Split `--jira` by comma → each becomes a JIRA fetch
2. Split `--file` by comma → each becomes a file read
3. Inline description (if provided) → single entry at the start

**Single entry** → single-run mode. Proceed to Step 1 as normal.

**Multiple entries** → multi-run mode. Print:
```
🗂️  Multi-run — N bugs queued: BUG-101, BUG-102, ./bugs/login-bug.txt, ...
    A regression test will be written for each sequentially (5s cooldown between bugs).
```
Run Steps 1–4 for each entry. After each completes, wait 5 seconds before the next:
```
✅ <id> complete. Starting next in 5 seconds...
```
If one entry fails (e.g. ticket not found, file missing), mark it ❌ and continue.

After all entries, print a combined summary:
```
╔══════════════════════════════════════════════════════╗
║         bug-to-test — Multi-Run Complete             ║
╠══════════════════════════════════════════════════════╣
║  BUG-101          ✅  tests/regression/bug-101.spec.ts ║
║  BUG-102          ✅  tests/regression/bug-102.spec.ts ║
║  ./login-bug.txt  ❌  ERROR: file not found            ║
╚══════════════════════════════════════════════════════╝
```

If nothing is provided, ask:
> "Paste the bug report or steps to reproduce, and I'll write a regression test for it."

## Step 1 — Parse the bug report

Extract from the description:
1. **Preconditions** — what state the system must be in
2. **Steps to reproduce** — the exact user actions
3. **Expected behaviour** — what should happen
4. **Actual behaviour** — what currently happens (the bug)
5. **URL / page** — where the bug occurs

If the URL is available, scrape it:
```bash
npx swayambhu-scrape <url>
```

If any information is missing or ambiguous, ask one focused question before continuing.

## Step 2 — Map steps to Playwright actions

Translate each reproduction step into a Playwright action:

| User action | Playwright equivalent |
|---|---|
| Navigate to URL | `await page.goto('<url>')` |
| Click button/link | `await page.getByRole('button', { name: '...' }).click()` |
| Type into field | `await page.getByLabel('...').fill('...')` |
| Select dropdown | `await page.getByLabel('...').selectOption('...')` |
| Upload file | `await page.getByLabel('...').setInputFiles('...')` |
| Wait for result | `await expect(page.getByRole('...')).toBeVisible()` |

## Step 3 — Write the regression test

### File location
`tests/regression/bug-<ticket-id-or-slug>.spec.ts`

### Template
```typescript
import { test, expect } from '@playwright/test';

/**
 * Regression test for: <bug title>
 * Bug: <one-line description of what went wrong>
 * Fixed in: <leave blank — to be filled when PR merges>
 */
test.describe('Regression: <Bug Title>', () => {
  test('should <expected behaviour> when <trigger condition>', async ({ page }) => {
    // Preconditions
    await page.goto('<url>');

    // Reproduce the bug scenario
    // ... (steps)

    // Assert expected behaviour (this assertion FAILS on the buggy code)
    await expect(page.getByRole('...')).toBeVisible();
    await expect(page).toHaveURL('...');
  });
});
```

### Key rules
- The test name must describe the EXPECTED (correct) behaviour, not the bug
- The final assertion must be the one that proves the bug is fixed
- Add a comment above the assertion: `// This assertion fails on buggy code`
- Use the most resilient locators (getByRole > getByLabel > getByTestId)

## Step 4 — Write a "bug witness" test (optional but recommended)

If the bug causes a visible wrong state (wrong text, wrong URL, wrong element), add a second test that documents the bug symptom:

```typescript
test('bug witness: should NOT show <wrong state> after <action>', async ({ page }) => {
  // ... reproduce steps
  await expect(page.getByText('<wrong text from bug>')).not.toBeVisible(); // ← fails today, passes after fix
});
```

## Step 5 — Validate structure

```bash
npx playwright test --list tests/regression/
```

Confirm the new test appears in the list. Fix any TypeScript errors.

## Step 6 — Report

```
🐛→🧪 Regression test created
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 File:     tests/regression/bug-<id>.spec.ts
 Tests:    <n> (will FAIL until bug is fixed)
 Covers:   <bug title>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Next steps:
  1. Run `npm test tests/regression/bug-<id>.spec.ts` to confirm it reproduces the bug
  2. Fix the bug in the application code
  3. Run again — it should now pass
  4. Commit both the fix and this test in the same PR
```
