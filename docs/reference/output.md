# Output Folders

The pipeline writes into these folders inside your project. All folders are created automatically on first run.

## Folder structure

| Folder | File | Description |
|---|---|---|
| `logs/` | `pipeline-latest.log` | Most recent run's structured logs — always overwritten |
| `logs/` | `pipeline-<issueId>-<date>.log` | Per-run archive — one file per execution |
| `reports/` | `tc-mapping-<issueId>.json` | Maps TC IDs to Xray/TestRail keys — used for re-run detection |
| `reports/` | `results-<issueId>.json` | Pass/fail per TC with heal details |
| `reports/` | `pw-results-<issueId>.json` | Raw Playwright JSON reporter output |
| `test-cases/` | `TC-<issueId>-<slug>.md` | Generated test cases before TMS push |
| `tests/generated/` | `<slug>.spec.ts` | Generated Playwright/Cypress spec |

## Gitignore

The project `.gitignore` excludes all generated artifacts by default:

```
logs/
test-results/
reports/results*.json
reports/pw-results*.json
reports/tc-mapping*.json
test-cases/TC-*.md
tests/generated/
```

To commit generated artifacts for an audit trail, remove the relevant lines from `.gitignore`.

## Re-run detection

`reports/tc-mapping-<issueId>.json` is the key file for re-run detection. If it exists when you run `/qa-pipeline` again with the same `--issue`, the pipeline knows TCs were already pushed to the TMS and will ask whether to re-run or regenerate.

Delete this file to force a full regeneration from scratch.
