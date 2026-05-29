# /automate-from-tms

Reads existing test cases from your TMS and generates automation code for them — without touching the requirements or recreating the TCs.

## Usage

```bash
/automate-from-tms [--id <id>] [--suite <name>] [--case <ids>] \
                   [--source <src>] [--test-mgmt <tms>] [--tool <tool>]
```

::: tip All command combinations
Every `--tool`, `--source`, and `--test-mgmt` option in one place → [Command Combinations](/reference/commands)
:::

## Examples

```bash
# All TCs linked to a JIRA issue → automate with Playwright
/automate-from-tms --id QA-42 --source jira --test-mgmt xray --tool playwright

# Specific TestRail suite → Playwright
/automate-from-tms --suite "Login Tests" --test-mgmt testRail --tool playwright

# Specific TC IDs from local markdown files
/automate-from-tms --case TC-1-01,TC-1-03,TC-1-05 --test-mgmt markdown --tool playwright

# TCs from Xray → Playwright + REST Assured
/automate-from-tms --id QA-42 --source jira --test-mgmt xray --tool playwright,restassured

# Local TC markdown file — no TMS or IMS credentials needed
/automate-from-tms --id "./test-cases/TC-login.md" --test-mgmt markdown --tool playwright
```

## Multi-run — multiple issues or files in one command

`--id` accepts a comma-separated list of issue IDs and/or local TC file paths. Each item runs all steps (read TCs → generate code → run → heal → log bugs → update TMS) sequentially, with a 5-second cooldown between items.

```bash
# Two JIRA issues, back-to-back
/automate-from-tms --id "QA-42,QA-43" --source jira --test-mgmt xray --tool playwright

# Two tickets + one local TC file (no credentials needed for the file entry)
/automate-from-tms --id "QA-42,QA-43,./test-cases/TC-login.md" --source jira --test-mgmt xray --tool playwright

# Multiple local TC files — no IMS or TMS credentials needed
/automate-from-tms --id "./test-cases/TC-login.md,./test-cases/TC-checkout.md" --test-mgmt markdown --tool playwright
```

Note: `--suite` and `--case` remain single-scope flags and do not support comma-separated multi-run. Only `--id` supports multi-run.

## TC selection priority

`--case` > `--suite` > `--id`

Most granular wins. If you provide `--case`, the suite and issue flags are ignored.

## What it does

1. **Reads TCs** from your TMS (or local `test-cases/` folder for `--test-mgmt markdown`)
2. **Scrapes the UI** (if a UI tool is selected) to capture current selectors
3. **Generates automation code** — each TC's steps map to actions, expected results map to assertions
4. **Runs the tests**
5. **Heals failures** (selectors, timing)
6. **Logs bugs** for confirmed app failures
7. **Updates TMS** with pass/fail results

## Common use cases

- Your QA team manually wrote test cases in TestRail months ago — now you want to automate them
- You ran `/create-test-cases` which pushed TCs to Xray — now you want the automation code
- A new engineer wants to automate a specific subset of existing TCs from Zephyr

## vs `/generate-tests`

`/generate-tests` scrapes a URL and invents test scenarios from what it finds on the page.  
`/automate-from-tms` reads your team's documented steps and automates those exact scenarios.

Use `/generate-tests` when you want to discover tests. Use `/automate-from-tms` when you want to automate tests you already defined.
