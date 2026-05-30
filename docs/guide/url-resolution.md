# URL Resolution

Two URLs matter — one for UI tests, one for API tests. The agent resolves each independently using a 3-tier priority:

| Priority | Source | How |
|---|---|---|
| 1 (highest) | CLI flag | `--url` and `--api-url` |
| 2 | Issue description | `Test URL:` and `API URL:` in the ticket body |
| 3 (fallback) | `.env` file | `BASE_URL` and `API_BASE_URL` |

## UI URL

Used by Playwright, Cypress, Selenium, and Robot Framework (UI). The browser opens this URL.

**In the ticket description:**
```
Test URL: https://myapp.com
```

**Via CLI flag:**
```bash
/qa-pipeline --id TEST-22 --source jira --tool playwright --url https://staging.myapp.com
```

**In `.env`:**
```sh
BASE_URL=https://myapp.com
```

## API URL

Used by REST Assured and Robot Framework API mode. All request paths are appended to this base.

For example, `API URL: https://api.myapp.com` + `POST /api/register` → `POST https://api.myapp.com/api/register`

**In the ticket description:**
```
API URL: https://api.myapp.com
```

**Via CLI flag:**
```bash
/qa-pipeline --id TEST-22 --source jira --tool restassured --api-url https://api.staging.myapp.com
```

**In `.env`:**
```sh
API_BASE_URL=https://api.myapp.com
```

## Accepted label formats

The parser accepts multiple label variants on the same line as the value:

| Accepted | For |
|---|---|
| `Test URL`, `UI URL`, `Base URL` | UI address |
| `API URL`, `API Base URL` | API address |

The value can be on the same line as the label or on the immediately following line.

## Testing the same ticket against different environments

Use CLI flags to override without editing the ticket — useful for running against staging vs production:

```bash
# Staging
/qa-pipeline --id TEST-22 --source jira --tool playwright \
  --url https://staging.myapp.com \
  --api-url https://api.staging.myapp.com

# Production smoke test
/qa-pipeline --id TEST-22 --source jira --tool playwright \
  --url https://myapp.com \
  --api-url https://api.myapp.com
```
