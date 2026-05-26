# swayambhu-qa

> *Self-manifested QA. Give it a ticket. Get back a passing test suite.*

An agentic AI QA pipeline built with Claude Code. One command takes any issue tracker ticket — JIRA, Azure DevOps, Linear, or GitHub Issues — all the way to a green test suite, logged bugs, and a Draft PR. In under 30 minutes.

## How It Works

```
Product Owner → Issue Tracker → /qa-pipeline QA-42 --source jira --tool playwright,restassured
                                        │
                           ┌────────────┴────────────┐
                           ▼                         ▼
                 Playwright Tests          REST Assured API Tests
                 (TypeScript)              (Java + Maven)
                           │                         │
                           └────────────┬────────────┘
                                        ▼
                             Flaky Detection & Healing
                                        ▼
                                Bug Reports logged
                                        ▼
                              Comment on original ticket
                                        ▼
                                 Draft PR created
                                        ▓
                              Human reviews & approves
                                        ▼
                                   main ✅
```

## Agents

| Command | What it does |
|---|---|
| `/qa-pipeline <issue>` | Full lifecycle — ticket to PR |
| `/create-test-cases <issue>` | Issue tracker → Test cases only (no automation) |
| `/automate-from-tms` | Existing test cases → Automate + Run + Heal + Bugs |
| `/generate-tests <url>` | Scrape a page and write tests |
| `/analyze-flaky` | Read test results, classify flaky tests |
| `/heal-tests` | Auto-fix broken selectors |
| `/bug-to-test` | Turn a bug report into a regression test |
| `/qa-report` | Generate a shareable test results report |

## Supported Tools

### Issue Management (`--source`)
| Tool | Flag |
|---|---|
| GitHub Issues | `--source github` (default) |
| JIRA / Atlassian | `--source jira` |
| Azure DevOps | `--source ado` |
| Linear | `--source linear` |

### Test Automation (`--tool`)
| Tool | Flag |
|---|---|
| Playwright + TypeScript | `--tool playwright` |
| Cypress + TypeScript | `--tool cypress` |
| Selenium + Java | `--tool selenium` / `selenium:testng` / `selenium:junit` / `selenium:cucumber` |
| REST Assured + Java | `--tool restassured` / `restassured:junit` / `restassured:cucumber` |
| Appium (Mobile) | `--tool appium` |
| Robot Framework | `--tool robot:ui` / `robot:api` / `robot:android` / `robot:ios` |

### Valid Combos (UI + API)
```bash
--tool playwright,restassured
--tool cypress,restassured
--tool selenium,restassured
--tool appium,restassured
--tool robot:ui,api
--tool robot:android,api
--tool robot:ios,api
```

## Example Commands

```bash
# Simplest: GitHub Issue + Playwright (--source github and --tool playwright are defaults)
/qa-pipeline --issue 42 --repo myorg/myrepo

# JIRA ticket → Playwright only (no --repo needed for JIRA)
/qa-pipeline --issue TEST-22 --source jira --tool playwright

# JIRA ticket → Playwright + REST Assured (UI + API together)
/qa-pipeline --issue QA-42 --source jira --tool playwright,restassured

# Azure DevOps → Selenium + TestNG
/qa-pipeline --issue 12345 --source ado --tool selenium:testng

# Linear → Cypress + REST Assured
/qa-pipeline --issue ENG-456 --source linear --tool cypress,restassured

# Linear → Robot Framework (UI + API)
/qa-pipeline --issue ENG-456 --source linear --tool robot:ui,api

# Skip PR creation (local dev / no git remote)
/qa-pipeline --issue TEST-22 --source jira --tool playwright --no-pr

# Skip TMS push (use markdown as a local record instead of Xray/TestRail)
/qa-pipeline --issue TEST-22 --source jira --tool playwright --tms markdown

# Just create test cases, no automation
/create-test-cases --issue QA-42 --source jira

# Automate existing test cases from TestRail
/automate-from-tms --issue QA-42 --source jira --test-mgmt testRail --tool playwright
```

## Setup

