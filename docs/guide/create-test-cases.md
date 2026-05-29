# /create-test-cases

Reads a ticket and generates test case documents only — no automation code written. Useful when a QA lead wants to review and approve TCs in Xray before any automation starts.

## Usage

```bash
/create-test-cases --id <id> --source <src> [--tms <tms>]
```

::: tip All command combinations
Every `--tool`, `--source`, and `--tms` option in one place → [Command Combinations](/reference/commands)
:::

## Examples

```bash
# JIRA → push TCs to Xray
/create-test-cases --id TEST-22 --source jira --tms xray

# JIRA → write locally as markdown (no Xray needed)
/create-test-cases --id TEST-22 --source jira

# GitHub → push TCs to Xray
/create-test-cases --id 42 --repo myorg/myrepo --tms xray

# Local file — no IMS or credentials needed
/create-test-cases --id "./story.md"
```

## Multi-run — multiple tickets or files in one command

Pass a comma-separated list of issue IDs and/or file paths. Each entry runs sequentially with a 5-second cooldown between items.

```bash
# Three JIRA tickets at once
/create-test-cases "QA-42,QA-43,QA-44" --source jira --tms xray

# Two tickets + one local spec file (no credentials needed for the file entry)
/create-test-cases "QA-42,QA-43,./local-spec.txt" --source jira

# Multiple local files — no IMS at all
/create-test-cases "./feature-a.md,./feature-b.md"
```

A combined summary is printed after all items complete. If one item fails, it is marked ❌ and the next item starts automatically.

## What it does

1. Fetches the ticket
2. Generates test cases: Happy Path, Negative, Edge, Accessibility
3. Pushes to your TMS (or writes locally to `test-cases/`)
4. Posts a comment on the original ticket with the TC summary

## After review — automate them

Once TCs are approved in Xray, use `/automate-from-tms` to generate the automation code:

```bash
/automate-from-tms --id TEST-22 --source jira --test-mgmt xray --tool playwright
```

## vs `/qa-pipeline`

`/create-test-cases` stops after generating TCs — no automation code, no test run, no PR.  
`/qa-pipeline` does everything in one shot.

Use `/create-test-cases` when your team reviews TCs manually before automating. Use `/qa-pipeline` when you trust the pipeline to go end-to-end.
