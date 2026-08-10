# T7: Zone naming and field geometry

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T1
**Commit outcome:** Visible zone labels are short and owner-neutral; the Extra Deck aligns under the Field Zone; card columns have less horizontal gap and rows have more vertical gap.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md`.
- Covers item 2 (short names, no Your/Opponent prefix), item 14 (Extra Deck under Field Zone) and item 16 (more vertical, less horizontal zone margin).
- This slice changes the normalized geometry source once. Every card, zone, stack, hit target and keyboard neighbour derives from it.
- Out of scope: hand band width/pagination (T8), phase strip placement (T10), conditional Extra Monster Zones (T11), any CSS scaling or viewport behaviour.
- Planner constants approved: five central columns move from x `440,540,640,740,840` to `450,545,640,735,830`, shrinking horizontal edge gaps from 18 px to 13 px. Monster y stays `250/470`; spell/trap y moves from `135/585` to `130/590`, growing row edge gaps from 1 px to 6 px. Extra x moves `230 → 330`, exactly matching Field x `330`.

## Requirements

- Visible labels use this exact table:

| Kind | Visible label |
| ---- | ------------- |
| Main Monster sequence 0…4 | `Monster Zone 1` … `Monster Zone 5` |
| Spell/Trap sequence 0…4 | `Spell/Trap Zone 1` … `Spell/Trap Zone 5` |
| Shared extra monster left/right | `Shared Extra Monster Zone left`, `Shared Extra Monster Zone right` |
| Field | `Field Zone` |
| Deck | `Deck` |
| Extra Deck | `Extra Deck` |
| Graveyard | `GY` |
| Banished | `Banished` |
| Hand | `Hand` |

- No player-owned visible label starts with `Your` or `Opponent`. Shared-zone wording stays explicit.
- Accessibility retains ownership. Player-0 controls announce `Your`, player-1 controls announce `Opponent`; shared controls use their visible shared label. `Monster Zone 1` announces `Your Monster Zone 1` / `Opponent Monster Zone 1`; `Spell/Trap` expands to spoken `Spell and Trap`.
- Central monster/spell columns use x centres `450, 545, 640, 735, 830` in the 1280-unit design grid.
- Opponent spell/trap row y = `130`, opponent monster y = `250`, player monster y = `470`, player spell/trap y = `590`.
- Each player's Field and Extra stack share x = `330`; the Extra stack is on that player's outer spell/trap row (`130` for opponent, `590` for player).
- Fixed field/pile zone dimensions remain `82×114` layout units; hand dimensions stay unchanged for T8. Shared Extra Monster Zones stay at x `590/690`, y `360`. Deck/GY/Banished coordinates stay unchanged until T8.
- Physical ids, engine-address mappings, target ids, cardinality (34 zones) and `min-width: 52rem` stay unchanged.

## Inputs

- `src/field/duel-field-layout.ts:113-144` — `createStandardDuelFieldLayout`; current central x is `440 + sequence * 100`, spell y `135/585`, Field x `330`, Extra x `230`, hand labels.
- `duel-field-layout.ts:146-165` — `zone(...)`; line 163 constructs `${Your|Opponent} ${label} ${sequence}`.
- `duel-field-layout.ts:167-181` — shared labels are `Shared Extra Monster Zone left/right`.
- `src/field/board-view-model.ts:152-163` — copies layout into `BoardZoneView`; `:324-330` embeds layout label in card accessible text; `:398-429` embeds it in stack labels; `:467-500` calculates nav from coordinates.
- `src/app/components/duel-field/ZoneControl.svelte:28-68` — visible span and `aria-label` both currently use `zone.label`.
- `src/app/components/duel-field/StackControl.svelte:61-121` — root `aria-label={stack.label}`; visible name is derived from `stack.zone`, not label.
- `tests/unit/duel-field.test.ts:29-57` — layout cardinality and exact p0 monster-0 coordinate; `:174+` board mapping.
- `tests/component/DuelField.test.ts` contains many accessible-name expectations with `Your Main Monster`, `Your GY`, `Opponent Deck`; update only assertions whose source is the changed layout/ARIA contract.
- **From Depends (T1):** standard round-2 physical field and tests are present.

## API design

Add to `src/field/duel-field-layout.ts`:

```ts
export function fieldZoneAccessibleName(
  zone: Pick<StandardFieldZoneLayout, "player" | "kind" | "sequence" | "id">,
): string;
```

It returns ownership + spoken zone:

- `Your Monster Zone 1`, `Opponent Spell and Trap Zone 5`;
- `Shared Extra Monster Zone left/right` based on id;
- `Your Field Zone`, `Your Deck`, `Your Extra Deck`, `Your Graveyard`, `Your Banished`, `Your Hand` and opponent variants.

Add `readonly accessibleLabel: string` to `BoardZoneView` and `BoardStackView`. `mapSnapshotToBoard` computes it from layout with `fieldZoneAccessibleName`; stack accessible label appends count/top-card detail. Keep `label` as visible short text. `ZoneControl` and `StackControl` use `accessibleLabel` for ARIA only.

Card accessible labels use ownership too: change `addCard` to pass `fieldZoneAccessibleName(layout)` to `cardAccessibleLabel`, not `layout.label`. Thus a card announces `The Legendary Fisherman in Your Monster Zone 2` while the painted zone says `Monster Zone 2`.

## TDD

1. **Red** — exact label/coordinate/accessibility tests first.
2. **Green** — one layout helper plus data flow.
3. **Refactor** — avoid duplicate name switches; no CSS change expected.

## Test plan

Extend `tests/unit/duel-field.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `uses requested owner-neutral visible labels` | `STANDARD_DUEL_FIELD_LAYOUT` | exact sequence `Monster Zone 1…5`, `Spell/Trap Zone 1…5`; no player label matches `/^(Your|Opponent) /`; shared labels remain explicit |
| `retains owner-aware accessible names` | `fieldZoneAccessibleName` over representative p0/p1/shared zones | exact strings listed above |
| `uses denser columns and wider row gaps` | zones by id | p0/p1 monster sequences 0/1/4 x `450/1280`, `545/1280`, `830/1280`; spell y `590/720` and `130/720`; monster y unchanged |
| `aligns each Extra Deck under its Field Zone` | p0/p1 extra and field | equal x `330/1280`; p0 extra y `590/720`, p1 extra y `130/720` |
| `keeps dimensions, ids and shared EMZ coordinates stable` | full layout | 34 unique ids; every width `82/1280`, height `114/720` except hand; shared x/y unchanged |
| `board exposes requested paint labels and owner-aware accessible labels` | mapped rich fixture | zone `p0:mainMonster:0` label `Monster Zone 1`, accessibleLabel `Your Monster Zone 1`; p1 deck stack label begins `Deck`, accessibleLabel begins `Opponent Deck` |

