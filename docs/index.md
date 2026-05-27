---
layout: home

hero:
  name: "swayambhu-qa"
  text: "Agentic AI QA Pipeline"
  tagline: Give it a ticket. Get back a passing test suite. In under 30 minutes.
  image:
    src: /logo-icon.svg
    alt: swayambhu-qa
  actions:
    - theme: brand
      text: Get Started →
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/yoggit/swayambhu-qa

features:
  - icon: 🎫
    title: Ticket to tests — end to end
    details: One command takes any JIRA or GitHub issue all the way to a green test suite, logged bugs, and a Draft PR. No manual steps in between.
  - icon: 🤖
    title: 8 specialized agents
    details: Pipeline, create test cases, generate from URL, automate from TMS, heal failures, bug-to-regression, analyze flaky, and QA report — each agent handles one job well.
  - icon: 🔧
    title: Playwright + REST Assured
    details: UI tests in Playwright TypeScript. API tests in REST Assured Java. Run them together with a single flag — playwright,restassured.
  - icon: 🩹
    title: Self-healing on failures
    details: When tests fail due to selector drift or timing, the pipeline auto-fixes them and re-runs. Real bugs get logged to your issue tracker.
  - icon: 📋
    title: TMS integration
    details: Push test cases to Xray and pull back results automatically. Or use markdown mode — no TMS credentials needed to get started.
  - icon: 📄
    title: No IMS? No problem.
    details: No JIRA, no GitHub, no credentials. Pass a local .md, .txt, .docx, .doc, or .pdf file as input and the pipeline reads your requirements directly from it.
  - icon: 🔁
    title: Re-run aware
    details: Already pushed test cases to your TMS? The pipeline detects that and skips re-creating duplicates — just runs the existing tests and updates execution results.
---

## How It Works

```
/qa-pipeline --id TEST-22 --source jira --tool playwright,restassured
        │
        ├── Phase 1: Fetch ticket (requirement, ACs, URLs)
        │
        ├── Phase 2: ┌─ UI tools  → Scrape live app for DOM selectors & form fields
        │            └─ API tools → Read API URL / Swagger / OpenAPI docs from ticket
        │
        ├── Phase 3: Generate test cases → push to Xray
        │           ↳ Human review pause (approve or redirect)
        │
        ├── Phase 4: ┌─ UI tools  → Write Playwright / Cypress / Selenium specs
        │            └─ API tools → Write REST Assured / Robot API specs
        │
        ├── Phase 5: Run all specs
        ├── Phase 6: ┌─ UI  → Heal broken selectors, timing issues
        │            └─ API → Heal auth errors, wrong base URL, schema mismatches
        ├── Phase 7: Log confirmed bugs back to JIRA
        ├── Phase 8: Push results to Xray → create Test Execution
        └── Phase 9: Open Draft PR with test files
```

## Quick Install

```bash
npm install --save-dev @swayambhu-qa/core
npx @swayambhu-qa/core init
```

Then open Claude Code and run:

```bash
# From a JIRA ticket
/qa-pipeline --id TEST-22 --source jira --tool playwright

# Or from a local file — no credentials needed
/qa-pipeline --id "./my-feature.txt" --tool playwright
```

→ [Full setup guide](/guide/getting-started)

## Supported Today

| Category | What works |
|---|---|
| Issue sources | JIRA ✅, GitHub Issues ✅, Local file (`.md` `.txt` `.docx` `.doc` `.pdf`) ✅ |
| Test tools | Playwright ✅, REST Assured ✅ |
| TMS | Xray ✅, Markdown (local) ✅ |
| Combined runs | `--tool playwright,restassured` ✅ |
