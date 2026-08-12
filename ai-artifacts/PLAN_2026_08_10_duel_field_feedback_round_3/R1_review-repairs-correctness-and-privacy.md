# R1: Review repairs — answerability, privacy hardening, load-bearing tests

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T16 (all 16 tickets shipped, HEAD `043b094`)
**Commit outcome:** No prompt can become unanswerable or be answered by accident; the projector fails closed on a privacy violation instead of relying on the client validator; four tests that could not fail become load-bearing.

## Context (self-contained)

- Goal: repair the findings of the round-3 deep review fan-out (correctness, security/privacy, tests dimensions). The scope-drift findings are handled separately in `R2_review-repairs-feedback-gaps.md` — do not touch those files for those reasons.
- This project is a browser Yu-Gi-Oh duel client. A vendored `ygopro-core` WASM engine in a dedicated Web Worker is the sole rules authority. The Svelte main thread never imports the engine and receives only clone-safe, privacy-sanitized projected state.
- The whole of round 3 exists because a targeting prompt was unanswerable by a human. Every finding below is either a new way to lose that property or a test that would not catch losing it.
- Out of scope: the four feedback-item gaps (items 5, 18, 24, 26) — those are R2. Bundle budget. The MR3 rules-profile decision. Any redesign of the selection reducer.

## Requirements

### F1 — a board-mapping failure must never leave a prompt with no surface

`src/app/prompts/interaction-spec.ts:321` pushes into `offFieldEntries` before the `board === null` branch at `:323`, so `fieldCapable` at `:354` is true even when no board exists. `src/app/prompts/prompt-surface.ts:17` then returns `"field"` without consulting `fieldRendered`. `App.svelte` renders neither `DuelField` (needs `duelBoard`) nor `PromptDialog` (needs surface `"dialog"`), so the prompt is unanswerable — only surrender or reset remain.

- When the field is not rendered, an off-field-capable prompt must fall back to the dialog surface.
- Before round 3 this fell back correctly because `fieldCapable` counted card/zone/stack choices only. Restore that guarantee without removing off-field capability when a board does exist.
- A board mapping failure already has its own blocking alert path for `layout_profile_conflict`; this fix is about every *other* mapping failure (`duplicate_card_instance`, `duplicate_physical_occupancy`, `unsupported_fixed_card`).

### F2 — hand pagination arrows must not answer the live decision

`src/app/components/DuelField.svelte:385` `INTERACTIVE_SELECTOR` lists chips, action bar, phase strip, End turn and the floating windows, but not the hand band arrows added in T8.

- Clicking `field-hand-p{player}-previous` / `-next` (rendered by `HandBand.svelte:179,190`, enabled once a hand exceeds `HAND_PAGE_SIZE`) must never reach `dismissOnOutsideClick`.
- Today, with 11+ cards and a chain prompt open, paging the hand dispatches `chooseChoice(pass)` and the chain window is lost. The same path fires `cancel` for a cancelable prompt with no visible action bar.
- The hand band viewport and page-status element must be equally inert. Prefer covering the band root so future controls inside it inherit the protection.

### F3 — the target list must not become a dead end

`src/app/components/DuelField.svelte:729` `dismissZoneList` records `dismissedTargetPromptKey`, and `synchronizeZoneList` then refuses to reopen. When every off-field choice failed to mount a launcher (`target_not_mounted`, e.g. opponent-hand addresses, which the projector emits as placeholders), `targetLaunchers` is empty and nothing can reopen the list. The first pointerdown on the confirm window trips `FloatingFieldWindow.documentPointerDown` → dismiss → unanswerable for `minimum >= 2`.

- A target-mode list with no mounted launcher must not be dismissible, or must remain reopenable by some always-present control. Choose the smaller change; the reviewer's suggestion is an early return in `dismissZoneList` when `zoneListState?.mode === "target" && targetLaunchers.size === 0`.
- Dismissal must keep working normally whenever at least one launcher exists.

### F4 — the projector must fail closed on a privacy violation

T6 relaxed `validatePublicPlayer` (`src/duel/contracts/duel-worker-event.ts:586-596`) to permit a `code` on a player-1 face-down card in `monsters`/`spellsAndTraps` only. That validator now runs on the *client*, and a rejection calls `#failWorker("invalid_worker_event")` (`src/app/DuelWorkerClient.ts:355-372`), terminating the worker and losing the duel. There is no assertion at the point of production.

- `DuelStateProjector.snapshot()` (`src/worker/projection/DuelStateProjector.ts:660`) must assert the same invariant it is required to satisfy: for `controller === 1`, `!faceUp` and `code !== undefined` implies location is a fixed field zone (monster / spellTrap / field). Throw there.
- The worker then fails on its own output before posting, rather than depending on the client to notice. Do not weaken the client validator — keep both.
- Do not change what the projector chooses to remember. This is an output assertion only.

