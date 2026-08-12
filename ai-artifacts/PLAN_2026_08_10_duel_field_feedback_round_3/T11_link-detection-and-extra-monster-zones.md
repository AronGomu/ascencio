# T11: Link detection and conditional Extra Monster Zones

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T3, T10
**Commit outcome:** Selected pair chooses one immutable rule/layout profile at duel start. Link-free pair uses MR3 and has no shared Extra Monster Zones in core/model/DOM/nav; Link pair uses MR5 and retains both zones plus split phase strip.

## Context (self-contained)

- Goal: item 23 of `feedback.md` without creating unreachable engine choices.
- Catalog type bit `0x04000000` identifies Link monsters. All six bundled decks are Link-free; synthetic fixture covers Link mode.
- Round 2 always starts ocgcore with `EngineDuelFlag.MODE_MR5` (`0x2e800n`). Under MR5, Fusion/Synchro/Xyz monsters may legally use Extra Monster Zones. Hiding those zones only in UI would strand a legal `SELECT_PLACE` choice or occupied card.
- Safe minimal design: Link-free pair starts pinned core under MR3 (`OcgDuelMode.MODE_MR3`, verified value `0xd1800n`) and omits EMZs. Pair containing Link starts under existing MR5 and renders EMZs. Engine legality and visible geometry therefore share one immutable profile.
- Out of scope: adding a Link deck, changing profile mid-duel, current-board detection, filtering legal engine choices, silently auto-answering omitted targets.
- Assumption **A17** remains authoritative for detection. This ticket makes its rules implication explicit; render-only omission is rejected.

## Requirements

- `TYPE_LINK = 0x04000000`; detection checks main/extra/side for both selected parsed decks against active card metadata.
- Missing metadata throws `Missing card type for selected deck code: <code>`. Unknown never becomes Link-free.
- Profile is exactly:
  - no Link in either deck → `{ rules:"mr3", extraMonsterZones:false }`;
  - Link in either deck → `{ rules:"mr5", extraMonsterZones:true }`.
- Worker computes profile after T3 pair selection, before `DuelSession.create`. App never independently recomputes it.
- `DuelSession` maps `mr3` to `EngineDuelFlag.MODE_MR3 = 0xd1800n`, `mr5` to existing `MODE_MR5 = 0x2e800n`; programmed-only flags remain ORed unchanged.
- Projected public snapshot carries immutable `layout.extraMonsterZones`; contract validation requires boolean. Checkpoint/restore cannot change it.
- Mapper filters both shared EMZs before cards/nav when snapshot says false: 32 zones, no shared target/nav node/placeholder. True retains 34.
- `PhaseStrip` keeps semantic groups but uses continuous visual flow when false. T10 order remains Draw, Standby, Main 1, Battle, Main 2, End turn.
- Defensive invariant: MR3 snapshot/prompt containing monster sequence 5/6 yields typed `layout_profile_conflict`; never hide, discard, auto-pick, or generic-dialog fallback.
- Rematch keeps pair/profile. Change decks resets worker; next Start recomputes profile.

## Inputs

- **From Depends (T3):** strict selected player/opponent `DeckId` command, pair-built `DuelPreset`, replacement-worker lifecycle, rematch/change-decks flow.
- **From Depends (T10), as actually shipped in `c8e007b`:** `PHASE_SLOTS_LEFT` is exactly `draw,standby,main1,battle`; `PHASE_SLOTS_RIGHT` is exactly `main2`; `EndTurnButton` is now rendered *inside* `PhaseStrip` after the Main 2 chip, and `DuelField.svelte` no longer renders it. There is no `field-phase-chip-end`. The strip root carries `data-current-phase`. `.field-phase-strip__group--right` is anchored with `right: 1%` (anchoring it from the left pushed it over the banished/deck targets). The narrow-viewport 4rem action-bar gutter was deleted. `DuelHeaderBar` now wraps role + life in a `.duel-header-bar__meta` column. Your continuous-flow mode must preserve the shipped order Draw, Standby, Main 1, Battle, Main 2, End turn, and must keep the End button ≥44×44 px and non-overlapping with every `[data-field-target]`.
- **From T7 (`1e87e63`) — affects zone filtering and nav:** vertical arrow alignment uses horizontal span overlap (`|Δx| < (wA+wB)/2`), not exact-column equality; horizontal moves still require an exact row. The shared EMZs are the only reason several routes exist. `tests/unit/field-navigation.test.ts` has `keeps every field target reachable with arrow keys alone`, currently proving 42/42 targets. When `extraMonsterZones` is false that count legitimately drops — update the expectation to the new total and keep the property (every remaining target reachable, zero unreachable). Do not delete the test.
- **From T8 (`3f0e437`):** hands render through `HandBand.svelte`, not `ZoneControl`; hand zone rectangles no longer exist. Deck/GY x `925/1280`, Banished x `1020/1280`, hand width `462/1280`. Board fixtures live in `tests/fixtures/board-public-states`.
- **From T9 (`eb431e9`):** the duel runs in a fixed `100svh` shell (`<main>.is-duel-viewport`, `overflow:hidden`); `.duel-field` may be `overflow:auto`; the responsive stacking breakpoint is **79rem**; `.field-action-bar` lives on `.duel-field-stage`. A blocking `layout_profile_conflict` alert must be reachable in that shell — render it where the duel view would be, and make sure it is not clipped.
- **From T6 (`ced9383`):** presentation decides identity via `isProjectedCardIdentityKnown`; `grep -Rni "isCardIdentityVisible" src/app src/field` must stay empty. `PublicCard.code` means "known to the local viewer", independent of face orientation.

