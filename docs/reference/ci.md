# CI / GitHub Actions

Run the pipeline headlessly in CI using `--dangerously-skip-permissions`.

## CI command

```bash
claude --dangerously-skip-permissions -p \
  "/qa-pipeline --issue QA-42 --source jira --tool playwright --tms xray"
```

- `--dangerously-skip-permissions` — skips all tool-use approval prompts (required for non-interactive CI)
- `-p` — print mode: runs non-interactively, outputs result, then exits

## Security scope before running

This flag bypasses all prompts. Scope your environment before using it:

| What to scope | How |
|---|---|
| API tokens | Use read-only JIRA tokens; Xray write-only token — never admin keys |
| CI runner | Use ephemeral containers — never a shared persistent server |
| Filesystem | Runner should only access the repo checkout — no production mounts |
| Network | Restrict egress to only the domains the pipeline needs |
| JIRA project | Only internal team members should be able to create tickets that trigger the pipeline |

::: warning Prompt injection risk
If untrusted users can create tickets in your JIRA project, a malicious description could attempt to inject commands. Restrict ticket creation to trusted team members and review `fetch-issue.js` output before the pipeline proceeds in sensitive environments.
:::

## Typical GitHub Actions workflow

```yaml
# .github/workflows/qa-nightly.yml
name: Nightly QA Pipeline

on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:
    inputs:
      issue:
        description: 'Issue ID to run (e.g. TEST-22)'
        required: true

jobs:
  qa-pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Setup Java (for REST Assured)
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

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
            "/qa-pipeline --issue ${{ inputs.issue || 'TEST-22' }} \
             --source jira --tool playwright --tms xray --no-pr"
```

## Local approval mode

To run unattended locally (but still interactively):

```bash
npx @swayambhu-qa/core init --auto-approve
```

This adds broad permissions to `.claude/settings.json`. Remove them when done with bulk runs.