### F5 — `card-preview.ts` comment contradicts its code

`src/app/App.svelte:679-683` still says a raw `PublicCard.code` "is not already gated on identity visibility, so the preview re-checks it here". `card-preview.ts:60` no longer re-checks anything; T6 made the projected code itself the attested capability. Replace the comment with the ADR-014 statement. Comment-only change.

### F6 — four tests that cannot fail

1. `e2e/duel-smoke.spec.ts:1538` and `:1663` — `test.skip(true, …)` when `locateDraggablePlacement` returns `null`. That is true for an unlucky seed *and* for a real regression (chips stop rendering, `data-cy` scheme changes, hand cards stop being actionable, hand band stops mounting). Both of T13's only real-browser pointer proofs then vanish silently. Apply the guard pattern this same file already uses at `:2858-2859`: assert the hand is non-empty and at least one hand card is actionable; only then allow the skip, otherwise fail.
2. `tests/integration/worker-runtime.test.ts:199-210` (and `:174-180`) — "changing decks recomputes the profile" passes even if the profile were hard-coded, because all six bundled decks are Link-free and both assertions expect `{extraMonsterZones:false}`. Add one runtime start with a synthetic Link-typed card-type map (or a test-only deck source) asserting the emitted snapshot carries `{extraMonsterZones:true}`, so the wiring is falsifiable.
3. `tests/unit/zone-list.test.ts:113` — "trusts projected code for known face-down identity" uses opponent **banished** `faceDownDefense` with a code, a state `validatePublicPlayer` rejects and `#move` deletes. Flip that fixture to `faceUpAttack`, and add the genuinely reachable case: opponent face-down `monster`/`spellTrap` carrying an attested code.
4. `tests/component/DuelHud.test.ts:59-60` — after the T6 fixture correction the concealed fixture cards no longer carry the names being asserted absent, so the zone half is vacuous. Add a positive assertion that those concealed cards render the hidden label / back art, which fails if the HUD ever resolves an identity it does not hold.

### F7 — the layout has 18 overlapping zone boxes

`tests/unit/duel-field.test.ts:123,140,154` restate the constants from `src/field/duel-field-layout.ts` verbatim, so they detect change rather than wrongness. The reviewer computed that every `p{n}:spellTrap:*` box overlaps `p{n}:hand` by 5 design px, and `p{n}:mainMonster:{1,2,3}` overlap the shared EMZs by 4 px — 18 pairs total.

- Add one property test asserting layout boxes do not overlap (or that the gap is >= 0), covering the whole `STANDARD_DUEL_FIELD_LAYOUT`.
- **Then decide, with evidence, whether the overlap is a real defect or an artifact of the hand box being a nav-only virtual rectangle since T8.** T8 stopped painting the hand zone: `HandBand` renders it, and `duel-field-layout.ts` retains the hand record for band placement and spatial navigation only. If the hand box is virtual, exclude `hand` from the property and keep the property strict for every painted zone — and say so in a comment. If painted boxes genuinely overlap, fix the geometry, not the test.
- Do not change painted geometry to satisfy a test about a virtual box. Item 16's shipped spacing (column pitch 95, row pitch 120) is user-accepted and must not regress.

## Inputs

- Reviewer findings are reproduced in full in the Requirements above; you do not need the review transcripts.
- `src/app/prompts/interaction-spec.ts`, `prompt-surface.ts`, `interaction-session.ts`
- `src/app/components/DuelField.svelte`, `duel-field/HandBand.svelte`, `duel-field/FloatingFieldWindow.svelte`, `duel-field/ZoneListDialog.svelte`
- `src/worker/projection/DuelStateProjector.ts`, `src/duel/contracts/duel-worker-event.ts`, `src/app/DuelWorkerClient.ts`, `src/app/App.svelte`
- `src/field/duel-field-layout.ts`, `src/field/off-field-target-list.ts`
- `tests/unit/{duel-field,zone-list}.test.ts`, `tests/component/{DuelField,DuelHud}.test.ts`, `tests/integration/worker-runtime.test.ts`, `e2e/duel-smoke.spec.ts`
- ADR-014 (`docs/ADR/014_ADR_public_knowledge_for_face_down_cards.md`) owns the face-down knowledge table.

### Environment facts for validation

