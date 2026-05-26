# zero-to-green — Slide Deck Content
# 14 slides · LinkedIn carousel / PDF presentation
# Style: Dark navy background, bold colorful headings, rounded cards
# Colors: Heading blue #7C9EFF, accent green #4ADE80, accent coral #F87171, accent yellow #FACC15

---

## SLIDE 1 — Cover

```
🤖  [robot emoji, centered]

Give it a ticket.
Get back a passing test suite.

One command. Full QA lifecycle —
GitHub Issue to Draft PR. In 30 minutes.

/qa-pipeline 1

Swipe to see how >>>
```

**Layout:** Centered. Title in large bold blue/lavender. Subtitle in grey. Command in monospace rounded pill. CTA at bottom in muted grey.

---

## SLIDE 2 — The Problem

**Heading (coral/pink bold):**
The problem? Repetitive QA kills productivity.

**Subtext:**
Every time I work on a ticket, I follow the exact same steps:

**Rows (label left, time right in coral):**
```
Read & understand the requirement         20 min
Explore the UI and gather test data       15 min
Write 8–12 test cases in TestRail         45–60 min
Write Playwright automation tests         2–3 hrs
Write REST Assured API tests              1–2 hrs
Update the ticket with test summary       10 min
Create PR with documentation              15 min
```

**Bottom banner (dark red, coral text):**
```
4–5 hours  per ticket. Every. Single. Time.
```

---

## SLIDE 3 — What if AI agents could handle the repetitive parts?

**Heading (teal/green bold):**
What if AI agents could handle the repetitive parts?

**Subtext:**
I keep the judgment calls. The agents handle the grunt work.

**Before → After rows:**
```
❌ Read ticket manually           →   ✅  Agent reads GitHub Issue
❌ Write test cases by hand       →   ✅  Agent generates TestRail-style TCs
❌ Write Playwright tests          →   ✅  Agent writes matching repo patterns
❌ Write REST Assured tests       →   ✅  Agent writes Java API tests
❌ Log bugs in JIRA               →   ✅  Agent creates GitHub bug Issues
❌ Create PR manually             →   ✅  Agent opens Draft PR + docs
```

**Note:** Left column: dark card, strikethrough coral text. Right column: green card, teal text.

---

## SLIDE 4 — Meet zero-to-green

**Heading (lavender blue bold):**
Meet zero-to-green

**Subtext:**
6 AI slash commands. 2 test frameworks. 1 command to rule them all.

**Integration pills (2×2 grid):**
```
🔵  GitHub Issues (JIRA replacement)     🟣  GitHub MCP
🟢  Playwright + TypeScript              🟡  REST Assured + Java
```

**Agent cards (3 columns):**
```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Scraper Agent   │  │  Test Case Agent  │  │ Automation Agent │
│  Reads ticket    │  │  Generates TCs    │  │  Writes tests    │
│  Scrapes UI      │  │  Pauses for       │  │  Runs suites     │
│                  │  │  human review     │  │  Creates PR      │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## SLIDE 5 — How the pipeline flows

**Heading (lavender blue bold):**
How the pipeline flows

**Numbered steps (vertical timeline):**
```
① [green]   Read the ticket
            Agent reads GitHub Issue — extracts ACs, URLs, credentials, priority

② [yellow]  Scrape + Test Cases   ⏸ HUMAN PAUSE
            Scrapes UI · Generates 10 TestRail-style test cases · You review

③ [blue]    Automate (parallel)
            Playwright .spec.ts + REST Assured Java tests — written simultaneously

④ [purple]  Run · Heal · Report
            Runs both suites · Auto-fixes failures · Classifies real bugs

⑤ [coral]   Bug + PR
            Logs defects as GitHub Issues · Comments on ticket · Draft PR created
```

**Footer (italic grey):**
Full traceability: Requirement → Test Cases → Automated Tests → Bug Reports → PR

---

## SLIDE 6 — Phase 1–2: Read & Scrape

**Step badge:** ① green circle

**Heading:** Read the Requirement

```
>  Reads GitHub Issue via gh CLI
>  Extracts: title, acceptance criteria, UI URL, API endpoints, credentials, priority
>  Prints one-line summary:
   📋 Issue #1: "User Login" | Priority: P1 | UI: qaplayground.com/bank | API: 2 endpoints
