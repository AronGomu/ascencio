# Planning context

## Goal / success

A1. Plan only. Produce index MD, standalone HTML, self-contained level-5 tickets, justified ADRs. Implementation remains NOT STARTED; no source edits, Git synchronization, publish, deploy, system apply.
A2. End-state: one canonical immutable Cards API, strict Decks sub-entrypoints, pure `src/shared-svelte-ui/`, Shell application composition as sole Content consumer, consumer semantic ports, no Content→Cards/Decks exception.
A3. Independent immutable per-file R2 objects, remote full manifest, CORE pointer only; required data gates play, optional media never gates play. Manual CORE/content approvals independent. Failed checks do not break installed offline play.
A4. Required bytes staged, semantic input verified, all supported saves migrated forward as new generation, then one atomic selector commit. Failure preserves active selector plus visible save bytes. No cross-IDB atomicity fiction.
A5. Final implementation validation: unit/component/real-WASM tests, machine import/selector checks, Chromium offline/install/update/eviction/multitab/crash evidence. Planning validation checks document structure/links/contracts/reviews, not future behavior.

## Locked user decisions

D1. Main delivery target; salvage useful T7 work, never blanket merge or discard dirty files. Root main at `25d761f` is behind origin/main by 15; origin/main and clean core-integrate snapshot reported at `010401956d...`; T7 `bf3bce5d...` divergent plus dirty. No Git mutation during planning.
D2. Explicit media download; required files first. No automatic background media reads/network repairs. Missing media: prominent warning, placeholders, null semantic result.
D3. Main Menu-only activation/CORE reload; any active domain session in any tab blocks. Preserve current duel/editor work; no forced teardown. Extend same exclusion to explicit cleanup as conservative in-scope safety default.
D4. No deployed ZIP installs need compatibility bridge. Existing bytes/saves/settings preserved; old incompatible saves remain visibly incompatible, never assigned invented release identity. Forward migration applies to supported per-file-release saves.
D5. Handoff remains binding: `artifacts/CONTENT_AND_MODULE_REARCHITECTURE_HANDOFF_2026-09-13.md`; companion Q&A. Semantic validation belongs to Cards/Decks/Story/Battle, not Shell business logic. Shell invokes validators. No historical version selector, launcher, cryptographic trust feature, generic AssetReader, downloaded executable JS, silent cleanup, vendor edits.

## Scope In / Out

I1. In: existing free-play/story/editor/collection/handoff paths, UI extraction, source/API boundary tests, producer/storage/explicit update/cleanup, save forward migration, application selector, Worker semantic initialization, relevant docs and existing manual checklist during implementation.
I2. Out: new chapters/story rewrites, economy/rules changes, asset authoring/rights acquisition, legacy ZIP migration, remote public deployment, engine/loader/vendor edits, new browser family acceptance, unrelated dirty work, full View redesign, generic framework/config systems.
I3. Publication CLI is implemented/tested against local fake R2; real publication/deployment remains operator-run outside this implementation acceptance. T1 captures prerequisites without credentials in artifacts. No claim of live R2 success from local tests.

## Assumptions

S1. Exact code names follow existing conventions; proposed contracts in tickets are binding new design, not claims already implemented. Existing algorithms reused; no one-line adapter for semantically identical primitive.
S2. Full 64-lowercase-hex SHA-256 used as per-file version. Handoff prefers digest identity, not mandatory truncation; full digest avoids collision policy. Runtime integrity remains deterministic hashes, no signing/trust infrastructure.
S3. Retain separate Story DB ownership; use copy-on-write save generations plus single Shell-owned application selector. This is proposed technical mechanism for already-approved atomic activation, not shared-DB migration. Inactive staging grants no visibility, no automatic old-byte deletion.
S4. Fresh release includes runtime plus chapter-01 required metadata. Later unavailable chapters stay unavailable. Selected chapters retain existing prefix/dependency semantics. Optional media action covers selected installed chapter closure; no new group-selection UX.
S5. One writer per cwd. T2/T4 and T6/T7 are logical parallel lanes, advisory work only concurrently in this dirty checkout. Implementation serial by default; isolated clean authorized worktrees optional, never required by this plan.

## Observed repository evidence

