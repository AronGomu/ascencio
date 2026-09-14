# T4 repair — retry1

**State: done; independent acceptance pending.** Review `artifacts/T4-REPAIR-EVIDENCE/repair-source.diff`, rerun `commands.json` checks. T5 not started.

## Checked result

- R1 Historic predecessor uses `verifyProgressiveRelease(root, previousRun, false)` at `scripts/lib/asset-delivery/progressive-producer.ts:155`; archived object integrity still checked. Current-candidate freshness remains enabled by publisher. Changed-source successor regression at `tests/progressive-producer.test.ts:253` proves sequence 2 succeeds, corrupt historic object rejects, stale current verify/publish rejects before remote calls.
- R2 `parseFrozenInventory` replaces unchecked cast at `scripts/lib/asset-delivery/progressive-producer.ts:295`. Shared `deriveProgressiveManifest` at `scripts/lib/asset-delivery/progressive-manifest.ts:69` derives complete sorted roster: path, version, bytes, MIME, role, required, packIds; chapter descriptors/dependency closure; runtime snapshot. Canonical full-manifest equality precedes payload-object reads at producer `:304`. Omission/ownership/MIME/descriptor/schema regressions reject verify in both freshness modes, publish before SDK calls.
- R3 Same-length immutable collision at `tests/progressive-publisher.test.ts:344`: copy candidate bytes, flip one byte, prove equal length/different SHA-256, assert `PUBLISH_IMMUTABLE_CONFLICT`, exactly one GET for key, unchanged remote bytes, absent latest pointer. Publisher implementation unchanged; prior short-length collision test retained.

## Red → green evidence

- V1 `node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts`: red exit **1**, **10 failures/11 passes**. R1 exact failure `CONTENT_SOURCE_STALE`; nine R2 failures `Missing expected rejection.`. Existing 10 tests pass. New R3 test already passes correct implementation; no artificial R3 red claim. Output: `artifacts/T4-REPAIR-EVIDENCE/red-node-tests.log`.
- V2 `node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts tests/asset-delivery-bundle.test.ts tests/asset-delivery-metadata-repairs.test.ts`: green exit **0**, **55/55**. Includes prior 10 focused tests, 11 added regressions, prior 34 bundle/metadata regressions, existing real CLI fixture. Output: `green-node-tests.log` under evidence dir.
- V3 `npx vitest run tests/unit/progressive-manifest.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose`: exit **0**, **41/41**, 2 files. Includes existing 50,000-entry acceptance/50,001 rejection. Output: `green-vitest.log`.
- V4 `npm run typecheck`: exit **0**, `svelte-check found 0 errors and 4 warnings in 3 files`. Existing warnings: CSS `line-clamp` in `src/story/shop/ShopSellScreen.svelte:240`; unused `content`/`gameplay` exports in `tests/fixtures/BattleFacadeProbe.svelte:8-9`; unused `catalogInput` in `tests/fixtures/DeckEditorProbe.svelte:4`. Output: `typecheck.log`.
- V5 Targeted Prettier/ESLint, `git diff --check`, staging check pass. Exact commands, exit codes, output paths: `artifacts/T4-REPAIR-EVIDENCE/commands.json`. Baseline SHA check: **2015 tracked files unchanged from repair start**; pre-existing tracked T4 changes preserved; **0 staged paths**. Output: `preservation.log`.

## Changed files

- F1 `scripts/lib/asset-delivery/progressive-producer.ts` — historic freshness separation; shared derivation/full comparison; remove now-owned derivation duplication.
- F2 `scripts/lib/asset-delivery/progressive-manifest.ts` — new focused pure producer/verifier derivation, existing ownership/MIME/descriptor rules preserved.
- F3 `tests/progressive-producer.test.ts` — changed-source successor; eight canonical manifest corruption cases; invalid inventory case. Synthetic invalid metadata replaced with existing `prepared` fixture imported unchanged from `tests/fixtures/asset-delivery-bundle.ts`; fixture passes real `parseFrozenInventory`.
- F4 `tests/progressive-publisher.test.ts` — same-length collision regression; same valid fixture replacement. Existing tests retained.
- F5 Task artifacts: `artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md`; `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T4_per-file-producer.md`; this report; `artifacts/T4-REPAIR-EVIDENCE/` logs/exit codes/before snapshots/diff/baseline hashes/recheck script/command index.

## Assumptions

- A1 Parent-approved R1: previousRun binds historic manifest identity/integrity, not historic inputs against current workspace. Candidate verify/publish retains source freshness.
- A2 Existing `parseFrozenInventory` supports exact current `FrozenInventory`; parser/metadata contracts remain unchanged. Test fixtures now honor contracts; no parser weakening.
- A3 Inventory derives content-controlled manifest fields. `releaseSequence`/`coreRange` remain explicit pack inputs; verifier retains validated manifest values for derivation because inventory stores neither. Existing pointer/candidate hash/sequence consistency checks remain intact.
- A4 Inventory/candidate metadata unsigned/local. Complete consistency does not authenticate jointly replaced inventory plus manifest; signing outside T4.

## Routing / parent decision

- P1 Parent explicitly accepted `artifacts/REVIEW-T4.md` R1/R2/R3. Failed Sol-high T4 acceptance → retry1 `openai-codex/gpt-6-astra:high`, parent-verified launch per N3. No runtime-metadata question, subagents, commits, staging, deployment, live remote calls.
- P2 Historical source-preservation baseline P1 accepted, untouched. T1–T3 source/tests unchanged; existing CLI fixture file byte-identical to repair-start baseline. No T5 implementation or optional polish.
- P3 Next decision belongs parent/reviewer: accept bounded repair after independent review. Ticket review checkbox stays unchecked until review evidence exists.

## Residual risks / skipped checks

- K1 T8 semantic validation still absent; live CLI remains blocked by `PUBLISH_SEMANTIC_VALIDATION_REQUIRED`. Real R2/account policy/owner credentials untested; no remote effects.
- K2 Full app/browser suite not run; requested focused acceptance checks only. Four pre-existing typecheck warnings untouched.
- K3 Graphify refresh exits 0; existing curated-node warnings retained in `graphify-update.log`. Generated graph remains ignored; no source-contract edits.
- K4 Existing Node fixture helpers use OS-temp directories without per-root cleanup; no uncertain/wildcard deletion attempted. Removed paths: none. Evidence snapshots retained as deliverables; unrelated workspace files untouched.

**Next action:** open `artifacts/T4-REPAIR-EVIDENCE/repair-source.diff` for independent R1–R3 review.