### Environment facts for validation

- Playwright is chromium-only on this host. Run browser checks as:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here (`playwright.config.ts` includes an unsupported `webkit-smoke` project). Use `npm run check:headless` plus the explicit Chromium invocation.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly`. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing.
- `src/worker/engine/DuelSession.ts:27-52,104-133` — duel configurations and hardcoded MR5 flags.
- `src/worker/engine/engine-constants.ts:27-31` — add pinned `MODE_MR3:0xd1800n`; retain MR5.
- `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts:394-401` — pinned adapter exposes `OcgDuelMode.MODE_MR3/MR5`.
- `src/worker/assets/active-duel-dependencies.ts` — active card records already carry numeric `type`; T2 preloads complete six-deck union.
- `src/worker/HeadlessDuelController.ts:69-78` — constructs projector from session/deck counts.
- `src/worker/projection/DuelStateProjector.ts:157-176` — add immutable layout input and snapshot output.
- `src/duel/contracts/public-duel-state.ts` and `duel-worker-event.ts` — add/validate projected layout field.
- `src/field/board-view-model.ts:152-249` — maps global 34-zone layout and nav.
- `src/field/duel-field-layout.ts:18-22,65-83` — shared ids/sequences 5/6.
- `src/app/App.svelte` — calls `mapSnapshotToBoard`; pass current `$duel.prompt` into mapper so conflict shares existing board-mapping error surface.
- `src/app/components/DuelField.svelte` — PhaseStrip call and board error surface.
- Tests: `duel-session.test.ts`, `duel-state-projector.test.ts`, `contracts.test.ts`, `duel-field.test.ts`, `PhaseStrip.test.ts`, `DuelField.test.ts`, runtime/integration suites.

## API design

New `src/duel/presets/duel-rules-profile.ts`:

```ts
export const TYPE_LINK = 0x04000000;
export type EngineMasterRule = "mr3" | "mr5";

export interface DuelRulesProfile {
  readonly rules: EngineMasterRule;
  readonly extraMonsterZones: boolean;
}

export function selectedDeckPairRulesProfile(
  player: ParsedDeck,
  opponent: ParsedDeck,
  cards: ReadonlyMap<number, { readonly type: number }>,
): DuelRulesProfile;
```

`DuelConfiguration` gains required `rules:EngineMasterRule` at runtime construction seams. Update every programmed/production fixture explicitly; no implicit MR5 default can mask a missing selection decision.

Public state gains:

```ts
readonly layout: {
  readonly extraMonsterZones: boolean;
};
```

`DuelStateProjector` receives frozen layout in constructor. `ProjectionCheckpoint` need not duplicate it because field is readonly outside mutable checkpoint state; restore cannot alter it.

Add `BoardMappingError` variant:

```ts
{
  readonly type: "layout_profile_conflict";
  readonly zoneId: "shared:extraMonster:left" | "shared:extraMonster:right";
  readonly source: "occupied" | "prompt";
}
```

Make prompt conflict path explicit:

```ts
export function mapSnapshotToBoard(
  snapshot: PublicDuelState,
  cardTexts?: ReadonlyMap<number, BoardCardText>,
  prompt?: PlayerPrompt | null,
): BoardMappingResult;
```

When `snapshot.layout.extraMonsterZones === false`, mapper checks every `prompt.choices` entry with `place` or fixed-field `card` via `mapEngineFieldAddress` **before** constructing board. Shared left/right returns `failure({ type:"layout_profile_conflict", zoneId, source:"prompt" })`. App passes `$duel.prompt`, then detects failure and derives one gate: `effectivePrompt = layoutProfileConflict ? null : $duel.prompt`. Replace every raw `$duel.prompt` consumer in App with `effectivePrompt`: interaction mapping, surface, preview status, `hasDuelPriority`, DuelField `prompt`, PromptDialog condition/key/prop, workspace PromptControls condition/key/prop, and reactive `maybeAutoResolvePrompt`. Conflict therefore yields inactive spec/surface none and cannot enter ADR-009 auto-placement. Render blocking `role="alert" data-cy="layout-profile-conflict"` with zone/source; do not render DuelField/PromptDialog or dispatch response. `resolvePromptChoiceBoardTarget` never sees null board.

`PhaseStrip.svelte` prop: `export let extraMonsterZones = true`; root uses `data-extra-monster-zones` plus `.is-continuous` when false.

## TDD

1. **Red** — pure detection/profile, exact engine flags, contract/projector field, mapper conflict, phase continuity, real-core MR3 gate.
2. **Green** — profile flows one way: selected preset → session rules/projector layout → snapshot → mapper/phase.
3. **Refactor** — remove duplicate booleans. One profile decision; no UI detector.

## Test plan

New `tests/unit/duel-rules-profile.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| no Link across both decks | Fusion/Synchro/Xyz-only extras | frozen `{rules:"mr3",extraMonsterZones:false}` |
| Link in either deck/section | one card with type bit in main, extra, side cases | MR5/true |
| combined type mask | `TYPE_LINK | otherBits` | MR5/true |
| unknown code | missing metadata | exact throw |
| bundled pair matrix | all 36 ordered six-deck pairs | MR3/false |

