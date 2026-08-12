# T16: Off-field target list dialog

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T6, T12, T14, T15
**Commit outcome:** Card-selection prompts targeting hand/GY/deck/banished/extra open one floating list containing only legal targets, with zone badges, green/orange halos, full-selection counter and validation-aware Confirm. Mixed prompts keep on-field targets active simultaneously.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md`.
- Covers items 28 and 29; completes the interaction model.
- Current zone list is browse-first: opening one stack shows every pile card, then joins choices by address. A target prompt needs the inverse: aggregate **only legal choices** from all off-field zones into one list.
- Current `interaction-session.ts:choicesInPromptOrder` omits `stackChoices`, so off-field choice ids can be rejected by reducer. Fix the central choice index before UI.
- Out of scope: card-action/activation browse lists (remain stack-specific), hidden-identity inference, deck-specific automated matchups, new engine choices.
- Assumptions **A12/A13/A14**: exact 1/1 submits on click; multi-select has counter+Confirm; only off-field targets use list; on-field stays in-place; mixed renders both; list outside-close only hides and can reopen; target-list mode owns its Confirm, so T14 separate confirm window is suppressed for that prompt.

## Requirements

- Off-field set is exact locations `hand`, `graveyard`, `deck`, `banished`, `extra` and only for `cardSelection` specs (`selectCard`, `selectTribute`, `selectSum`, `selectUnselectCard` as constraints permit). `monster`, `spellTrap`, `field` remain mounted targets.
- `cardAction`/chain choices in GY/etc remain browse stack lists/action chips, never target mode.
- Target window auto-opens once per new prompt key if any off-field legal choice exists.
- List includes one visual card entry per unique `(controller,location,sequence)` in first prompt order; only legal target addresses appear. Duplicate choices for one address remain individually selectable under that card.
- Entry identity comes only from sanitized projected `PublicDuelState`. Raw prompt/engine code is never used to reveal an unknown card. Missing projected record/code renders back + privacy-safe label.
- Deck prompt sequence is engine bottom-first; projected deck list is top-relative. Join with `projectedIndex = deck.length - 1 - engineSequence`, matching existing browse conversion.
- Exact zone badge text: `HAND`, `GY`, `DECK`, `BAN`, `EXTRA`; accessible label expands Banished and includes `Your`/`Opponent`.
- Legal unselected entry = T12 green; selected entry = orange; hover = orange. Mixed on-field selected card and off-field entry share one `InteractionSession`.
- Counter uses complete selection, not list-only count. Fixed: `<selected> / <maximum> selected`. Range: `<selected> selected · <minimum>–<maximum> allowed`.
- Exact 1/1: entry click dispatches `chooseChoice`, no Confirm.
- Multi: entry click dispatches `toggleChoice`; Confirm enabled iff existing `validatePromptSelection` says valid; click dispatches `confirm`; Cancel appears only when engine says cancelable.
- Target mode suppresses T14 separate `FieldActionBar` confirm window. Counter/buttons live in zone-list window.
- Outside click/X/Escape hides list without cancelling selection. Clicking any relevant highlighted hand card/stack reopens it. Prompt replacement/result closes it.
- Mixed prompt leaves mounted on-field card/zone halos/clicks usable behind nonmodal window.
- Browse mode selectors/ordering/top-of-deck semantics remain unchanged.

## Inputs

- **From Depends (T6), shipped `ced9383`:** identity is decided by `isProjectedCardIdentityKnown(card)` (presence of `PublicCard.code`), which means "known to the local viewer", independent of face orientation. `grep -Rni "isCardIdentityVisible" src/app src/field` must stay empty. Never read a code out of a prompt choice. `tests/fixtures/board-public-states` has a `concealedStateCard` helper for cards the projector could never attest — use it for opponent-hidden fixtures instead of inventing a code.
- **From Depends (T12), shipped `69ef913`:** `ZoneListEntryTile` already has the `selected` prop this ticket wires. Green = legal, orange = selected **and** list hover (they intentionally render the same `var(--warning)`; hover is a `:hover`-only rule and never mutates `is-selected`). Hover zoom is `1.35`/`120ms`, scoped `:not(.is-pinned)`. `--ink` is defined in `:root`.
- **From Depends (T14), shipped `a9b4c31`:** `FloatingFieldWindow.svelte` is the shared shell; **`ZoneListDialog` owns the primitive** and `DuelField` passes window props (`zoneListWindowPosition`, `confirmWindowPosition`, plus change callbacks, threaded through `DuelFieldErrorBoundary`). `data-cy="zone-list-dialog"` now sits on the list **body**; `role=dialog` and `aria-label` live on the window root (`floating-field-window-zoneList`). Positions persist through `src/app/stores/persisted-ui-store.ts` under `ygo.ui.v1`. `ondismiss` takes an optional event arg so pressing the pile that opened the list still toggles it. `.duel-field` no longer scrolls — `.duel-field-scroll-region` does, and window roots plus the drag ghost live outside it. The confirm window is immune to outside click and Escape.
- **From Depends (T15), shipped `88dbc04`:** `isImmediateSingleSelection(spec)` is `constraints.minimum === 1 && constraints.maximum === 1` and applies to any `cardSelection`/`placeSelection`, not just one prompt kind. `isPhaseTransitionChoice` covers `battlePhase`/`mainPhase2`/`endPhase`, and `nonPhaseGlobalChoiceCount` replaced `nonEndPhaseGlobalChoiceCount`. **When `fieldActionBarRequired` is false, no confirm window mounts at all** — so Impl step 9's suppression must assert the absence of `floating-field-window-confirm`, not merely of `field-action-bar`. Fixtures that used `battlePhase` as a stand-in "genuine global choice" were migrated to `pass`; keep that convention.
- **From T11, shipped `033af59`:** `mapSnapshotToBoard(snapshot, cardTexts?, prompt?)` may fail with `layout_profile_conflict`; App then nulls `effectivePrompt` and renders a blocking alert. Every App prompt read goes through `effectivePrompt` — if you add an App-level seam for `snapshot`/`cardTexts` (Impl step 5), it must respect that gate and not resurrect a raw `$duel.prompt` read. Link-free duels (all six bundled decks) render 32 zones with no `shared:extraMonster:*`.

### Environment facts for validation

- Playwright is chromium-only on this host. Run browser checks as:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here (`playwright.config.ts` includes an unsupported `webkit-smoke` project). Use `npm run check:headless` plus the explicit Chromium invocation.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly`. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing.
- Validation line "manual one duel per Burning Abyss/Nekroz/Shaddoll/Spellbook" is a **human** gate owed by the user. Leave it unchecked and publish it to the manual checklist; do not attempt to satisfy it yourself.
- `src/app/prompts/interaction-spec.ts:70-91` — base maps; `:214-285` — prompt loop/mapping; stack locations resolve via `card-mapping.ts`.
- `src/field/card-mapping.ts:25-31` — stack location table; `:51-67` — stack/card resolution.
- `src/app/prompts/interaction-session.ts:230-256` — choice enumeration omits stack choices and category-merges rather than explicit prompt order.
- `src/app/components/DuelField.svelte:118-134` — selection/action bar; `:282-314` — activation; `:411-423` stack state; `:484-502` list.
- `src/app/components/duel-field/ZoneListDialog.svelte` and `ZoneListEntryTile.svelte` — browse mode.
- `src/field/zone-list.ts` — reusable `ZoneListEntry` shape and privacy conventions.
- `src/field/board-view-model.ts:26-28` — `BoardCardText` only needs name.
- `validatePromptSelection(prompt,submittedChoiceIds)` already calculated in DuelField; reuse.
- No deterministic real duel guarantees every off-field/mixed prompt. Structural unit/component fixtures are required; user manually plays one duel per new deck.

