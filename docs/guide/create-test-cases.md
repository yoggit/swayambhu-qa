# /create-test-cases

Reads a ticket and generates test case documents only — no automation code written. Useful when a QA lead wants to review and approve TCs in Xray before any automation starts.

## Usage

```bash
/create-test-cases --issue <id> --source <src> [--tms <tms>]
```

## Examples

```bash
# JIRA → push TCs to Xray
/create-test-cases --issue TEST-22 --source jira --tms xray

# JIRA → write locally as markdown (no Xray needed)
/create-test-cases --issue TEST-22 --source jira

# GitHub → push TCs to Xray
/create-test-cases --issue 42 --repo myorg/myrepo --tms xray
```

## What it does

1. Fetches the ticket
2. Generates test cases: Happy Path, Negative, Edge, Accessibility
3. Pushes to your TMS (or writes locally to `test-cases/`)
4. Posts a comment on the original ticket with the TC summary

## After review — automate them

Once TCs are approved in Xray, use `/automate-from-tms` to generate the automation code:

```bash
/automate-from-tms --issue TEST-22 --source jira --test-mgmt xray --tool playwright
```

## vs `/qa-pipeline`

`/create-test-cases` stops after generating TCs — no automation code, no test run, no PR.  
`/qa-pipeline` does everything in one shot.

Use `/create-test-cases` when your team reviews TCs manually before automating. Use `/qa-pipeline` when you trust the pipeline to go end-to-end.