- Playwright is chromium-only on this host:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here (`playwright.config.ts` includes an unsupported `webkit-smoke` project). Use `npm run check:headless` plus the explicit Chromium invocation.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly`. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing.
- The app opens on a deck picker; e2e must go through it as the existing specs do.

## TDD

1. **Red** — write the failing test for each finding first: a spec fixture with off-field choices and a null board expecting `"dialog"`; a hand-arrow click during a live prompt expecting zero dispatch; a launcher-less target list expecting no dismissal; a projector snapshot expecting a throw; the four test repairs; the layout property.
2. **Green** — smallest change per finding.
3. **Refactor** — none expected; do not restructure the selection reducer or the projector.

## Impl steps

- [x] 1. F1: add the failing surface test, then fix `prompt-surface.ts` (or gate `fieldCapable`), and confirm an off-field prompt still routes to `"field"` when a board exists.
  - [x] 1a. Red: a `prompt-surface` test mapping an off-field prompt with `board = null` and `fieldRendered = false` expects `"dialog"` and fails on current code. Criterion: observed failing vitest output naming that test.
  - [x] 1b. Green: fix applied; same test passes and a board-present case still returns `"field"`. Criterion: `npx vitest run tests/unit/prompt-surface.test.ts` green.
- [x] 2. F2: add the failing hand-arrow test, then extend `INTERACTIVE_SELECTOR`; assert zero `chooseChoice`/`cancel` dispatch on arrow, viewport and page-status clicks during a live prompt.
  - [x] 2a. Red: component test clicking `field-hand-p0-next` during a live cancelable prompt observes a `cancel` dispatch. Criterion: observed failing vitest output.
  - [x] 2b. Green: band root covered by `INTERACTIVE_SELECTOR`; arrow, viewport and page-status clicks dispatch nothing. Criterion: `npx vitest run tests/component/DuelField.test.ts` green.
- [x] 3. F3: add the failing launcher-less dismissal test, then guard `dismissZoneList`; assert normal dismissal still works when a launcher exists.
  - [x] 3a. Red: target list with zero mounted launchers closes on an outside pointerdown and never reopens. Criterion: observed failing vitest output.
  - [x] 3b. Green: guarded; launcher-less list survives, launcher-backed list still dismisses. Criterion: both component tests pass.
- [x] 4. F4: add the failing projector-output test, then assert the invariant in `snapshot()`; keep the client validator unchanged.
  - [x] 4a. Red: projector test driving a reachable opponent face-down-with-code state expects `snapshot()` to throw and fails. Criterion: observed failing vitest output.
  - [x] 4b. Green: assertion added in `snapshot()`; test passes and `duel-worker-event.ts` is unchanged. Criterion: vitest green + `git diff --stat` shows no change to the client validator.
- [x] 5. F5: correct the stale comment in `App.svelte`. Criterion: comment states the ADR-014 attested-code rule; no code line changes in that hunk.
- [x] 6. F6.1: replace both e2e drag skips with the count-and-assert guard. Criterion: both skips are preceded by non-empty-hand and actionable-hand-card assertions; Chromium e2e run green.
- [x] 7. F6.2: add the Link-profile runtime wiring test proving `extraMonsterZones:true` reaches the snapshot. Criterion: new integration test fails if the layout is hard-coded Link-free; `npm run test:integration` green.
- [x] 8. F6.3: repair the `zone-list` fixture and add the reachable attested-face-down case. Criterion: banished fixture is `faceUpAttack`; a new opponent face-down monster/spellTrap case with an attested code passes.
- [x] 9. F6.4: add the positive hidden-render assertion to `DuelHud.test.ts`. Criterion: assertion fails if the HUD ever resolves the concealed cards' identity; component test green.
- [x] 10. F7: add the layout non-overlap property, determine whether the hand box is virtual, and either scope the property with a comment or fix real painted overlap. Record which, and why, in the ticket file. Criterion: property test exists over the whole `STANDARD_DUEL_FIELD_LAYOUT`, the decision plus evidence is written into this file, and item 16 spacing (column pitch 95, row pitch 120) is unchanged.

## F7 decision record — the 18 overlapping boxes

Measured from `STANDARD_DUEL_FIELD_LAYOUT` itself (design px, boxes are
`CARD+10 = 82x114` centred on `x`/`y`, painted with `transform: translate(-50%,
-50%)`), the 18 pairs split into two different facts:

| pairs | overlap | verdict |
| --- | --- | --- |
| 10 x `p{n}:spellTrap:{0..4}` x `p{n}:hand` | 82px by 5px | **artifact** — the hand box is virtual |
| 8 x `p{n}:mainMonster:{1,2,3}` x `shared:extraMonster:{left,right}` | 32–37px by 4px | **chrome halo only**, not a card collision |

**The hand box is virtual, and this is verifiable, not assumed.** T8 stopped
painting the hand zone: `FieldBoard.svelte:59` filters `kind === "hand"` out of
the painted `ZoneControl` list, and `.duel-field-hand-band` (`app.css`) consumes
`--field-x`, `--field-y` and `--field-width` only — it never reads
`--field-height` and declares no border or background. The layout record's
`72px` height therefore paints nothing; it places the band and anchors spatial
navigation. Those 10 pairs are excluded from the property, with that reason
written into the test.

**The 8 EMZ pairs are painted-vs-painted, but they are not a card collision.**
The shared EMZ row is centred at the field midpoint (`y = 360`) between the two
main-monster rows (`y = 250` / `470`), i.e. 110px from each, against a 114px
box height. The 4px that overlaps is entirely the 5px-per-side chrome halo each
box adds around its card: the `72x104` card footprints keep a 6px gap. Stating
the property on the card footprint (`gap >= 0`) is exactly equivalent to "boxes
overlap by no more than the chrome they add", so the property stays strict for
every painted zone without encoding an exemption list.

Geometry was **not** changed. Removing the 4px seam needs either a smaller
chrome halo on every box or main-monster rows moved to `240`/`480`, and the
latter regresses item 16's user-accepted spacing (column pitch 95, row pitch
120), which this ticket forbids. Recorded as a residual cosmetic finding for
user disposition rather than fixed silently.

Falsifiability check: temporarily tightening the monster rows to `260`/`460`
(110px → 100px pitch) makes the new property fail with 8 real footprint
collisions; restoring the constants makes it pass again.

## Outputs

- Files edited: `src/app/prompts/prompt-surface.ts` and/or `interaction-spec.ts`, `src/app/components/DuelField.svelte`, `src/worker/projection/DuelStateProjector.ts`, `src/app/App.svelte` (comment), plus the six test files named above.
- Public API: unchanged.
- Migration / config / dependencies: none.

## Validation

- [x] `npm run test:unit -- prompt-surface interaction-spec duel-field zone-list duel-state-projector` passes — `npx vitest run tests/unit`: 66 files, 769 tests passed
- [x] `npm run test:component -- DuelField DuelHud ZoneListDialog` passes — covered by the full component run below
- [x] `npm run check:headless` exits 0 — `check:headless EXIT=0` (format, lint, `svelte-check found 0 errors and 0 warnings`, legacy 21, unit 769, integration 24, vendor/assets/snapshot ok)
- [x] `npm run test:component` passes in full — `EXIT=0`, 17 files / 294 tests
- [x] `npm run build` succeeds — `EXIT=0`, `build:verify status ok`, snapshot `a562f5ad…`
- [x] `PLAYWRIGHT_BROWSERS_PATH=… npx playwright test --project=chromium` passes in full — `EXIT=0`, 27 passed (4.3m). The first run hit two known seed flakes (`dragging a hand card…`, `responsive field compositions…`); each passed on re-run and the full re-run was green, and neither touches this diff's surface.
- [x] each of F1, F2, F3, F4 has a test observed failing before the fix and passing after:
  - F1 red `AssertionError: expected 'field' to be 'dialog'` (`tests/unit/prompt-surface.test.ts:225`) → green 14/14.
  - F2 red `expect(dispatch).not.toHaveBeenCalled()` with `Number of calls: 4`, each `{ type: "cancel" }` from the arrow/viewport/page-status clicks → green 133/133.
  - F3 red `expected null not to be null` (the launcher-less list was gone after one outside pointerdown) → green.
  - F4 red `expected [Function] to throw an error — Received: undefined` → green 67/67.
- [x] app functional — no broken path from this slice: the full Chromium walker completes a whole preset duel (`a full preset duel can be completed using keyboard controls only with one response per prompt`, 3.2m) and both real-browser pointer-drag proofs ran rather than skipped.
- [x] commit msg draft: `fix(field): close review gaps in prompt answerability and privacy`

### Falsifiability checks (each new load-bearing test was mutated to confirm it fails)

- [x] F6.1: forcing `locateDraggablePlacement` to return `null` with a regressed hand selector fails with `Error: the player hand band must mount at least one card before a drag test may skip` instead of silently skipping.
- [x] F6.2: dropping the synthetic `TYPE_LINK` bit makes the same runtime start emit `{ extraMonsterZones: false }` and the new test fails — the profile is computed, not hard-coded.
- [x] F6.4: letting `CardTray.canRevealCard` ignore `isProjectedCardIdentityKnown` fails the HUD test — the concealed-card assertions are load-bearing.
- [x] F7: tightening the main-monster rows to `260`/`460` (110px → 100px pitch) fails the property with 8 real footprint collisions; restoring the constants makes it pass.
