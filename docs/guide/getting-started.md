# Installation & Setup

swayambhu-qa is an add-on for your existing project — it connects your issue tracker, test runner, and TMS. You keep your existing Playwright / REST Assured setup exactly as it is.

## Prerequisites

| Requirement | When needed |
|---|---|
| [Claude Code](https://claude.ai/code) | Always — agents run inside Claude Code |
| `ANTHROPIC_API_KEY` | Always — set in shell or CI secrets |
| Node.js 18+ | Always — integration scripts run on Node |
| Java 21 + Maven 3.9+ | Only if using REST Assured |
| `gh` CLI authenticated | Draft PR on GitHub repos |

## Step 0 — Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
export ANTHROPIC_API_KEY=sk-ant-...
```

Or download the desktop app from [claude.ai/code](https://claude.ai/code).

## Step 1 — Install the package

```bash
npm install --save-dev @swayambhu-qa/core
```

## Step 2 — Initialize

```bash
npx @swayambhu-qa/core init
```

This does three things:
- Adds the swayambhu-qa MCP server to `.claude/settings.json`
- Creates `.env.example` with all available config variables
- Writes 1-line shim files into `.claude/commands/` — one per agent

After init, you'll have these slash commands in Claude Code:

| Command | What it does |
|---|---|
| `/qa-pipeline` | Full pipeline: ticket → tests → heal → TMS → PR |
| `/create-test-cases` | Ticket → test cases pushed to TMS only |
| `/generate-tests` | URL → Playwright spec only |
| `/automate-from-tms` | TMS test cases → automate + run + heal + bugs |
| `/heal-tests` | Broken spec → fixed spec |
| `/bug-to-test` | Bug report → regression test |
| `/analyze-flaky` | Test results → flaky test report |
| `/qa-report` | Results → shareable QA report |

### Approval prompts

By default, Claude Code asks for approval before each tool call. To run unattended locally:

```bash
npx @swayambhu-qa/core init --auto-approve
```

For CI, use `--dangerously-skip-permissions` on the `claude` CLI instead.

## Step 3 — Configure

```bash
cp .env.example .env
```

Fill in only what your team uses — leave everything else blank. See [Environment Variables](/guide/configuration) for all options.

## Step 4 — Run

```bash
/qa-pipeline --issue TEST-22 --source jira --tool playwright --tms xray
```

That's it. The pipeline reads your ticket, scrapes your app, writes tests, runs them, heals failures, and pushes results back to your TMS.

→ Next: [Your First Pipeline Run](/guide/first-run)
