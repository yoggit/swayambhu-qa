# Future Enhancements

Contributions welcome — open an issue or PR at [github.com/yoggit/swayambhu-qa](https://github.com/yoggit/swayambhu-qa).

## Test Runner Support

| Tool | Status |
|---|---|
| Playwright + TypeScript | ✅ Supported |
| REST Assured + Java | ✅ Supported |
| Cypress + TypeScript | ✅ Supported |
| Selenium (TestNG / JUnit / Cucumber) | ✅ Supported |
| Robot Framework (UI / API) | ✅ Supported |

## Issue Source Support

| Source | Status |
|---|---|
| JIRA | ✅ Supported |
| GitHub Issues | ✅ Supported |
| Azure DevOps | ✅ Supported |
| Linear | ✅ Supported |

## Test Management System

| TMS | Status |
|---|---|
| Xray (JIRA plugin) | ✅ Supported |
| Markdown (local files) | ✅ Supported |
| TestRail | ✅ Supported |

## Pipeline Features

| Feature | Status |
|---|---|
| Multi-tool combined runs (`playwright,restassured`) | ✅ Supported |
| Re-run detection (no duplicate TCs in TMS) | ✅ Supported |
| Multi-issue runs (`--id TEST-22,TEST-62`) | ✅ Supported |
| CI/CD integration (GitHub Actions) | 🔜 Planned |
| Zero Setup Mode — sample story generation when no `--id` is provided | ✅ Supported |
| Project scaffolding — auto-generate `package.json`, `playwright.config.ts`, `pom.xml` etc. for empty projects | ✅ Supported |

## AI Tool Agnostic Support

Right now swayambhu-qa runs inside Claude Code. The vision is to support any AI coding assistant — so teams using GitHub Copilot, Cursor, Gemini CLI, or Continue.dev can run the same pipeline without switching tools.

The foundation is already in place: swayambhu-qa ships an MCP server (`src/mcp/index.ts`), and MCP is becoming a cross-tool standard.

| Tool | MCP Support | Agent/Filesystem Access | Target |
|---|---|---|---|
| Claude Code | ✅ Native | ✅ Full | ✅ Current |
| Cursor | ✅ Supported | ✅ Full | 🔜 Planned |
| Continue.dev | ✅ Supported | ✅ Full | 🔜 Planned |
| GitHub Copilot | 🔜 Rolling out | ✅ Agent mode | 🔜 Planned |
| Gemini CLI | ✅ Supported | ✅ Full | 🔜 Planned |
| ChatGPT / Gemini Web | ❌ No local access | ❌ | Not planned |

### What needs to be built

1. **Flesh out the MCP server** — expose each pipeline phase as a named MCP tool with proper input schemas
2. **Universal orchestration prompt** — a tool-agnostic version of the pipeline instructions that works across assistants
3. **Per-tool setup guides** — how to wire up swayambhu-qa in Cursor, Copilot, Continue.dev

The execution scripts (`swayambhu-fetch`, `swayambhu-scrape`, etc.) are already AI-agnostic — they're plain Node.js. Only the orchestration layer needs to be ported.

This is a post-v1.0 milestone, tracked in [github.com/yoggit/swayambhu-qa](https://github.com/yoggit/swayambhu-qa).