Extend `tests/unit/duel-session.test.ts` + fake adapter assertions:

- MR3 config passes exact `0xd1800n` plus programmed flags;
- MR5 passes exact existing `0x2e800n` plus same flags;
- constants equal pinned adapter exports in vendor contract test.

Extend projector/contracts tests:

- snapshot emits chosen immutable boolean;
- checkpoint/mutate/restore retains it;
- validator accepts booleans, rejects missing/non-boolean layout.

Extend `tests/unit/duel-field.test.ts`:

- true snapshot → 34 zones/two shared/nav aliases;
- false → 32/no shared/nav keys;
- occupied sequence 5/6 under false → `layout_profile_conflict`.

Extend component tests:

- false renders zero `[data-zone-id^="shared:extraMonster"]`, continuous phase strip, exact T10 order;
- true retains two nodes and split strip;
- `mapSnapshotToBoard(falseSnapshot,texts,promptWithPlaceSeq5)` and card-address seq6 each return exact `source:"prompt"` conflict;
- App derives null `effectivePrompt`; blocking alert renders; field/dialog prompt controls absent; with default auto settings and exact 1/1 `selectPlace`, response count remains zero after microtask flush.
- Same fixture with `showWorkspace=true` renders no workspace `PromptControls`, no prompt key/content, and still posts zero responses.

Pinned-core integration fixture (mandatory first gate): start Link-free Extra Deck summon under explicit MR3 and drive it to `SELECT_PLACE`; assert decoded legal monster mask contains no sequence 5/6. Repeat equivalent fixture under MR5 and assert core may expose shared zone where legal. This proves engine/profile contract, not opponent policy.

E2E default pair: no shared nodes; continuous phase controls have uniform adjacent gaps; no stale fixed-zone-count assertion. Synthetic browser fixture covers true mode.

## Impl steps

