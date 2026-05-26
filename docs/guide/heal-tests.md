# /heal-tests

Auto-fixes broken selectors and timing issues in a failing Playwright spec file. Real app bugs are skipped — those get escalated as bug reports, not silently fixed.

## Usage

```bash
/heal-tests [<spec-file>]
```

## Examples

```bash
# Heal a specific spec file
/heal-tests tests/generated/login.spec.ts

# Heal all generated specs
/heal-tests
```

## What it does

For each failing test, the agent:

1. Classifies the failure:
   - **Selector issue** — element moved or renamed in the DOM
   - **Timing issue** — element not ready when the action runs
   - **Logic mismatch** — test expectation doesn't match current app behavior
   - **Real app bug** — the app is broken, not the test

2. Auto-fixes selector and timing issues, then re-runs to verify
3. Flags logic mismatches for human review
4. Logs real bugs to your issue tracker

## When to use it

- After a UI change broke selectors
- After upgrading a component library that changed class names or attributes
- After the pipeline flags flaky tests that you suspect are timing-related

## What it won't do

`/heal-tests` will not silently "fix" a test by weakening its assertions to make it pass. If the app broke, the test failure is correct — `/heal-tests` will surface that as a bug, not paper over it.
