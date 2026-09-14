# T7 implementation report — semantic Battle runtime injection

## State

**DONE — independent review pending.** T7 runtime path implemented. No commit, push, deploy, vendor change, system apply, or T8 work performed.

## Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| RED-first | Expected missing-module failure before implementation | `artifacts/T7-EVIDENCE/red-vitest.log`, `red-exit.json` |
| Exact ticket Vitest | 5 files, 61 tests passed | `artifacts/T7-EVIDENCE/exact-vitest.log` |
| Worker/client/facade regressions | 8 files, 120 tests passed | `artifacts/T7-EVIDENCE/regressions.log` |
| Shell/App regressions | AppShell 36/36; AppChrome 36/36 | `app-shell-regression-attempt2.log`, `app-chrome-regression-attempt2.log` |
| Shell activation/client regressions | 3 files, 66 tests passed | `shell-client-regressions.log` |
| Real WASM | Fresh-buffer, both-seat pool enforcement, Scapegoat token resolution passed | `exact-vitest.log` |
| Real Chromium Worker | ready `[11,0]` → prompt → surrender result; buffer detached; trace/screenshot retained | `real-browser.log`, `real-browser-runtime.json`, `real-browser-trace.zip`, `real-browser.png` |
| Frozen vendor | `ocgcore-wasm@0.1.2`, 21 files verified | `vendor-verify.log` |
| Typecheck | 0 errors; 4 known Svelte warnings | `typecheck.log` |
| Scoped lint/format/diff | exit 0 | `scoped-eslint.log`, `prettier-check.log`, `diff-check.log` |

## Implemented contract

T1. `BattleRuntimeInput` uses exact bounded clone-safe fields: snapshot/core/WASM/card/text/script/string/ruleset/revision data. Dense arrays, duplicates, unknown keys, detached/oversized WASM, invalid decimal race, unsupported core, incomplete required script inventory, alias gaps, invalid allowed pools reject as `BATTLE_RUNTIME_INVALID`.

T2. Shell adapter owns installed Content session acquisition, manifest/file reads, UTF-8/JSON decoding, full runtime support assembly, chapter-union `allowedCardCodes`, fresh WASM reads. Battle source tree imports no Content module. Legacy runtime activation/receipt preparation moved under `src/shell/adapters/`; obsolete Worker receipt/fallback readers removed.

T3. `DuelWorkerClient` asynchronously loads source, transfers `runtime.wasmBinary` once, aborts replaced loads, suppresses late initialization, requires same snapshot on replacement. Worker parses DTO, converts race decimal string to `bigint`, initializes frozen `OcgCoreAdapter`, validates engine version, builds runtime maps.

T4. Engine support remains whole frozen runtime while both player/opponent selections are checked against chapter pool before duel creation. Optional images no longer determine engine support; image source failures remain visible while play proceeds.

T5. Production seed path remains `createProductionSeed()`. Existing Worker projection/concealment remains unchanged; card-visibility plus opponent-deck regressions pass.

## Measurements

| Metric | Legacy baseline | Semantic runtime | Delta |
| --- | ---: | ---: | ---: |
| Node startup | 456.73 ms | 230.23 ms | -49.59% |
| Node heap delta | 196,862,920 B | 91,716,968 B | -53.41% |
| Initialize payload | 729 B | 43,049,577 B | +43,048,848 B |
| WASM | included behind legacy ref | 933,449 B, transferred | sender detached |
| Chromium Worker initialization | n/a comparable | 356.3 ms | ready `[11,0]` |

Startup/heap remain below baseline by more than 20%; no regression optimization needed. Payload increase is expected contract change: legacy command carried only installed refs, semantic command carries 14,794 cards plus 13,549 scripts. WASM transfer avoids cloning its 933,449 bytes. Payload evidence uses deterministic JSON-size proxy with WASM represented by byte length.

## Silent-failure audit

S1. `BattleRuntimeSource.load` failures surface fixed `APP_REQUIRED_INPUT_FAILED`; abort stays `AbortError`; no empty catch.

S2. Image preload catches surface `imageWarning`; Shell image adapter import rejection surfaces warning toast; optional media cannot gate engine readiness.

S3. Receipt parser/storage catches map to fixed Content integrity/storage codes. Timeout abort catch ignores only exact completed-transaction `InvalidStateError`; every other error resolves failure.

S4. Added fire-and-forget promises have rejection handling or call async functions that catch internally. Added production `|| true`: none.

## Assumptions

A1. `runtimeSnapshotId` binds frozen runtime revisions; replacement source must return same snapshot ID. Worker additionally rejects changed core/revisions inside one Worker.

A2. Existing transitional installed Content format remains input to Shell adapter until T9 selected-generation composition. No T9 selector or lifecycle lease implemented.

A3. Optional art absence may degrade display, never engine card/script support.

## Residuals

R1. Full `npm run lint` cannot start due unrelated `.tmp/worktrees/core-integrate` creating second inferred TS config root. Exact error: `No tsconfigRootDir was set, and multiple candidate TSConfigRootDirs are present`. Scoped ESLint with explicit repo `tsconfigRootDir` passes all 57 changed code files. `artifacts/T7-EVIDENCE/lint.log`.

R2. Existing full installer browser run `1f32c19c-6e2f-4dee-a809-8b7da7d4788c` fails Vite preflight before app start: `CONTENT_INVALID_MANIFEST`; direct bundle inspection reports `ASSET_INTEGRITY_FAILED` at `runtime/images-cropped/32864.jpg`. T7 did not alter producer bundle or T8 verification. Real Chromium T7 harness instead exercised actual Shell semantic adapter, generated frozen runtime files, dedicated Worker, vendored WASM, prompt/result path. `real-browser-attempt1.log`, `real-browser.log`.

R3. Graph refresh attempted once, then stopped per orchestration guidance. Gemini returned `429 RESOURCE_EXHAUSTED`; graph freshness is not product acceptance. `graphify-update.log`.

R4. Playwright content config writes historical `artifacts/CORE_ACCEPTANCE/T6/playwright-report.json`; T7 evidence was copied into `artifacts/T7-EVIDENCE/`. Existing untracked artifact tree remains otherwise preserved.

## Scope

Changed-path inventory: `artifacts/T7-EVIDENCE/changed-paths.json`. Vendor diff empty. Staging empty. Commit draft: `refactor(battle): inject semantic runtime without storage coupling`.
