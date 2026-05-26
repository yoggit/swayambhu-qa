# Environment Variables

Fill in only what your team uses — leave everything else blank.

```bash
cp .env.example .env
```

## Required

```sh
ANTHROPIC_API_KEY=sk-ant-...
```

Get your key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).

## App URLs

These are fallbacks — the pipeline first looks for `Test URL:` and `API URL:` in the ticket body, then falls back to these.

```sh
BASE_URL=https://myapp.com
API_BASE_URL=https://api.myapp.com
```

## JIRA

```sh
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_token
JIRA_PROJECT_KEY=QA
```

Get a token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).

## Xray (JIRA Test Management Plugin)

```sh
XRAY_CLIENT_ID=your_client_id
XRAY_CLIENT_SECRET=your_client_secret
XRAY_PROJECT_KEY=QA
```

Get credentials at JIRA → Apps → Xray → API Keys.

## Azure DevOps

```sh
ADO_ORG=yourorg
ADO_PROJECT=YourProject
ADO_PAT=your_pat
```

Get a PAT at dev.azure.com → User Settings → Personal Access Tokens.

## Linear

```sh
LINEAR_API_KEY=lin_api_xxx
LINEAR_TEAM_ID=your_team_id
```

Get your key at linear.app → Settings → API → Personal API keys.

## TestRail

```sh
TESTRAIL_URL=https://yourcompany.testrail.io
TESTRAIL_USER=your.email@company.com
TESTRAIL_API_KEY=your_key
TESTRAIL_PROJECT_ID=1
```

## Zephyr Scale

```sh
ZEPHYR_BASE_URL=https://yourcompany.atlassian.net
ZEPHYR_API_TOKEN=your_token
ZEPHYR_PROJECT_KEY=QA
```

## Security note

`.env` is gitignored by default. Only `.env.example` (with placeholder values) should be committed. The `init` command sets this up automatically.