## Spec/order contract

Extend `ActiveInteractionSpecBase`:

```ts
readonly offFieldChoices: readonly InteractionChoice[];
readonly choiceOrder: readonly ChoiceId[];
```

`OFF_FIELD_TARGET_LOCATIONS` exact readonly set. During `mapPromptToInteractionSpec`, loop with raw prompt index; after sanitization, append valid id to `choiceOrder`. For `kind==="cardSelection"` and valid `choice.card.location` in set, append sanitized choice to `offFieldChoices` **and continue normal board resolution** so its hand card/stack can remain a reopen launcher. Freeze both.

Export from `interaction-spec.ts`:

```ts
export function interactionChoicesInPromptOrder(
  spec: ActiveInteractionSpec,
): readonly InteractionChoice[];
```

It collects by id from card/zone/stack/global/offField, then returns ids in `spec.choiceOrder`, deduped. Update `interaction-session.ts` and FieldActionBar to use it. This fixes stack choices without duplicate submissions.

`fieldCapable` includes `offFieldChoices.length>0`. `fieldActionBarRequired` returns false for `cardSelection` when off-field choices exist — target window owns mixed/list confirmation.

## Target model

New `src/field/off-field-target-list.ts`:

```ts
export type OffFieldZoneBadge = "HAND" | "GY" | "DECK" | "BAN" | "EXTRA";

export interface OffFieldTargetEntry extends ZoneListEntry {
  readonly zoneBadge: OffFieldZoneBadge;
  readonly zoneLabel: string; // expanded owner-aware label
  readonly choices: readonly InteractionChoice[];
}

export function offFieldZoneBadge(
  location: PublicLocation,
): OffFieldZoneBadge | null;

export function offFieldTargetEntries(
  spec: ActiveInteractionSpec,
  snapshot: PublicDuelState,
  cardTexts: ReadonlyMap<number, BoardCardText>,
): readonly OffFieldTargetEntry[];
```

