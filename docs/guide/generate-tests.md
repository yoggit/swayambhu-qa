# /generate-tests

Takes a live URL, scrapes the page, and writes a Playwright spec file. No ticket, no TMS, no existing test cases needed.

## Usage

```bash
/generate-tests <url> [--name <feature-name>] [--screenshot]
```

## Examples

```bash
# Generate tests from a login page
/generate-tests https://myapp.com/login

# With a custom file name
/generate-tests https://myapp.com/checkout --name checkout-flow

# Capture a screenshot during scraping
/generate-tests https://myapp.com/dashboard --screenshot
```

## What it does

1. Scrapes the URL — captures DOM, form fields, buttons, test IDs
2. Plans test scenarios (Happy Path, Edge Cases, Accessibility)
3. **Asks you to confirm** the scenario list before writing code
4. Writes `tests/generated/<feature-name>.spec.ts`
5. Validates with `npx playwright test --list`

## vs `/automate-from-tms`

| Agent | Starts from | Use when |
|---|---|---|
| `/generate-tests` | A **live URL** (scrapes the page) | Quick automation, no ticket or TCs needed |
| `/automate-from-tms` | **TC IDs in your TMS** (reads documented steps) | TCs already exist in Xray/TestRail — automate those specific steps |

The key difference: `/generate-tests` discovers tests by looking at the page. `/automate-from-tms` follows the steps your team already documented.

## Output

```
tests/generated/<feature-name>.spec.ts
```

The spec uses `getByRole()`, `getByLabel()`, `getByTestId()` — no raw CSS selectors.
