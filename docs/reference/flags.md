# All Flags Reference

## `/qa-pipeline` flags

| Flag | Required? | Supported values | Default | Notes |
|---|---|---|---|---|
| `--issue <id>` | **Always** | Any issue ID | — | `TEST-22`, `42`, `ENG-456` |
| `--source <src>` | No | `github` ✅, `jira` ✅, `ado` 🔜, `linear` 🔜 | `github` | Omit if using GitHub Issues |
| `--repo <owner/repo>` | GitHub only | e.g. `myorg/myrepo` | — | Only needed with `--source github` |
| `--tool <tool>` | No | `playwright` ✅, `restassured` ✅, `cypress` 🔜, `selenium` 🔜 | `playwright` | Combine with commas: `playwright,restassured` |
| `--tms <tms>` | No | `xray`, `testrail`, `zephyr`, `markdown` | `markdown` | Omit for local-only run. Add `--tms xray` to push to Xray |
| `--no-pr` | No | _(flag only)_ | _(PR is created)_ | Skip Draft PR phase |
| `--url <url>` | No | Any URL | From issue / `.env` | Override the UI URL |
| `--api-url <url>` | No | Any URL | From issue / `.env` | Override the API URL |

## `/automate-from-tms` flags

| Flag | Required? | Notes |
|---|---|---|
| `--issue <id>` | One of these three is required | Automate all TCs linked to this issue |
| `--suite <name>` | One of these three is required | Automate a full suite by name |
| `--case <ids>` | One of these three is required | Comma-separated TC IDs — most granular |
| `--source <src>` | No | Issue tracker (for bug logging) — default `github` |
| `--test-mgmt <tms>` | No | Where to read TCs from — default `markdown` |
| `--tool <tool>` | No | Automation framework — default `playwright` |
| `--bug-tracker <tracker>` | No | Where to log bugs — defaults to `--source` value |

## Internal script flags (orchestrator sets these automatically)

These flags are only needed when calling individual scripts directly. The orchestrator (`/qa-pipeline`) sets them automatically.

| Flag | Script | Notes |
|---|---|---|
| `--file <path>` | `push-to-tms` | Path to `.md` test case file |
| `--results <path>` | `update-tms-status` | Path to `.json` results file |
| `--run-id <id>` | TestRail only | Integer run ID |
| `--feature <slug>` | markdown TMS only | Short slug string |

## TC selection priority (automate-from-tms)

`--case` > `--suite` > `--issue`

Most granular wins.