Algorithm:

1. iterate `interactionChoicesInPromptOrder(spec)`, retain ids also in `offFieldChoices`;
2. group first-seen by address key `controller:location:sequence`;
3. resolve projected card from correct player collection; deck uses reversed index; extra/grave/banished/hand use address sequence lookup;
4. identity known iff projected card/code exists per T6; never read code from prompt choice;
5. stable id `target:<controller>:<location>:<sequence>`; `position` is projected visual index+1; label known card name else `Face-down card`; append choices frozen.

Unknown/missing projected target is still rendered as a hidden legal target because engine prompt is authority; list must remain answerable. Address and label stay privacy-safe.

## Component contract

Generalise `ZoneListDialog`:

```ts
export let mode: "browse" | "target" = "browse";
export let title = "";
export let targetEntries: readonly OffFieldTargetEntry[] = [];
export let selectedChoiceIds: readonly ChoiceId[] = [];
export let minimum = 0;
export let maximum = 0;
export let confirmValid = false;
export let validationMessage = "";
export let cancelable = false;
export let ontargetchoice: (choice: InteractionChoice) => void;
export let onconfirm: () => void;
export let oncancel: () => void;
```

Keep browse `stack/entries/choices/onchoose`. In target mode title defaults `Select targets`; count is legal entry count.

New `data-cy`: `zone-list-entry-zone-<id>`, `zone-list-entry-target-choice-<id>-<choiceId>`, `zone-list-dialog-selection-count`, `zone-list-dialog-confirm-button`, `zone-list-dialog-cancel-button`, `zone-list-dialog-validation`. Existing root/entry/image/close values stay.

`ZoneListEntryTile` target mode renders one full-tile 44px button when one choice, or one labelled 44px button per duplicate choice. `aria-pressed` follows selected id. Browse action chips unchanged.

## TDD

1. **Red** — spec/order/model tests before UI.
2. **Green** — central choice index, target model/mode, DuelField routing.
3. **Refactor** — no second selection reducer or privacy join.

## Test plan

Extend `tests/unit/interaction-spec.test.ts`:

- every five off-field location collected for cardSelection;
- monster/spell/field excluded;
- cardAction GY choice has empty offField list;
- mixed spec has offField + mounted card choices;
- fieldCapable true with list-only target;
- choiceOrder retains raw valid prompt order;
- fieldActionBarRequired false when target mode owns confirm.

Extend `tests/unit/interaction-session.test.ts`:

- `interactionChoicesInPromptOrder` includes stack/offField;
- id appearing in stack + offField is deduped;
- mixed category choices submit in raw prompt order;
- toggle/confirm accepts offField id; stale/unknown still rejected.

New `tests/unit/off-field-target-list.test.ts`:

- badge table + unsupported field null;
- exact grouping/order across all zones;
- deck reverse sequence join;
- known projected code resolves name/code; missing/unknown stays hidden;
- duplicate choices group under one entry;
- only offFieldChoices appear; frozen outputs; owner-aware zone label.

Extend `tests/component/ZoneListDialog.test.ts`:

