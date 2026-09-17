# Code Context

## Files Retrieved
1. `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T11_acceptance.md` — T11 R4/R5 prerequisites, exact validation commands, generated-gap blocking rule.
2. `artifacts/IMPLEMENTATION-REPORT-T1-through-T3.md` — prior residual risks; R2 says legacy `generated/card-images/archive/download-report.json` missing, now disproven by inspection.
3. `scripts/lib/asset-roots.ts:2-42` — canonical source/legacy/logical asset map.
4. `docs/assets/asset-import-pipeline.md` — pinned acquisition sources, offline regeneration, verification, rights constraints.
5. `docs/assets/asset-profiles.md:5-63` — canonical profiles, selected scope, profile commands, omission semantics.
6. `asset-profiles/nightly.json`, `asset-profiles/runtime.json`, `asset-profiles/core.json`, `asset-profiles/chapter-01.json` — tracked selection/profile inputs.
7. `package.json:scripts` — supported npm entrypoints.
8. `playwright.core.config.ts`, `playwright.acceptance.config.ts` — Chromium-only browser projects and build/preview commands.
9. `generated/content/setup-report.json` — current selected-content readiness report.
10. `generated/mvp-assets-status.json`, `generated/card-images/archive/download-report.json` — legacy acquisition status/report.

## Key Code

| Prereq | State | Source/evidence | Recovery command | Class / rights / apply |
|---|---|---|---|---|
| Canonical metadata/data | PRESENT | `assets/shared/data/current/manifest.json`; 453 files; matching legacy `generated/assets/current` | `npm run assets:mvp -- --offline` | Local regeneration; requires cached Git inputs, no account/system apply |
| Canonical runtime | PRESENT | `assets/shared/runtime/current`; 1 file | `npm run assets:mvp -- --offline` | Local regeneration; cached inputs |
| Full card images | PRESENT | `assets/shared/card-images/full`; 14,579 files; report says 215 provider-missing of 14,794 | `npm run assets:mvp -- --offline` (cannot create provider-missing bytes) | Optional media; upstream acquisition needs network, redistribution rights still required |
| Cropped card images | PARTIAL / BLOCKER for selected profile | `assets/shared/card-images/cropped`; 127 files. `generated/content/setup-report.json` records 1,591 missing selected crops | `npm run assets:images:cropped` or `npm run assets:mvp -- --offline` if cache contains them; active-only: `npm run assets:images:cropped:active` | Optional media; network/provider + rights; offline only succeeds for cached inputs |
| Card back | PRESENT | `assets/shared/card-back.jpg` | `npm run assets:card-back` | Acquisition/network + rights; no system apply |
| Set images | PRESENT archive, selected coverage uncertain | `assets/shared/set-images`; 51 files; setup report records 42 missing selected set images | `npm run assets:sets` | Network/provider + rights; no system apply |
| Engine | PRESENT | `assets/battle/engine/current`; 22 files; `npm run assets:engine:verify` source exists | `npm run assets:engine` then `npm run assets:engine:verify` | Pinned npm package; network for reacquisition; no account/system apply |
| Verification reports | PRESENT | `generated/mvp-assets-status.json` status `ready`; `generated/card-images/archive/download-report.json`; `generated/set-images/manifest.json`; `generated/content/setup-report.json` | `npm run assets:verify` (also runs set/image verifiers) | Local verification; no acquisition |
| Chromium executable | AVAILABLE through Playwright/Nix resolution | `npx playwright install --dry-run chromium` resolves Chromium 149.0.7827.55 at `/nix/store/wv98g96qwd1vcr5h9dbgpbfh2gvcy1qr-playwright-browsers/chromium-1228`; package `node_modules/playwright` resolves | `npx playwright install chromium` only if missing (downloads) | Local tool dependency; no account; installation writes outside repo; not run |
| Content delivery/host setup | MISSING, not needed for local offline acceptance | `generated/content/setup-report.json`: `HOST_SETUP_REQUIRED`; T11 explicitly says no deployed ZIP bridge | Human Cloudflare/GitHub setup, outside local recovery | Account/rights/admin secrets; no autonomous setup |
| License evidence | MISSING | `generated/content/setup-report.json`: `LICENSE_EVIDENCE_REQUIRED` | Human creates approved evidence per project policy | Human rights decision; not local generation |
| Native mobile evidence | MISSING, out of Chromium gate | `generated/content/setup-report.json`: `DEVICE_ACCESS_REQUIRED`; T11 says Chromium only | Human device testing | Device access; no code prerequisite |

## Architecture

Canonical build map is `ASSET_SOURCES` (`scripts/lib/asset-roots.ts`): source roots under `assets/`, legacy generated roots under `generated/`, browser logical paths under `runtime/`. Existing generated legacy bytes do not prove selected canonical profile completeness. Setup report is current evidence, not blindly trusted stale T1/T3 prose.

