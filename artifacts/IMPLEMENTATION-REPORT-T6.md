# T6 acceptance report — checked, review pending

## Evidence

E1. Exact ticket Vitest: **120/120**, 5 files, exit 0. Affected Story/Shell/admin/data-cy: **746/746**, 68 files, exit 0. `npm run typecheck`: **0 errors / 4 pre-existing warnings**. Targeted ESLint, Prettier, `git diff --check`, `git diff --cached --quiet`: exit 0. Exact commands + logs: `T6-EVIDENCE/final-commands.json`.

E2. Native Chromium: five-slot COW, byte-equivalent source snapshots, stored beat-ID remap 8→9, active descriptor reopen after normal clear, visible narrative, null-map placeholder → working Old Arena navigation. `T6-EVIDENCE/browser-native-result.json`, `browser-native-map.png`, `browser-native-trace.zip`; replay: `node artifacts/T6-EVIDENCE/browser-native.mjs`. Optional null set media permits pack purchase, preserving existing 150 DP price.

E3. Named tests written before implementation. Initial exact RED exit 1: missing Story ports/migration modules + forbidden Content boundary. Further RED cases caught producer metadata bounds, sparse/accessor input, concurrent prepare idempotence, handback binding loss, canonical media abort, malformed seal error mapping. Intermediate fixture/expectation mistakes retained, not mislabeled implementation failures. Logs: `T6-EVIDENCE/red-*.log`, `*-attempt*.log`, `batch*-commands.json`.

## Implemented

I1. Story owns exact semantic release/media ports, parser, continuity. Pure ports reject invalid/default/reference/conflicting duplicate definitions, normalize chapter order, preserve printing metadata. No Story import resolves into root Content. Shell staged adapter translates producer fields; optional art never gates required semantic load. `src/story/ports/parse-story-release.ts:111`, `src/shell/adapters/story-release.ts`.

I2. Story DB v2 adds `generations` + out-of-line `[generationId, slot]` `generationSaves`; old `saves` bytes untouched. Strict schema6 generation envelopes, complete source descriptor, SHA-256 seals, five supported slots/absences. Parsing/hash precede one Story transaction; source snapshot compare + inserts seal atomically. Concurrent identical prepare reuses same generation; changed source/target generates fresh UUID, never overwrites source. No grant, active pointer, selector, foreign transaction work. `src/story/saves/story-migration.ts:40`, `src/story/saves/generation-record.ts`.

I3. `verifySeal` checks descriptor + every slot/absence; `verifyActiveGeneration` checks selected descriptor, not obsolete preparation hashes after normal writes. Normal repository writes snapshot state/binding before awaits, retain CAS. List I/O rejects; read/write failures preserve contract unions. Legacy schemas 1–5 stay visibly incompatible, never guessed/migrated. `src/story/saves/story-migration.ts:112,135`, `generation-repository.ts:39,68,153,194`.

I4. StoryApp/manual/autosave/deck-open/reset, deck editor context, checkpoint/handoff, Main Menu, admin all use supplied generation repository. Checkpoint `resumeStory` preserves completed chapter binding. Admin clears only supplied generation, not whole Story DB. Legacy free-play collection remains read-only Shell translation. Exact changed-file inventory: `T6-EVIDENCE/changed-files.json`; full diff including new files: `T6-EVIDENCE/source-tests.diff`.

## Assumptions / parent decision

A1. Parent explicitly approved intermediate Story refusal when trusted semantic release/generation inputs absent. **Production Story selector injection + final lifecycle lease enforcement remain T9.** No alternate lock/selector/bootstrap generation or legacy binding bridge added. Direct component/native fixture inputs prove this slice functional; whole production Story activation not claimed. Parent reply preserved in `T6-EVIDENCE/parent-decision.md`.

A2. Parent approved additional required `cards: Cards` Story consumer prop; exact StoryRelease unchanged. Canonical Cards project through existing focused Decks catalog. `resumeStory` accompanies existing checkpoint state to preserve whole binding. First non-null Story document is current prologue new-game entry; authored stable `choice-pause` beat ID owns current choice position, not literal index 13.

A3. Legacy free-play stays operational through existing installed catalog until T7/T9. Read-only Shell `legacy-collection.ts` strips transport fields; never creates Story release/save identity. Historical legacy parser/repository tests remain intact; legacy writer removed from public root API and production consumers, source retained as historical test surface.

A4. Route/model: parent-registered `openai-codex/gpt-6-astra:high`; retry0; sole root writer. Dependencies: accepted T5 `8a0d513`, T4 `5c2ddff`, T1–T3 `e338808`. No child/commit/stage/push/deploy/system apply. Original recovery worktree untouched; pre-existing untracked artifacts preserved.

## Residuals / review gate

R1. Required independent review not yet run. Reviewer should inspect parent-approved T9 boundary, generation transaction/source-CAS code, strict seal verification, injected save consumers. No acceptance from prose alone.

R2. Native browser run is local fixture with real Chromium IDB + production Story component, not full production activation/lease E2E. Final Main Menu selection/multi-tab shared lease enforcement belongs T9; no false production-lock claim.

R3. Graphify update exited 0 but reported incomplete extraction and duplicate artifact node; log preserved. Four typecheck warnings pre-date slice (`ShopSellScreen`, BattleFacadeProbe ×2, DeckEditorProbe). Full build-budget gate/full unrelated suites not run; requested checks + affected suites passed.

R4. Error handling inventory: `T6-EVIDENCE/swallowed-error-inventory.md`. No added silent DB-list fallback. Optional media null is intentional; transaction abort rejection consumed only while original failure propagates. Scratch cleanup inventory and final staging/status evidence under `T6-EVIDENCE/`.

## Next action

N1. Parent: run independent T6 review against `T6-EVIDENCE/source-tests.diff` + `final-commands.json`; retain T9 lifecycle/selector dependency. Draft only: `feat(story): stage forward saves without overwriting progress`.