swayambhu-qa is an add-on for your existing project — it connects your issue tracker, test runner, and TMS. You keep your existing Playwright / REST Assured / Selenium setup exactly as it is.

### 0. Install Claude Code

swayambhu-qa runs inside Claude Code. If you don't have it yet:

```bash
npm install -g @anthropic-ai/claude-code
```

Or download the desktop app from [claude.ai/code](https://claude.ai/code). You'll also need an Anthropic API key — set it once:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### 1. Install

```bash
npm install --save-dev @swayambhu-qa/core
```

### 2. Initialize

```bash
npx @swayambhu-qa/core init
```

What this does:
- Adds the swayambhu-qa MCP server entry to `.claude/settings.json`
- Creates `.env.example` with all available configuration variables
- Writes a 1-line shim file per agent into `.claude/commands/` — each shim delegates to the full agent logic inside `node_modules`, so your repo stays clean and the agents auto-update with npm

After init, your `.claude/commands/` folder will have these slash commands available in Claude Code:

| Command | What it does |
|---|---|
| `/qa-pipeline` | Full pipeline: ticket → tests → heal → TMS → PR |
| `/create-test-cases` | Ticket → test cases pushed to TMS only |
| `/generate-tests` | URL → Playwright/REST Assured spec only |
| `/automate-from-tms` | TMS test cases → automate + run + heal + bugs |
| `/heal-tests` | Broken spec → fixed spec |
| `/bug-to-test` | Bug report → regression test |
| `/analyze-flaky` | Test results → flaky test report |
| `/qa-report` | Results → shareable QA report |

#### Approval prompts

By default, Claude Code asks for your approval before each tool call (bash commands, file writes, etc.). This is the safe default.

To skip per-step prompts and let the pipeline run unattended locally, re-run init with the `--auto-approve` flag:

```bash
npx @swayambhu-qa/core init --auto-approve
```

This adds `Bash(*)`, `Read(*)`, `Write(*)`, and `Edit(*)` to the `permissions.allow` list in `.claude/settings.json`. Only use this if you trust the tickets and URLs being fed to the pipeline.

For CI, use `--dangerously-skip-permissions` on the `claude` CLI instead — see the [CI section](#running-in-ci) below.

### 3. Configure

Fill in `.env` with only the tools your team uses — leave everything else blank:

```bash
cp .env.example .env
```

See the [Configuration](#configuration-env) section below for all available variables.

### 4. Open in Claude Code and run

```bash
/qa-pipeline --issue TEST-22 --source jira --tool playwright --tms xray
```

That's it. The pipeline reads your ticket, scrapes your app, writes tests in your existing framework, runs them, heals failures, and pushes results back to your TMS.

## URL Resolution

Two URLs matter — one for UI tests, one for API tests. The agent resolves each independently using the same 3-tier lookup:

| Priority | Source | How |
|---|---|---|
| 1 (highest) | CLI flag | `--url` (UI) and `--api-url` (API) |
| 2 | Issue description | PO writes `Test URL:` and `API URL:` in the ticket body |
| 3 (fallback) | `.env` file | `BASE_URL` (UI) and `API_BASE_URL` (API) |

### UI URL — for Playwright, Cypress, Selenium, Appium

Points at the front-end application. The browser opens this URL.

```
Test URL: https://myapp.com
```

Resolved by (in order): `--url` flag → `Test URL:` in issue → `BASE_URL` in `.env`

### API URL — for REST Assured, Robot Framework API mode, Playwright API tests

The base URL that all API request paths are appended to (e.g. `POST /api/register`).

```
API URL: https://api.myapp.com
```

Resolved by (in order): `--api-url` flag → `API URL:` in issue → `API_BASE_URL` in `.env`

### How the PO sets URLs in a ticket

Write both in the issue description (JIRA, GitHub, ADO, or Linear):

```
Test URL: https://myapp.com
API URL:  https://api.myapp.com
```

The parser accepts `Test URL`, `UI URL`, `Base URL` for the UI address and `API URL`, `API Base URL` for the API address — on the same line as the label or on the immediately following line.

### CI / environment override with CLI flags

Use CLI flags to test the same ticket against different environments without editing the ticket:

```bash
# Fetch issue
npx ts-node scripts/fetch-issue.ts --issue QA-42 --source jira

# Generate + run tests against staging
npx ts-node scripts/generate-tests.ts --issue QA-42 \
  --url https://staging.myapp.com \
  --api-url https://api.staging.myapp.com

# Push results back to Xray
npx ts-node scripts/update-tms-status.ts --tms xray --issue QA-42 --results test-results.json
```

### CI Permissions — scope before you run

The pipeline runs Claude Code non-interactively in CI using the `--dangerously-skip-permissions` flag,
which bypasses all approval prompts. This is safe **only when the environment is properly scoped first**:

| What to scope | How |
|---|---|
| API tokens | Use read-only JIRA tokens where possible; Xray write-only token — never admin keys |
| CI runner | Use ephemeral containers (GitHub Actions, GitLab CI) — never a shared persistent server |
| Filesystem | The runner should have access only to the repo checkout — no production mounts |
| Network | Restrict egress to only the domains the pipeline needs (Atlassian, Xray, your app URL) |
| JIRA project | Only internal/trusted team members should be able to create tickets that trigger the pipeline |

> **Prompt injection risk:** if untrusted users can create tickets in your JIRA project, a malicious
> description could attempt to inject commands. Mitigate by restricting ticket creation to team members
> and reviewing the `fetch-issue.ts` output before the pipeline proceeds in sensitive environments.

### CI command

Full syntax to run the pipeline headlessly in CI:

```bash
claude --dangerously-skip-permissions -p \
  "/qa-pipeline --issue QA-42 --source jira --tool playwright --tms xray"
```

- `--dangerously-skip-permissions` — skips all tool-use approval prompts (required for non-interactive CI)
- `-p` — print mode: runs non-interactively, outputs result, then exits

### Typical GitHub Actions usage

```yaml
# .github/workflows/qa-nightly.yml
- name: Install Claude Code
  run: npm install -g @anthropic-ai/claude-code

- name: Run QA Pipeline
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
    JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
    XRAY_CLIENT_ID: ${{ secrets.XRAY_CLIENT_ID }}
    XRAY_CLIENT_SECRET: ${{ secrets.XRAY_CLIENT_SECRET }}
    XRAY_PROJECT_KEY: TEST
    BASE_URL: ${{ vars.STAGING_URL }}
  run: |
    claude --dangerously-skip-permissions -p \
      "/qa-pipeline --issue ${{ inputs.issue }} --source jira --tool playwright --tms xray"
```

### Human review pause

After generating test cases and before writing any code, the pipeline pauses and shows you a table of all TCs with their Xray keys, types, and AC coverage. You can approve or redirect:

**Approve and proceed:**
> yes

**Remove a test case:**
> Remove the accessibility test case, we don't need it for now

**Add a test case:**
> Add a test case for negative amount entry (e.g. entering -50)

**Change a test type:**
> TC-TEST22-03 should be an Edge case, not Happy Path

**Change AC mapping:**
> TC-TEST22-07 should cover AC-6 not AC-7

**Change selectors:**
> Use data-testid attributes instead of class-based selectors

**Narrow scope:**
> Focus only on Happy Path test cases, skip Negative and Edge for now

Any plain-English instruction works — the pipeline rewrites the TC file and re-pushes to Xray before generating code.

---

### How a user invokes the full pipeline

The user types one command in Claude Code:

```bash
/qa-pipeline --issue TEST-22 --source jira --tool playwright --tms xray
```

The orchestrator (`/qa-pipeline`) reads those flags and internally calls each script with only the subset that script needs:

```bash
# Phase 1 — fetch ticket:
node node_modules/@swayambhu-qa/core/dist/scripts/fetch-issue.js --issue TEST-22 --source jira

# Phase 2 — scrape app UI:
node node_modules/@swayambhu-qa/core/dist/scripts/scrape-app.js --url <url-from-issue>

# Phase 3 — push test cases to TMS:
node node_modules/@swayambhu-qa/core/dist/scripts/push-to-tms.js --issue TEST-22 --tms xray --file test-cases/TC-TEST22-*.md

# Phase 5 — run tests (Playwright example):
npx playwright test tests/generated/<slug>.spec.ts --reporter=json

# Phase 8 — update TMS with results:
node node_modules/@swayambhu-qa/core/dist/scripts/update-tms-status.js --issue TEST-22 --tms xray --results reports/results-TEST22.json
```

`--tool` tells the orchestrator *which* spec to generate and *which* test runner to invoke. Individual scripts are tool-agnostic — they never see the `--tool` flag.

### All flags reference

| Flag | Required? | Default | Purpose & when to omit |
|---|---|---|---|
| `--issue <id>` | **Always** | — | Issue ID. Format by tracker: JIRA → `TEST-22`, GitHub → `42`, ADO → `12345`, Linear → `ENG-456` |
| `--source <src>` | No | `github` | Where to fetch the issue: `jira` \| `ado` \| `linear` \| `github`. Omit if you use GitHub Issues. |
| `--repo <owner/repo>` | GitHub only | — | Your GitHub repo (e.g. `myorg/myrepo`). **Only needed when `--source github`**. Omit for JIRA/ADO/Linear. |
| `--tool <tool>` | No | `playwright` | Test runner(s) to generate and execute. Omit to default to Playwright. See tool combos below. |
| `--tms <tms>` | No | `xray` | Test Management System: `xray` \| `testrail` \| `zephyr` \| `markdown`. Omit to default to Xray. Use `markdown` for no TMS. |
| `--no-pr` | No | _(PR is created)_ | Add this flag to skip the Draft PR step entirely. Useful for local runs or when no git remote is set up. |
| `--url <url>` | No | From issue / `.env` | Override the UI app URL. Omit if the issue description contains a `Test URL:` line or `BASE_URL` is set in `.env`. |
| `--api-url <url>` | No | From issue / `.env` | Override the API base URL. Omit if the issue has an `API URL:` line or `API_BASE_URL` is set in `.env`. |
| `--file <path>` | `push-to-tms` only | — | Path to a TC markdown file (individual script use only — orchestrator sets this automatically). |
| `--results <path>` | `update-tms-status` only | — | Path to the results JSON (individual script use only — orchestrator sets this automatically). |
| `--run-id <id>` | TestRail only | — | TestRail Test Run ID (individual script use only). |
| `--feature <slug>` | markdown TMS only | — | Feature slug for markdown TMS (individual script use only). |

---

## Output folders

The pipeline writes into these folders inside your project (created automatically on first run):

| Folder | Files | Description |
|---|---|---|
| `logs/` | `pipeline-latest.log` | Always contains the most recent run's structured logs |
| `logs/` | `pipeline-<issueId>-<date>.log` | Per-run archive — one file per pipeline execution |
| `reports/` | `tc-mapping-<issueId>.json` | Maps TC IDs to native TMS keys (written by push-to-tms, read by run-tests) |
| `reports/` | `results-<issueId>.json` | Pass/fail per TC after test run, including heal details |
| `reports/` | `pw-results-<issueId>.json` | Raw Playwright JSON reporter output |
| `test-cases/` | `TC-<issueId>-<slug>.md` | Generated test cases in markdown before they are pushed to TMS |
| `tests/generated/` | `<slug>.spec.ts` | Generated Playwright/Cypress/etc spec file |

Add these to your `.gitignore` if you don't want to commit generated artifacts:

```
logs/
reports/
test-cases/
tests/generated/
```

Or commit them if you want a full audit trail of every pipeline run.

---

## Configuration (`.env`) {#configuration-env}

Fill in only what your team uses — leave everything else blank:

```env
# ── Anthropic (required) ───────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...           # https://console.anthropic.com/settings/keys

# ── App URLs (fallback when not set in the issue description) ──────────────
BASE_URL=https://myapp.com             # UI tests — Playwright, Cypress, Selenium, Appium
API_BASE_URL=https://api.myapp.com     # API tests — REST Assured, Robot API, Playwright API

# ── JIRA / Atlassian ───────────────────────────────────────────────────────
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_token              # https://id.atlassian.com/manage-profile/security/api-tokens
JIRA_PROJECT_KEY=QA

# ── Xray (JIRA plugin — Test Management) ──────────────────────────────────
XRAY_CLIENT_ID=your_client_id          # JIRA → Apps → Xray → API Keys
XRAY_CLIENT_SECRET=your_client_secret
XRAY_PROJECT_KEY=QA

# ── Azure DevOps ───────────────────────────────────────────────────────────
ADO_ORG=yourorg
ADO_PROJECT=YourProject
ADO_PAT=your_pat                       # dev.azure.com → User Settings → Personal Access Tokens

# ── Linear ─────────────────────────────────────────────────────────────────
LINEAR_API_KEY=lin_api_xxx             # linear.app → Settings → API → Personal API keys
LINEAR_TEAM_ID=your_team_id

# ── TestRail ───────────────────────────────────────────────────────────────
TESTRAIL_URL=https://yourcompany.testrail.io
TESTRAIL_USER=your.email@company.com
TESTRAIL_API_KEY=your_key
TESTRAIL_PROJECT_ID=1

# ── Zephyr Scale ───────────────────────────────────────────────────────────
ZEPHYR_BASE_URL=https://yourcompany.atlassian.net
ZEPHYR_API_TOKEN=your_token
ZEPHYR_PROJECT_KEY=QA
```

## Requirements

| Requirement | When needed |
|---|---|
| Claude Code (`claude.ai/code`) | Always — the agent runs inside Claude Code |
| Anthropic API key (`ANTHROPIC_API_KEY`) | Always — set in shell or CI secrets |
| Node.js 18+ | Always — the integration scripts run on Node |
| Java 21 + Maven 3.9+ | Only if using REST Assured, Selenium, or Appium |
| Python 3.9+ | Only if using Robot Framework |
| GitHub CLI — `gh auth login` | Draft PR on GitHub repos |
| GitLab CLI — `glab auth login` | Draft MR on GitLab repos |
| Bitbucket CLI — `bb login` | Draft PR on Bitbucket repos |
| Azure DevOps CLI — `az login` | Draft PR on ADO repos |

Everything else (Playwright, Cypress, your existing test framework) you already have in your project.

### Draft PR prerequisites

The Draft PR phase (Phase 9) requires:

1. Your project must be a **git repository** with at least one commit
2. A **GitHub remote** must be set — `git remote add origin https://github.com/org/repo.git`
3. **`gh` CLI installed and authenticated** — run `gh auth login` once before using the pipeline

The pipeline detects your remote URL automatically and uses the right CLI — GitHub (`gh`), GitLab (`glab`), Bitbucket (`bb`), or Azure DevOps (`az repos`). If no remote is configured or the CLI is not authenticated, Phase 9 is skipped gracefully.

Use `--no-pr` to skip Phase 9 entirely — everything else still runs:

```bash
/qa-pipeline --issue TEST-22 --source jira --tool playwright --tms xray --no-pr
```

### Repo setup for Draft PR

If you want the pipeline to open a Draft PR automatically, set up your repo before running the pipeline:

**GitHub:**
```bash
git init && git remote add origin https://github.com/org/repo.git
gh auth login
```

**GitLab:**
```bash
git init && git remote add origin https://gitlab.com/org/repo.git
glab auth login
```

**Bitbucket:**
```bash
git init && git remote add origin https://bitbucket.org/org/repo.git
bb login
```

**Azure DevOps:**
```bash
git init && git remote add origin https://dev.azure.com/org/project/_git/repo
az login && az devops configure --defaults organization=https://dev.azure.com/org project=MyProject
```

If none of these are set up, use `--no-pr` to skip Phase 9 — everything else still runs.

---

## Documentation

Full documentation site coming soon at **https://yoggit.github.io/swayambhu-qa/**

In the meantime, everything you need is in this README and the `.claude/commands/` files installed by `init`.

---

Built to show that AI agents can handle the repetitive parts of QA — so engineers can focus on what actually matters: quality judgment.