- [x] 1. Add exact MR3/MR5 flag contract tests; add `EngineDuelFlag.MODE_MR3 = 0xd1800n`; make `DuelConfiguration.rules` explicit; select flag in `DuelSession.create`. Run focused session tests. — criterion: `npx vitest run tests/unit/duel-session.test.ts` passes with exact `0xd1800n`/`0x2e800n` flag assertions.
- [x] 2. Build mandatory real-core MR3/MR5 placement fixture. Run red/characterization before UI work. If MR3 emits sequence 5/6, stop: pinned core violates assumed mode; do not implement visual omission. — criterion: integration fixture run prints MR3 legal monster sequences without 5/6 and MR5 with them.
- [x] 3. Add profile tests and `duel-rules-profile.ts`. Use parsed T3 preset decks + active dependency card types. No active-text-manifest join. — criterion: `npx vitest run tests/unit/duel-rules-profile.test.ts` passes including the 36-pair bundled matrix.
- [x] 4. In browser/node runtime start path, compute profile once after selected preset validation; pass `rules` to session and `extraMonsterZones` through `HeadlessDuelController` into projector. — criterion: `npm run test:integration` worker-runtime/headless suites pass and no second profile computation exists (`grep -Rn "selectedDeckPairRulesProfile" src` shows one caller).
- [x] 5. Add required public-state `layout` contract; update projector snapshot, validator, fake snapshots/fixtures. Keep profile readonly outside checkpoint state. — criterion: `npx vitest run tests/unit/duel-state-projector.test.ts tests/unit/contracts.test.ts` passes with missing/non-boolean layout rejected.
- [x] 6. Add mapper tests and optional `prompt` argument. For false profile, scan prompt choices through `mapEngineFieldAddress` before filtering; return `source:"prompt"` for place/card sequence 5/6, then separately guard occupied snapshot. Pass `$duel.prompt` from App. Do not alter `resolvePromptChoiceBoardTarget` fallback semantics for normal layouts. — criterion: `npx vitest run tests/unit/duel-field.test.ts tests/unit/field-navigation.test.ts` passes with 32-zone/no-shared and both `layout_profile_conflict` sources.
- [x] 7. Add App fixture: derive `layoutProfileConflict`, then replace all 12 baseline raw `$duel.prompt` reads with one null `effectivePrompt` (mapping, surface, status, priority, field, dialog condition/key/prop, workspace condition/key/prop, auto-resolver). Render blocking alert. Test default UI and `showWorkspace=true`; flush microtasks; assert no field/dialog/workspace prompt controls and zero dispatch. Other mapping failures retain existing behavior unless same safety argument applies. — criterion: `npx vitest run tests/component/AppChrome.test.ts` passes and the only remaining `$duel.prompt` reads in `src/app/App.svelte` are the mapper argument plus the single `effectivePrompt` derivation.
- [x] 8. Derive PhaseStrip prop only from projected board/profile. Add continuous class/data/CSS; keep semantic group order. — criterion: `npx vitest run tests/component/PhaseStrip.test.ts tests/component/DuelField.test.ts` passes with continuous strip in shipped T10 order.
- [x] 9. Verify rematch reuses same worker/profile; Change decks calls T3 reset; next Start creates worker/profile from new pair. — criterion: worker-runtime integration test proves rematch reuses one profile and change-decks recomputes it.
- [x] 10. Update e2e selectors/counts; run focused/full gates. — criterion: `npm run check:headless`, `npm run test:component`, `npm run build` and the pinned Chromium e2e command all exit 0.

## Outputs

- Files created: `src/duel/presets/duel-rules-profile.ts`, `tests/unit/duel-rules-profile.test.ts`.
- Files edited: `src/worker/engine/engine-constants.ts`, `DuelSession.ts`, `src/worker/HeadlessDuelController.ts`, browser/node runtime creation paths, `DuelStateProjector.ts`, `src/duel/contracts/public-duel-state.ts`, `duel-worker-event.ts`, `src/field/board-view-model.ts`, `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `duel-field/PhaseStrip.svelte`, prompt error seam, `src/styles/app.css`, unit/integration/component/e2e fixtures/tests.
- Public API: `DuelConfiguration.rules` required; public snapshot gains immutable `layout.extraMonsterZones`.
- Migration/config: none. Existing fixtures choose MR5 explicitly unless testing MR3.

## Validation

- [x] real pinned-core MR3 placement fixture proves no sequence 5/6 (MR3 mask `0b…11100000` → monster sequences 0-4 only; MR5 mask `0b…10000000` → 0-6) — criterion: MR3 fixture asserts zero monster sequence 5/6 in the decoded legal mask
- [x] `npm run test:unit -- duel-rules-profile duel-session duel-state-projector contracts duel-field` passes — criterion: covered by `npm run test:unit` (62 files, 681 tests) inside `npm run check:headless`
- [x] `npm run test:component -- PhaseStrip DuelField AppChrome` passes — criterion: `npm run test:component` 16 files / 233 tests, exit 0
- [x] `npm run test:integration` passes with MR3/MR5 fixture — criterion: 8 files / 23 tests inside `npm run check:headless`, exit 0
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass — criterion: covered by `npm run check:headless` exiting 0
- [x] `npm run build` succeeds — criterion: command exits 0 (`build:verify` status ok)
- [x] full chromium e2e passes using pinned command from T5 — criterion: `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium` — 24 passed
- [ ] manual default pair: no EMZ, continuous phase strip, no inaccessible choice — criterion: manual browser session (manual checklist)
- [x] synthetic Link fixture: MR5, both EMZs, split strip — criterion: `duel-field.test.ts` Link profile keeps 34 zones/two shared, `DuelField.test.ts` keeps two shared zone nodes plus split strip, `PhaseStrip.test.ts` split groups
- [ ] app functional — engine legality, projected profile, rendered zones agree — criterion: manual browser session (manual checklist)
- [x] commit msg draft: `feat(field): align conditional extra zones with engine rules` — criterion: commit `033af59` created with that exact subject