F1. Parent `npx vitest run tests/unit/domain-boundaries.test.ts --reporter=verbose`: 12/12 passed, 2026-09-13. Proves existing root boundary test only, not new target.
F2. Parent read T7 `src/content/install/verify-gameplay.ts:1-17,148-187`: imports `OCG_TYPE`, `hasOcgType`, `PROTOTYPE_RULESET`, `quantityLimit` from Decks internals; validates tokens, placement, quantity. Broad chapter/runtime cross-checks also live there. Preserve all checks while assigning semantic owners.
F3. Parent read T7 `src/content/storage/content-database.ts:12-20,59-102`: Content DB stores catalogs/manifests/jobs/receipts/active/invalid; `commitInstall` generation-CAS changes pointer within Content DB only. Does not atomically migrate separate Story DB.
F4. Parent read T7 `src/story/saves/story-save-contracts.ts:17-20,46-53,130-138`: Story DB `ygo-story-saves` v1, schema5 requires Content binding, schemas1–4 incompatible. `story-save-repository.ts:171-215`: per-slot revision CAS writes inside Story DB. Existing read/write/clear imports Content directly; final design removes this coupling.
F5. Parent read integration snapshot `src/shell/core/core-gate.ts:53-88`: fetches `core-bootstrap.json` before installed reads, missing delivery locks; target must read installed state before network/catalog check. Existing readiness shape carries `InstalledGameplay` and reader, not domain ports.
F6. Parent read root `src/shell/card-preview/CardPreviewPanel.svelte:8-17,48-63`: panel currently accepts `imageLibrary`, leases by code. Moving file alone is insufficient; container must own lease/data work. `card-preview-view.ts:4-25` contains code-based source and view.
F7. Root `src/decks/deck-contracts.ts:1-15,40-64` defines DeckId/DeckCardLists/DeckRecord; retain persistence shapes. `src/decks/catalog/ocg-mask.ts:7-33,74-76` defines classifications; `pinned-ruleset.ts:3-24` defines deck-owned rules. Cards gets masks/immutable data, not rules/ownership.
F8. Root package.json inspected: Node >=24, Svelte 5.56.4 range, TypeScript 6, Vite 8, Vitest 4, idb, fake-indexeddb, Playwright present. Exact scripts include `content:setup:verify`, `content:catalog`, `content:pack`, `content:verify`, `test:core`, `test:acceptance`, `check:headless`, `check:browser`, `vendor:verify`.
F9. Graph queries ran first, found source entry/parser/producer nodes but were truncated; direct source is authoritative. Graph skill/package mismatch warning remains out of scope. No graph rebuild during planning.
F10. Read attempts for `src/content/storage/content-db.ts`, `src/decks/catalog/catalog-card.ts`, `src/shell/card-preview-view.ts`, `src/battle/worker/assets/installed-runtime-source.ts`, `src/battle/worker/engine/create-core.ts` failed ENOENT. These guessed locations are not plan inputs. Correct discovered paths used; no implementation blocker inferred.

## Source scouts

R1. `artifacts/GRILL_2026_09_13_content_module_rearchitecture/scout-domain-contracts.md` — completed. Critical correction: `010401956d` target-main already has direct Content imports in Battle/Deck Editor/Decks/Story plus Content→Decks exception. Root 12/12 result is NOT target-main isolation proof. T7 adds further Story/save integration; salvage only unique useful changes.
R2. `artifacts/GRILL_2026_09_13_content_module_rearchitecture/scout-content-contracts.md` — completed. Existing producer emits ZIP; no R2 publisher implementation found. `playerPayload` supplies digest-bearing canonical logical files; reuse this seam. Existing content manifests cap below needed 50,000 entries; new full-manifest cap separate from unchanged runtime limits.
R3. Source-backed contract candidates: Cards uses existing record/text fields; Decks owns quantity/ownership/history; preview's scrollbar imports Battle geometry, requiring focused generic geometry move. Media acquisition currently blocks Story/card libraries; remove required-media gates.
R4. Service-worker waiting alone is not manual approval. Retain no skipWaiting/no clients.claim; require explicit approved target in install gate for updates. First install exempt. CORE approval must check installed content compatibility before caching candidate; old active worker survives unapproved/incompatible update. Closing/reopening menus activates only approved waiting CORE.
R5. Runtime adapter receives semantic clone-safe data; no function-valued port crosses Worker, no Content paths/receipts in Battle. Existing Worker alone initializes frozen `OcgCoreAdapter` with injected WASM bytes.

## Planning process

- [x] P1. Read handoff/Q&A; verify root branch/worktree status; run existing boundary check — evidence F1, D1.
- [x] P2. Record four user-owned rollout answers — approved Round 1 in linked ANSWERS.md.
- [x] P3. Freeze exact contracts — 60 embedded signature copies match; validator and independent coherence comparison passed. Proposed APIs syntax-checked, not implementation-typechecked.
- [x] P4. Index red-team — fresh gpt-5.6-sol:high review complete; dependency/order/scope findings dispositioned before ticket writing in REVIEW_DISPOSITIONS.md.
- [x] P5. Ticket coherence review — fresh reviewer plus bounded recheck; R1–R5/N1–N2 resolved, zero new blockers. REVIEW_COHERENCE.md records recheck evidence.
- [x] P6. ADR/HTML/document validation — 11 tickets/13 edges/60 snippets/6 ADRs pass validate-plan.mjs; Chromium desktop/mobile interaction, no overflow/network/page errors pass validate-plan-browser.mjs. Implementation remains NOT STARTED.
