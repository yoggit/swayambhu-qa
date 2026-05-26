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
# GitHub Issue → Playwright tests
/qa-pipeline 42 --source github --repo myorg/myrepo --tool playwright

# JIRA ticket → Playwright + REST Assured
/qa-pipeline QA-42 --source jira --tool playwright,restassured

# Azure DevOps → Selenium + TestNG
/qa-pipeline 12345 --source ado --tool selenium:testng

# Linear → Cypress + REST Assured
/qa-pipeline ENG-456 --source linear --tool cypress,restassured

# Linear → Robot Framework (UI + API)
/qa-pipeline ENG-456 --source linear --tool robot:ui,api

# Just create test cases, no automation
/create-test-cases QA-42 --source jira

# Automate existing test cases from TestRail
/automate-from-tms --issue QA-42 --source jira --test-mgmt testRail --tool playwright
```

## Setup

```bash
# 1. Clone
git clone https://github.com/yoggit/swayambhu-qa
cd swayambhu-qa

# 2. Install dependencies
npm install
npx playwright install chromium

# 3. Configure your tools
cp .env.example .env
# Fill in only the tools your team uses — leave the rest blank

# 4. Authenticate GitHub CLI
gh auth login

# 5. Open in Claude Code and run
/qa-pipeline 42 --source github --repo myorg/myrepo --tool playwright
```

## Configuration (`.env`)

Fill in only what your team uses — everything else is auto-skipped:

```env
# JIRA
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_token

# Azure DevOps
ADO_ORG=yourorg
ADO_PROJECT=YourProject
ADO_PAT=your_pat

# Linear
LINEAR_API_KEY=lin_api_xxx

# GitHub
GITHUB_TOKEN=ghp_xxx
```

## Requirements

- Node.js 18+
- Java 21 + Maven 3.9+ *(only if using Java-based tools)*
- Python 3.9+ *(only if using Robot Framework)*
- Claude Code (claude.ai/code)
- GitHub CLI (`gh`)

---

Built to show that AI agents can handle the repetitive parts of QA — so engineers can focus on what actually matters: quality judgment.