>  Runs scrape-page.ts against the UI URL
>  Extracts: forms, inputs, buttons, selectors, test IDs
```

**Step badge:** ② yellow circle

**Heading:** Scrape the UI

```
>  Navigates to the page with Playwright
>  Discovers all interactive elements
>  Captures data-testid selectors (best-in-class for stability)
>  Output → structured JSON snapshot used by all downstream agents
```

---

## SLIDE 7 — Phase 3: Generate Test Cases

**Both agents note (italic top):** Human checkpoint before any code is written

**Step badge:** ③ blue circle

**Heading:** Generate Test Cases

```
>  Writes 8–12 TestRail-style test cases to test-cases/TC-1-*.md
>  Covers: Happy Path · Negative / Edge Cases · Role-based · API · Accessibility
>  Format mirrors Xray / Zephyr / TestRail — with IDs, steps, expected results

⏸  PAUSES HERE

   "Here are the 10 test cases I'll automate.
    Review them — any changes before I write the code?"

>  Waits for human confirmation before Phase 4
```

**Bottom banner (green border, green text):**
```
Human-in-the-loop — you approve test cases before a single line of code is written
```

---

## SLIDE 8 — Phase 4: Automate in Parallel

**Top note (italic grey):** Both agents run simultaneously

**Left card — Playwright Agent:**
```
🎭  Playwright Agent

>  Writes tests/generated/<feature>.spec.ts
>  Uses data-testid selectors (from scrape)
>  Groups: Happy Path · Negative · Accessibility
>  Web-first assertions only (toBeVisible, toHaveURL)
>  No waitForTimeout — ever
>  Validates: npx playwright test --list
```

**Right card — REST Assured Agent:**
```
☕  REST Assured Agent

>  Writes api-tests/.../generated/<Name>ApiTest.java
>  TestNG + Allure annotations
>  Covers each endpoint from the ticket
>  Status codes + response body assertions
>  Validates: mvn test-compile
```

**Tags at bottom:**
`Playwright`  `TypeScript`  `REST Assured`  `Java 21`  `Maven`  `Allure`

---

## SLIDE 9 — Phase 5–6: Run & Heal

**Step badge:** ⑤ purple circle

**Heading:** Run the Suite

```
>  Playwright: chromium · firefox · webkit · mobile-chrome
>  REST Assured: mvn test -Dtest=<Name>ApiTest
>  Collects: passed · failed · flaky (retried) per suite
```

**Step badge:** ⑥ coral circle

**Heading:** Analyze & Heal Failures

```
>  Classifies each failure:
   selector issue → fixes selector automatically
   timing issue   → removes waitForTimeout, uses web-first assertions
   logic issue    → flags for human review (does not auto-fix)
   real bug       → escalates to Phase 7

>  Re-runs fixed tests to confirm green
>  Marks confirmed bugs with test.fail() as regression trackers
```

---

## SLIDE 10 — Phase 7–8: Log Bugs & Update Ticket

**Step badge:** ⑦ yellow circle

**Heading:** Log Defects as GitHub Issues

```
>  For each confirmed bug (not a test setup issue):
   gh issue create --label "bug" --title "[BUG] ..."

>  Bug report includes:
   Severity · AC violated · Steps to reproduce
   Failing test path · Error message

>  Real example from our demo run:
   Issue #2 — [BUG] Logout button does not navigate user back to login page
```

**Step badge:** ⑧ blue circle

**Heading:** Comment Test Summary on Original Ticket

```
>  Posts structured QA report as comment on Issue #1:
   ✅ Results table (Playwright + REST Assured)
   ✅ Acceptance criteria coverage mapping
   ✅ List of all bug issues logged
   ✅ Links to all test files
