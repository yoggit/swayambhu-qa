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

---

## Issue Sources

### GitHub

No extra variables needed — GitHub is handled by the `gh` CLI.

```bash
gh auth login
```

### JIRA

```sh
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_token
JIRA_PROJECT_KEY=QA
```

**How to get the API token:**
1. Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**
3. Give it a label (e.g. `swayambhu-qa`)
4. Copy the token — you won't see it again

`JIRA_PROJECT_KEY` is the short prefix of your project (e.g. `QA` in `QA-42`).

### Azure DevOps

```sh
ADO_ORG=yourorganization
ADO_PROJECT=YourProjectName
ADO_PAT=your_personal_access_token
```

**How to get the PAT:**
1. Go to [dev.azure.com](https://dev.azure.com) and sign in
2. Click your profile icon (top right) → **Personal Access Tokens**
3. Click **New Token**
4. Give it a name, set an expiration date
5. Under **Scopes**, select **Work Items → Read & Write**
6. Click **Create** and copy the token — you won't see it again

`ADO_ORG` is the organization name from your DevOps URL: `https://dev.azure.com/{org}`.

### Linear

```sh
LINEAR_API_KEY=lin_api_your_key_here

# Optional — auto-resolved from issue key (e.g. Q4-5 → team Q4)
# LINEAR_TEAM_ID=uuid_of_team

# Optional — auto-tags logged bugs with your "Bug" label
# LINEAR_BUG_LABEL_ID=uuid_of_bug_label
```

**How to get the API key:**
1. Go to [linear.app](https://linear.app) and sign in
2. Click your profile picture (bottom left) → **Settings**
3. Go to **API** → **Personal API keys**
4. Click **Create key**, give it a label (e.g. `swayambhu-qa`)
5. Copy the key (starts with `lin_api_`) — you won't see it again

The issue ID format is `TEAM-NUMBER` (e.g. `Q4-5`), visible next to each issue title.

`LINEAR_TEAM_ID` is optional — the pipeline derives the target team automatically from the issue key (`Q4-5` → team `Q4`). Set it only if you want to route bug reports to a different team than the one that owns the requirement ticket.

---

## Test Management

### Xray (JIRA plugin)

```sh
XRAY_CLIENT_ID=your_client_id
XRAY_CLIENT_SECRET=your_client_secret
XRAY_PROJECT_KEY=QA
```

**How to get Client ID and Secret:**
1. In JIRA, go to **Apps** → **Xray** (or search for Xray in the top nav)
2. Go to **Xray Settings** → **API Keys**
3. Click **Generate** — this gives you a Client ID and Client Secret pair
4. Copy both — the secret is only shown once

`XRAY_PROJECT_KEY` is the same JIRA project key where your test issues live.

### TestRail

```sh
TESTRAIL_URL=https://yourcompany.testrail.io
TESTRAIL_USER=your.email@company.com
TESTRAIL_API_KEY=your_key
TESTRAIL_PROJECT_ID=1
```

**How to get the API key:**
1. Log in to your TestRail instance
2. Go to **My Settings** (top right profile menu)
3. Click **API Keys** tab
4. Click **Add Key**, give it a name, click **Generate Key**
5. Copy the key

`TESTRAIL_PROJECT_ID` is the integer project ID visible in the TestRail URL when you open a project.

---

## Security note

`.env` is gitignored by default. Only `.env.example` (with placeholder values) should be committed. The `init` command sets this up automatically.