`assets:mvp` orchestrates pinned engine + Project Ignis/BabelCDB data/scripts/strings + image acquisition. `--offline` can regenerate only from existing `.cache/upstream` and image cache; current `.cache/upstream` is absent, so full offline regeneration is not presently runnable from repo state. Existing canonical/generated outputs remain available and verifiable.

T11 browser acceptance is Chromium-only: both Playwright configs define `project: chromium`; acceptance build runs `npm run vendor:verify && npm run snapshot:verify && ACCEPTANCE_SCENARIOS=1 npm run build:app ...` before preview. No Firefox/WebKit prerequisite.

## Commands Run

- `graphify query "T11 canonical assets browser prerequisites asset roots generation verification reports Chromium executables"` — passed; located asset roots, profiles, verifiers, browser config.
- `node scripts/download-mvp-assets.ts --help` — passed; supports `--offline`, `--force-images`, concurrency/rate options.
- `node scripts/sync-assets.ts --help` — failed: `Error: Unknown argument: --help` (source exposes `--offline`, `--cache-dir`, `--output`, pinned ref flags; no help flag).
- `node scripts/verify-assets.ts --help` — failed: `Usage: node scripts/verify-assets.ts [--output <directory>]` (requires output argument; `--help` unsupported).
- `node scripts/verify-images.ts --help` — passed; output JSON status `ok`, `catalogImages: 14794`, `archivedImages: 14579`, `providerMissing: 215`, `failures: []`.
- `npx playwright install --dry-run chromium` — passed; resolved Chromium 149.0.7827.55 Nix install location, no download performed.

## Assumptions

- Report uses user-stated merged baseline `e338808`; no edits or downloads performed.
- `generated/content/setup-report.json` selected-gap counts are treated as current because file exists and canonical cropped/set counts corroborate incompleteness; exact selected IDs were not massively scanned.
- Optional media remains non-gating for play per T11 contract, but T11 R5 requires generated gaps explicitly block final acceptance.

## Start Here

Open `generated/content/setup-report.json` first. It is current machine-readable readiness evidence: 1,591 cropped-image gaps, 42 set-image gaps, plus human license/host/device blockers. Then inspect `docs/assets/asset-import-pipeline.md` for offline limits and acquisition rights.

## Residual Risks

- **blocker:** selected canonical media incomplete: 1,591 cropped + 42 set images per `generated/content/setup-report.json`; final T11 acceptance cannot claim generated assets complete.
- **risk:** full offline regeneration currently lacks `.cache/upstream`; rerun `assets:mvp --offline` is safe only after caches are restored. It does not fabricate missing provider images.
- **not blocker for Chromium:** host setup, license evidence, native mobile evidence; T11 scope excludes native/mobile and deployed ZIP bridge, but publication remains rights-gated.
- **resolved prior report item:** `generated/card-images/archive/download-report.json` exists (19,185 bytes); prior T1–T3 R2 is stale/wrong for current root.

```acceptance-report
{
  "criteriaSatisfied": [
    {"id":"criterion-1","status":"satisfied","evidence":"Read T11 acceptance and T1-T3 residuals; inspected canonical roots, profiles, reports, package scripts, verifier source behavior, and Chromium resolution. Findings written with paths/severity."}
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {"command":"graphify query \"T11 canonical assets browser prerequisites asset roots generation verification reports Chromium executables\"","result":"passed","summary":"Asset/profile/verifier/browser nodes found."},
    {"command":"node scripts/download-mvp-assets.ts --help","result":"passed","summary":"Offline/acquisition options confirmed."},
    {"command":"node scripts/sync-assets.ts --help","result":"failed","summary":"Error: Unknown argument: --help"},
    {"command":"node scripts/verify-assets.ts --help","result":"failed","summary":"Usage requires --output <directory>."},
    {"command":"node scripts/verify-images.ts --help","result":"passed","summary":"14,794 catalog; 14,579 archived; 215 provider-missing; zero failures."},
    {"command":"npx playwright install --dry-run chromium","result":"passed","summary":"Chromium 149.0.7827.55 resolved in Nix store; no download."}
  ],
  "validationOutput":["Canonical full images/data/runtime/engine/reports exist; selected media remains incomplete.","Chromium executable resolution confirmed."],
  "residualRisks":["1,591 cropped and 42 set selected media gaps.",".cache/upstream absent; complete offline regeneration unavailable until cache restore.","License/host/device evidence missing; host/device outside Chromium acceptance scope."],
  "noStagedFiles": true,
  "diffSummary":"Read-only reconnaissance; no files changed.",
  "reviewFindings":["blocker: generated/content/setup-report.json - selected media gaps: 1,591 cropped, 42 set images.","resolved: generated/card-images/archive/download-report.json exists; prior T1-T3 missing-report claim stale.","info: Chromium 149.0.7827.55 executable resolves via Playwright/Nix."]
}
```