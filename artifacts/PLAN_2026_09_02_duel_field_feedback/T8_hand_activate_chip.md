# T8: Activate chip on hover for hand monsters AND spells

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** none
**Commit outcome:** Hovering a hand card with a legal activation shows an Activate action chip (monsters and spells alike); drag-to-zone still works.

## Context (self-contained)

- Goal: owner feedback `feedback.md` § Duel Field item 10 — hand monsters with activatable abilities get no action button; spells get Set but not Activate. Drag-drop works; keyboard (pinned) works.
- This slice: remove the hover-surface `activate` filter.
- Out of scope here: selection lifecycle (T7 — independent; owner's causal guess disproven), GY triggers (T9).
- Assumptions in force: A3 — the filter is deliberate prior design (`hand-activation-choices.ts` comment: "Activation is answered by the drag-to-zone gesture"); this feedback overrides it. ADR records the reversal.

## Requirements

- `handChipChoices(choices, pinned=false)` no longer strips `action === "activate"` — hover chips show the full legal set for the card.
- Pinned/keyboard path unchanged (already full list).
- Choosing the Activate chip resolves like the pinned Activate does today (existing `oncardchoose` / `InteractionChoice` flow — no new dispatch path).

## Inputs

- `src/battle/app/prompts/hand-activation-choices.ts`: `activateChoices` at `:4-8` (untouched), `handChipChoices` filter at `:17-24`.
- Consumers: `HandBand.svelte:118-121` (in-band chips), `DuelField.svelte:1414-1419` (HandZoomOverlay hover chips).
- Engine facts (scout §c): `SELECT_IDLE_COMMAND` projection adds `activate` actions for all `message.activates` cards (`PromptRegistry.ts` ~112-156) — data already reaches the UI; only the UI filter hides it.
- Locked test: `tests/unit/hand-activation-choices.test.ts` asserts the filter — expected red→green.

## Interface contract (level 5)

- **Produces:** DELETE `handChipChoices` outright and pass `choices` straight through at both call sites (`HandBand.svelte:118-121`, `DuelField.svelte:1414-1419`), removing the import. Rationale: an identity wrapper `(choices, pinned) => choices` leaves `pinned` unused → `@typescript-eslint/no-unused-vars` fails `npm run lint` inside `check:headless`, so the keep-the-fn variant is not lint-clean. Before deleting: confirm `handChipChoices` is battle-internal and absent from the frozen export list in `tests/unit/domain-boundaries.test.ts` (expected — `src/battle/app/prompts/` is internal); if frozen, edit the list deliberately per boundary rules. `activateChoices` stays.
- **Consumes:** `InteractionChoice { id, action, label, … }` unchanged; `spec.cardChoices` map unchanged.
- **Errors:** none.
- **Invariants:** chip order stable (engine order); `cardSelection` prompts still show no chips (existing guards at call sites); drag path (`draggable` gating in `HandBand.svelte:126-129`) untouched.
- **Integration links:** trigger hover hand monster with legal activation → dispatch none (pure render) → observe Activate chip button in `CardActionChips` with existing `data-cy` chip naming → click → receive `oncardchoose` → `duel.dispatchInteraction` → engine response (already-working pinned path).

## TDD

1. **Red** — update `hand-activation-choices.test.ts`: hover list contains `activate`; component test: HandZoomOverlay for monster with only `activate` shows one chip.
2. **Green** — delete fn + inline `choices` at call sites.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| unit hand-activation-choices | delete/replace filter tests; `activateChoices` cases stay green |  |
| component HandZoomOverlay/HandBand | monster w/ only activate | Activate chip rendered |
| component | spell w/ set+activate | both chips |
| e2e | hand monster with ignition-legal effect in hand | Activate chip visible + functional |

## Impl steps

- [ ] 1. Red tests.
- [ ] 2. Delete `handChipChoices`, inline at both call sites, drop orphaned imports/tests.
- [ ] 3. e2e evidence.

## Validation

- [ ] `npm run check:headless`; component gate (NOT in check:headless): `npx vitest run tests/component/HandBand.test.ts tests/component/HandZoomOverlay.test.ts`
- [ ] manual check: hand monster effect activation via chip works end-to-end
- [ ] silent-failure sites: none
- [ ] app functional
- [ ] commit msg draft: `fix(duel-field): surface Activate on hand hover chips (reverses drag-only design)`
