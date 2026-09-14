# T6 retry1 — B1/B2 repaired, checked; review required

## Evidence

- E1. Exact T6 command, original 120 tests + 73 additions: RED exit 1, **65 failed / 128 passed**; GREEN exit 0, **193/193**, 5 files. Logs: `artifacts/T6-REPAIR-EVIDENCE/red-vitest.log`, `green-vitest.log`. RED reports `"kind": "ready"` versus expected `"kind": "corrupt"`; malformed seals report `"STORY_STORAGE_UNAVAILABLE"` versus expected `"STORY_MIGRATION_FAILED"`, plus raw clone errors. Existing location-density/storage-error cases already passed; no fabricated RED claim.
- E2. Affected Story/Shell/admin/data-cy suites: exit 0, **819/819**, 68 files. `npm run typecheck`: exit 0, **0 errors / 4 existing warnings**. Scoped ESLint/Prettier, `git diff --check`, `git diff --cached --quiet`: exit 0. Exact commands, exits, log paths: `artifacts/T6-REPAIR-EVIDENCE/commands.json`.
- E3. Repair-only diff: `artifacts/T6-REPAIR-EVIDENCE/repair-source-tests.diff`. Pre-repair snapshots: `artifacts/T6-REPAIR-EVIDENCE/before/`. Scope proof: `scope-result.json`; **2215 baseline regular files, 2210 unchanged, 5 intentional existing-file changes, zero unexpected changes**. `.pi/skills` tracked directory symlink separately verified against HEAD. Legacy parser, T9 refusal/cards prop, integration consumers, owner feedback remain unchanged from retry1 entry.
- E4. Initial scope-check exit 1 was evidence-script bookkeeping: tracked `.pi/skills` directory symlink excluded from regular-file baseline, incorrectly counted as new. No workspace repair needed. Script now matches baseline file filtering, explicitly verifies symlink target; final scope check exits 0. Initial failure retained in `scope-check.log`.

## Implemented

- I1. **B1:** schema6 generation entry requires dense `completedChapterIds`, `locations`, `decks`, nullable `openedCards`, deck `main`/`extra`/`side`/`validation.issues`. Index enumeration checks own slots; no hole-skipping `every` acceptance. Legacy `isStoryState`/raw parser untouched. `src/story/saves/generation-envelope.ts:20,49,86-98`.
- I2. **B1 tests:** 8 sparse paths × parse/write/raw-migration = 24 cases. Parse/read reports corrupt; write returns exact `{ kind: "failed", reason: "unknown" }`; migration rejects exact `Error("STORY_MIGRATION_FAILED")`; save/generation rows remain `toStrictEqual` to pre-operation snapshots, including sparse slots. This proves unchanged IDB values, not physical browser DB-file bytes. `tests/unit/story/save-generations.test.ts:333-405`.
- I3. **B2:** `verifySeal` clones inside semantic guard, validates before `open()`/lookup. Existing strict `record`/`text`/`integer`/`array`/`literal`/`unique` helpers validate complete seal scalar fields, dense bounded slot entries, slot scalar fields, canonical slot order. Clone/shape failures map to `STORY_MIGRATION_FAILED`; actual DB failures retain storage mapping. `src/story/saves/story-migration.ts:112-121`; `src/story/saves/generation-record.ts:111-144`.
- I4. **B2 tests:** 47 malformed seal cases, including undefined/function input, undefined/function/bad scalar generation/source/revision fields, sparse/undefined slot entries. Exact semantic Error asserted; DB-open spy stays untouched. Two valid-seal tests retain unavailable/quota errors, suppress raw DB text. `tests/unit/story/save-generations.test.ts:407-477`.

## Changed files

- F1. Production: `src/story/saves/generation-envelope.ts`; `src/story/saves/generation-record.ts`; `src/story/saves/story-migration.ts`.
- F2. Tests: `tests/unit/story/save-generations.test.ts` — 73 added cases, original cases retained.
- F3. Tracking/report: `artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md`; `artifacts/IMPLEMENTATION-REPORT-T6-repair.md`.
- F4. Evidence: `artifacts/T6-REPAIR-EVIDENCE/` — baseline hashes/status/snapshots, repair diff, command runner/index/logs, preservation checker/result. No scratch files created; nothing removed. Existing unrelated dirty/untracked work preserved; whole repo not claimed clean.

## Assumptions

- A1. Parent-approved repair scope = integrity review B1/B2 only; integration review clean. T6 ticket/current report used as acceptance authority. No T7, optional polish, new domain/API behavior, historical parser expansion.
- A2. Generation IDs remain nonblank semantic strings validated by existing strict `text`; no new UUID-only contract. Release/seal revisions positive safe integers, matching current release parser. Source ID permits explicit null only.
- A3. Parent route: failed Astra-high T6 acceptance → `openai-codex/gpt-6-astra:high`, retry1 per N3. Sole root writer; no child agents, commits, staging, push, deploy, system apply. T9 interim refusal plus required `cards` prop remain parent-approved, untouched.

## Residual risks / review gate

- R1. **Independent acceptance review required.** No acceptance claimed from this report. Next action: inspect `artifacts/T6-REPAIR-EVIDENCE/repair-source-tests.diff`, rerun exact T6 command from `commands.json`.
- R2. Native Chromium not rerun for this parser/error-boundary repair; prior T6 native evidence unchanged. Added persistence tests use `fake-indexeddb`; full unrelated suites/build not run. Final lifecycle lease/selector remains T9.
- R3. Four existing typecheck warnings remain: ShopSellScreen, BattleFacadeProbe ×2, DeckEditorProbe. Affected suite emits expected failed-checkpoint-clear warning; no failing tests.
- R4. Required graphify update exits 0 but reports `semantic extraction is incomplete: 75 dispatched file(s) produced no nodes` plus pre-existing duplicate artifact node. Full output: `graphify-update.log`. Graph incompleteness is not code-validation evidence.
- R5. New catches only map clone/shape failures to specified semantic error. No silent fallback, swallowed DB failure, `|| true`, unobserved Promise, or empty catch introduced. Evidence runner redirects output into named logs, records actual exit, propagates nonzero status.