- browse suite unchanged;
- target renders only provided entries/badges;
- legal/selected classes and `aria-pressed`;
- one/duplicate choice button calls exact choice;
- counter exact/range text;
- Confirm absent for exact1, present/disabled-enabled for multi;
- validation text, conditional Cancel;
- outside close hides only (callbacks show no cancel).

Extend `tests/component/DuelField.test.ts`:

- list-only offField prompt auto-opens once;
- list omits untargetable cards from same piles;
- mixed list + actionable on-field card coexist;
- exact offField click choose once/no confirm;
- multi toggles/counter/Confirm returns all ids in prompt order;
- selecting on-field updates same list counter;
- closing then stack/hand launcher reopens target mode without losing selection;
- target mode suppresses separate floating confirm; browse list still stack-specific;
- prompt change closes old target list and opens only new prompt when applicable.

Update typed spec fixture builders with `offFieldChoices:[]`, `choiceOrder:[...]`.

E2E: run full random walker as regression only; do **not** add deck-specific matchup tests. If project has a deterministic component-in-browser harness, add one mixed fixture; otherwise component tests are authoritative structural automation and manual four-deck duels cover live effects.

## Impl steps

- [x] 1. Add fields/constant/order helper in `interaction-spec.ts`; add tests. Keep offField choices duplicated in launcher maps by design. — criterion: `npm run test:unit -- interaction-spec` green with off-field collection/order cases (55 tests passed)
- [x] 2. Replace private choice enumeration in `interaction-session.ts` and FieldActionBar with exported helper. Dedupe by id and sort via choiceOrder. — criterion: `interaction-session` suite green incl. stack/offField acceptance (13 tests passed); no `choicesInPromptOrder` copy left (`grep` shows only the exported helper)
- [x] 3. Add model tests/module. Implement projected collection join; deck reversal exact. — criterion: `tests/unit/off-field-target-list.test.ts` exists and passes (11 tests; deck join case asserts engine sequence 2 → position 1 and sequence 0 → position 3 in a 3-card deck)
- [x] 4. Add target-mode props/markup to ZoneListEntryTile and ZoneListDialog within T14 shell. Browse branch stays unchanged. — criterion: `npm run test:component -- ZoneListDialog` green (25 tests: 10 new target-mode + the unchanged browse suite)
- [x] 5. In DuelField derive `offFieldTargetEntries(spec,snapshot,cardTexts)`; seam chosen = precompute in App (`App.svelte` reactive `offFieldTargets`, threaded as one prop through `DuelFieldErrorBoundary`), so no `snapshot`/`cardTexts` widening and no catalog lookup in the tile. — criterion met: `npm run test:component -- DuelField` green (130 tests incl. the new off-field suite driven through the same prop)
- [x] 6. Replace `openStackId` with explicit list state `{mode:"browse",stackId}|{mode:"target",promptKey}|null`. Reactive prompt-key sync auto-opens target once; manual close records dismissed key so unrelated rerender does not reopen. — criterion: DuelField tests "opens the target window once for a list-only prompt" (asserts exactly one `floating-field-window-zoneList`) and "reopens the hidden list from a hand launcher…" (closed list stays closed across the rerenders that follow)
- [x] 7. `activateStack`/off-field hand `activateCard`: when current cardSelection has matching offField choice, open target mode; do not toggle directly. Normal browse/card-action path unchanged. — criterion: DuelField tests "reopens the hidden list from its pile launcher without losing the draft" (`aria-pressed=true` survives) and "reopens the hidden list from a hand launcher instead of toggling it" (`commands` stays empty); "keeps a browse list stack-specific for a pile with no legal target" proves browse is untouched
- [x] 8. Target callback: exact singleton→chooseChoice; multi→toggleChoice. Confirm/cancel dispatch existing reducer actions. Selected ids/counter/validation come from complete session. — criterion: DuelField tests "submits an exact one-of-one target on the first click" (`commands === [["gy-0"]]`) and "toggles a multi selection, counts it and confirms in raw prompt order" (`commands === [["gy-0","hand-1"]]` after clicking hand first); "keeps a mounted target live beside the list and counts both" proves the counter reads the complete session
- [x] 9. Change `actionBarVisible/fieldActionBarRequired` so any target-mode cardSelection suppresses T14 confirm window. On-field-only multi keeps it. — criterion: DuelField test asserts `floating-field-window-confirm` is absent in target mode; the migrated T14 window suite (on-field-only multi selection) still asserts the confirm window exists. Deviation logged below.
- [x] 10. Add badge/footer/target-button CSS with T12 precedence; keep wheel scroll/T9 image cap. — criterion: `npm run test:unit -- global-styles` green (21 tests) incl. the new `.zone-list-entry__target` 44px rule; wheel-scroll and `max-height: 50svh` rules untouched (browse wheel tests still pass)
- [x] 11. Run focused/full tests and four manual deck duels. — criterion: every automatable gate green (see Validation). The four-deck duels stay a human gate and are published to `ai-artifacts/manual_test_checklist.md`; no automated run may stand in for them.
- [x] 12. Generate/update `docs/duel-field-interaction-model-v3.html`; reference ADR-007–010 and 014–017. — criterion: doc now names `interactionChoicesInPromptOrder`, `offFieldChoices`, `choiceOrder`, the HAND/GY/DECK/BAN/EXTRA badges, both counter formats and the new `data-cy` hooks; ADR-007–010 and 014–018 links unchanged

