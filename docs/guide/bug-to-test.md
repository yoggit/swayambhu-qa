# /bug-to-test

Takes a bug report and writes a regression test that fails on the bug and passes after it's fixed. Ensures the bug can never silently reappear.

## Usage

```bash
/bug-to-test --id <id> --source <src>
```

## Examples

```bash
# GitHub bug report → regression test
/bug-to-test --id 123 --repo myorg/myrepo

# JIRA bug → regression test
/bug-to-test --id BUG-456 --source jira

# Local bug report file — no IMS needed
/bug-to-test --file "./bugs/login-bug.txt"
```

## Multi-run — multiple bugs in one command

`--jira` and `--file` both accept comma-separated values. You can also mix them. Each bug runs sequentially with a 5-second cooldown between items.

```bash
# Three JIRA bugs → three regression tests
/bug-to-test --jira BUG-101,BUG-102,BUG-103

# Multiple local bug report files
/bug-to-test --file "./bugs/login-bug.txt,./bugs/checkout-bug.md"

# Mixed: JIRA bug + local file
/bug-to-test --jira BUG-101 --file "./bugs/manual-bug.txt"
```

A combined summary is printed after all items complete. If one item fails (ticket not found, file missing), it is marked ❌ and the next item starts automatically.

## What it does

1. Reads the bug report (steps to reproduce, expected vs actual behavior)
2. Writes a Playwright test that reproduces the bug
3. Runs the test — it should **fail** on the current broken behavior
4. Saves the test to `tests/generated/regression-<bugId>.spec.ts`
5. When the bug is fixed and the test passes, it becomes a permanent regression guard

## Output

```
tests/generated/regression-<bugId>.spec.ts
```

The test is named clearly so it's obvious which bug it guards against:

```typescript
test('BUG-456: amount field allows negative values', async ({ page }) => {
  // ...
});
```