```

---

## SLIDE 11 — Phase 9: Protected Branch + Draft PR

**Step badge:** ⑨ green circle

**Heading:** Create Draft PR

```
>  Creates branch:  qa/secure-bank-login-issue-1
>  Commits:         test cases + Playwright + REST Assured files
>  Pushes to:       origin (never touches main directly)
>  Opens Draft PR:  cannot be merged without human approval
```

**Flow diagram:**
```
Agent creates branch
        ↓
Pushes test code
        ↓
Opens Draft PR  ──────────────────────────────────────┐
        ↓                                              │
⏸ Human reviews test cases, results & bugs            │
        ↓                                              │
Human approves (1 required)                           │
        ↓                                              │
main ✅  (protected — no force push, no direct push) ──┘
```

**Bottom banner (dark, teal text):**
```
Branch protection enforces the human checkpoint at the infrastructure level
```

---

## SLIDE 12 — The Numbers Speak

**Heading (lavender blue bold, centered):**
The numbers speak

**Stats grid (2×3 cards):**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   4–5 hrs    │  │   ~30 min    │  │    85%       │
│   [coral]    │  │   [teal]     │  │   [blue]     │
│ Manual effort│  │ With agents  │  │ Time saved   │
│  per ticket  │  │  + review    │  │              │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    $0        │  │   8–12       │  │   100%       │
│  [yellow]    │  │   [teal]     │  │  [purple]    │
│ Cost per run │  │ Test cases   │  │Traceability  │
│(uses existing│  │ per ticket   │  │ Ticket→TC→   │
│subscription) │  │              │  │ Code→PR      │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## SLIDE 13 — Type / and go

**Heading (lavender blue bold):**
Type / and go

**Subtext:**
Full pipeline or individual agents — your choice.

**Command list (monospace, left-colored border, right grey label):**
```
/qa-pipeline 1                    Full pipeline — ticket to PR

/generate-tests <url>             Scrape a page and write Playwright tests

/analyze-flaky                    Read results, classify flaky failures

/heal-tests                       Auto-fix broken selectors

/bug-to-test                      Turn a bug report into a regression test

/qa-report                        Generate shareable test results report
```

**Footer:**
```
Install:  git clone github.com/yoggit/zero-to-green
Requires: Node 18+ · Java 21 · Maven · Claude Code · GitHub CLI
```

---

## SLIDE 14 — Closing

**Heading (lavender blue bold, centered, large):**
Stop doing what AI can do for you.

**Subtext (centered grey):**
The future of QA isn't about writing more tests faster.
It's about building systems that write tests for you —
while you focus on what actually matters: quality judgment.

**Tags row:**
`Claude Code`  `GitHub MCP`  `Playwright`  `REST Assured`  `Agentic AI`

**Author card (dark rounded box, centered):**
```
Your Name
QA Engineer | Building AI-powered test automation
⭐ github.com/yoggit/zero-to-green
Drop a comment if you want to see the full setup.
```

---

# Canva / Google Slides Setup Guide

## Theme
- Background: `#0F1117` (deep navy) or `#12141F`
- Heading font: Inter Bold or Poppins Bold
- Body font: Inter Regular
- Code font: JetBrains Mono or Fira Code

## Color palette
| Use | Hex |
|-----|-----|
| Heading blue/lavender | `#7C9EFF` |
| Accent green (teal) | `#4ADE80` |
| Accent coral/red | `#F87171` |
| Accent yellow | `#FACC15` |
| Accent purple | `#A78BFA` |
| Body text | `#E2E8F0` |
| Muted / subtext | `#64748B` |
| Card background | `#1E2030` |
| Card border | `#2D3148` |

## Slide size
- LinkedIn carousel: **1080 × 1350 px** (portrait 4:5)
- Or standard: **1920 × 1080 px** (landscape 16:9)

## Card style
- Background: `#1E2030`
- Border radius: 12–16px
- Border: 1px solid `#2D3148`
- Padding: 24px

## Numbered circles
- Size: 48px diameter
- Each step gets its own color (green, yellow, blue, purple, coral)
- Font: Bold white number inside

## Code blocks
- Background: `#0D1117`
- Border-left: 3px solid the step color
- Font: JetBrains Mono, size 13–14px
- Text color: `#4ADE80` (green) for values, `#E2E8F0` for labels
