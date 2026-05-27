# File Source

No JIRA. No GitHub. No credentials.

Pass a local file as `--id` and swayambhu-qa reads your requirements directly from it — no `--source` flag needed.

## Usage

Always wrap the file path in **double quotes** — especially if the filename contains spaces, dashes, or special characters (common with macOS filenames):

```bash
/qa-pipeline --id "./story.md" --tool playwright
/qa-pipeline --id "requirements/login-feature.docx" --tool playwright,restassured
/qa-pipeline --id "specs/user-story.pdf" --tool restassured

# Filenames with spaces or special characters — quotes are required
/qa-pipeline --id "Petstore — Browse and Manage Pets (UI + API).txt" --tool playwright,restassured
```

When `--source` is omitted, the pipeline treats `--id` as a file path.

## Supported formats

| Format | Extension | What you need |
|---|---|---|
| Markdown | `.md` | Nothing — works out of the box |
| Plain text | `.txt`, `.text` | Nothing — works out of the box |
| Word | `.docx` | `npm install mammoth` |
| Word (legacy) | `.doc` | `npm install word-extractor` |
| PDF | `.pdf` | `npm install pdf-parse@1.1.1` |

Optional dependencies are loaded at runtime — install only what you need. If a required package is missing, the pipeline prints an actionable install command and stops.

> **Tip:** If you have a `.rtf` file, open it in any text editor (TextEdit → Format → Make Plain Text) and save as `.txt` — plain text works perfectly and requires no extra setup. RTF is not a supported format.

## How it works

The file is parsed using the same extraction logic as IMS sources — acceptance criteria, test URLs, API endpoints, credentials, and priority are all pulled from the text using structured headings and patterns.

If your file doesn't use structured headings (common with Word docs and PDFs), the pipeline falls back to the full text and infers test scenarios from it directly.

## Writing requirements for the best results

For structured extraction, use these headings in your file:

```markdown
# Login Feature

## Summary
Users can log in with valid credentials and are redirected to the dashboard.

## Acceptance Criteria
- [ ] Valid credentials redirect to /dashboard
- [ ] Invalid password shows "Incorrect credentials" error
- [ ] Locked account shows "Account locked" message

## Test URL
https://staging.myapp.com/login

## API Endpoint
POST /api/auth/login

## Credentials
| Role  | Username        | Password   |
|-------|-----------------|------------|
| Admin | admin@test.com  | Admin@123  |
| User  | user@test.com   | User@123   |
```

Unstructured plain prose also works — the pipeline reads the full text and extracts scenarios from it.

## Differences from IMS mode

| Behaviour | IMS mode | File mode |
|---|---|---|
| Requires `--source` | Yes | No |
| Requires credentials in `.env` | Yes (per source) | No |
| Comments back to original ticket | Yes | Skipped — no remote ticket |
| `issueId` for file naming | From ticket ID | From filename (without extension) |
| AC parsing | From structured ticket fields | From headings or full text |

## File naming and issueId

The filename (without extension) is sanitized and used as the `issueId` throughout the pipeline — for log files, report files, and test case IDs. Sanitization lowercases the name and replaces any non-alphanumeric characters (spaces, dashes, dots, parentheses, special chars) with hyphens.

```
"Petstore — Browse and Manage Pets (UI + API).txt"
→ issueId: "petstore-browse-and-manage-pets-ui-api"
→ reports/results-petstore-browse-and-manage-pets-ui-api.json
→ logs/pipeline-petstore-browse-and-manage-pets-ui-api-2026-05-27.log
```

This means filenames with spaces or special characters work safely — always pass them in double quotes.