Extend `tests/component/DuelField.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `paints owner-neutral labels but announces ownership` | render fixture | visible `zone-control-label-p0:mainMonster:0` text `Monster Zone 1`; group/button accessible name includes `Your Monster Zone 1` |
| `keeps stack ownership in accessible names` | p0/p1 deck stacks | `Your Deck, …` and `Opponent Deck, …` remain distinguishable |

Update existing exact coordinate expectation at line 51 from `440/1280` to `450/1280`. Update card accessible strings from `Your Main Monster 2` to `Your Monster Zone 2` only where `fieldZoneAccessibleName` now supplies the owner-aware wording.

## Impl steps

- [ ] 1. Add the six unit tests and two component tests. Run `npm run test:unit -- duel-field` and `npm run test:component -- DuelField` — expect label/coordinate/API failures.
- [ ] 2. In `duel-field-layout.ts`, replace base/step x with the exact array `[450, 545, 640, 735, 830]`; set spell y `mirrored ? 130 : 590`; move Extra x to `330`.
- [ ] 3. Replace `zone`'s label construction with a pure owner-neutral label switch using the exact table above. Keep shared labels explicit.
- [ ] 4. Implement/export `fieldZoneAccessibleName` with exhaustive `FieldZoneKind` handling and shared-id branch. No string parsing of the visible label.
- [ ] 5. Add `accessibleLabel` to `BoardZoneView` and `BoardStackView`. In `mapSnapshotToBoard`, map it from layout; in `createStacks`, append current count/top-card suffix to the expanded name while keeping short `label` + suffix for dialog/title display.
- [ ] 6. In `addCard`, pass the expanded name to `cardAccessibleLabel`.
- [ ] 7. In `ZoneControl.svelte`, use `zone.accessibleLabel` in `aria-label` and keep `zone.label` in the visible span. In `StackControl.svelte`, use `stack.accessibleLabel` for `aria-label`.
- [ ] 8. Update fixtures typed as `BoardZoneView` / `BoardStackView` to include `accessibleLabel`; do not change unrelated fixture geometry.
- [ ] 9. Update exact affected assertions (`Your Main Monster` → accessible `Your Monster Zone`, painted text per table). Do not mass-replace human-facing prompt-choice fixture labels — engine prompt labels are independent of painted layout.
- [ ] 10. Re-run focused suites; run field navigation tests because coordinates drive neighbours. Assert neighbour maps remain usable rather than byte-identical if a tie resolves differently.

## Outputs

- Files edited: `src/field/duel-field-layout.ts`, `src/field/board-view-model.ts`, `src/app/components/duel-field/ZoneControl.svelte`, `StackControl.svelte`, `tests/unit/duel-field.test.ts`, `tests/component/DuelField.test.ts`, typed board fixture files that require `accessibleLabel`.
- Public type change: `BoardZoneView` and `BoardStackView` gain `accessibleLabel`; `fieldZoneAccessibleName` exported.
- Behaviour: visible labels/geometry only; physical target ids unchanged.
- Migration / config: none.

## Validation

- [ ] `npm run test:unit -- duel-field field-navigation placement-candidates` passes
- [ ] `npm run test:component -- DuelField` passes
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` pass
- [ ] `npm run build` succeeds
- [ ] manual check at 1280×720 design ratio: labels match table; columns visibly closer; row gaps visibly larger; Extra aligns vertically with Field for both players
- [ ] manual keyboard check: arrow navigation still reaches every field target
- [ ] browser measurement: central card edge gap = 13 design px horizontally; monster↔spell edge gap = 6 design px vertically
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `refactor(field): tighten zone labels and geometry`
