# zero-to-green 🟢

> *Give it a ticket. Get back a passing test suite.*

An agentic AI QA pipeline built with Claude Code. One command takes a GitHub Issue written by a Product Owner all the way to a green test suite, logged bugs, and a Draft PR — in under 30 minutes.

## How It Works

```
Product Owner → GitHub Issue → /qa-pipeline 42
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
                              Bug Reports (GitHub Issues)
                                      ▼
                              Comment on Ticket
                                      ▼
                               Draft PR Created
```

## Agents

| Command | What it does |
|---|---|
| `/qa-pipeline <issue#>` | Full lifecycle — ticket to PR |
| `/generate-tests <url>` | Scrape a page and write Playwright tests |
| `/analyze-flaky` | Read test results, classify flaky tests |
| `/heal-tests` | Auto-fix broken selectors |
| `/bug-to-test` | Turn a bug report into a regression test |
| `/qa-report` | Generate a shareable test results report |

## Stack

- **Claude Code** — AI agent runtime (zero extra cost with existing subscription)
- **Playwright + TypeScript** — UI automation
- **REST Assured + Java/Maven** — API automation  
- **GitHub Issues** — Requirement tracking (replaces JIRA)
- **GitHub MCP** — Agent reads issues, logs bugs, creates PRs

## Setup

```bash
# 1. Clone
git clone https://github.com/yoggit/zero-to-green
cd zero-to-green

# 2. Install dependencies
npm install
npx playwright install chromium

# 3. Authenticate GitHub CLI
gh auth login

# 4. Open in Claude Code and run
/qa-pipeline 1
```

## Requirements

- Node.js 18+
- Java 21 + Maven 3.9+
- Claude Code (claude.ai/code)
- GitHub CLI (`gh`)

---

Built with ❤️ to show that AI agents can handle the repetitive parts of QA — so engineers can focus on what actually matters: quality judgment.