### Deviation from the ticket contract (Impl step 9)

The Spec/order contract says `fieldActionBarRequired` returns false for any
`cardSelection` with off-field choices. Implemented as: the existing
`nonPhaseGlobalChoiceCount(spec) > 0` check runs first, so a prompt that also
carries a genuine global choice keeps its confirm window. `selectUnselectCard`
emits `Finish`/`Cancel` as global choices (`PromptRegistry.ts:460-470`) and
nothing else on the field can answer them — suppressing that window would make
an engine choice unreachable, which is the exact defect this ticket exists to
fix. Covered by the new test "is still required when a genuine global choice
accompanies the targets".

## Outputs

- Files created: `src/field/off-field-target-list.ts`, `tests/unit/off-field-target-list.test.ts`.
- Files edited: `interaction-spec.ts`, `interaction-session.ts`, `DuelField.svelte`, optionally ErrorBoundary/App for snapshot/cardTexts seam, `FieldActionBar.svelte`, `ZoneListDialog.svelte`, `ZoneListEntryTile.svelte`, app.css, focused tests/e2e regression.
- Public spec type: `offFieldChoices`, `choiceOrder`, ordered-choice helper.
- Worker/protocol/persistence: unchanged.

## Validation

- [x] `npm run test:unit -- interaction-spec interaction-session off-field-target-list global-styles` passes — 66 files / 764 tests passed
- [x] `npm run test:component -- ZoneListDialog DuelField FieldActionBar` passes — 17 files / 291 tests passed
- [x] `npm run test:unit`, `npm run test:component`, `npm run test:integration`, `npm run test:legacy` pass — unit 764, component 291, integration 23, legacy green
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass — `svelte-check found 0 errors and 0 warnings`, eslint clean, prettier clean (all inside `npm run check:headless`)
- [x] `npm run build` succeeds — `build:verify` `{"status":"ok", runtimeFiles: 243}` after the parent-authorized `initial JavaScript` budget raise 375,000 → 400,000 (measured 382,753; baseline at 88dbc04 = 374,953)
- [x] full chromium e2e passes with pinned command from T5 — `PLAYWRIGHT_BROWSERS_PATH=… npx playwright test --project=chromium` → 27 passed (2.6m), including the full-duel keyboard walker, twice on different random seeds
- [ ] manual one duel per Burning Abyss/Nekroz/Shaddoll/Spellbook; any encountered off-field/mixed target remains answerable — human gate, published to `ai-artifacts/manual_test_checklist.md`
- [x] privacy inspection: unknown opponent target DOM/snapshot has no code/name/art URL — ZoneListDialog test asserts the unattested `target:1:banished:2` tile's `outerHTML` carries no code and no card name and its image src is the card back; DuelField test asserts the same for `target:1:banished:0` (no `46986414`, no `Dark Magician`)
- [ ] app functional — browse lists, mixed target, cancel, singleton, multi all answerable — human gate in a live duel, published to `ai-artifacts/manual_test_checklist.md` (automation covers singleton/multi/mixed/browse structurally, but not a live cancel of an engine-cancelable off-field prompt)
- [x] commit msg draft: `feat(field): select off-field targets from one floating list`
