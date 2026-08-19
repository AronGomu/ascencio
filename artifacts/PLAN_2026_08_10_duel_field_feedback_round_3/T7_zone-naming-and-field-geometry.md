# T7: Zone naming and field geometry

**Plan:** `./artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
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

## Repair state (parent-inlined 2026-08-12, authorized extra repair)

A previous worker implemented this ticket almost completely, then exhausted its repair budget on one failure. The user has authorized exactly one extra repair attempt. Do not restart from scratch.

- Preserved candidate code: git ref `refs/candidates/t7-zone-geometry` (commit `04341dd`), snapshotted on base `676d191`. Also `stash@{0}` — do not drop it.
- Current branch HEAD is `7eb8830`; it adds only two test commits over `676d191`. `git merge-tree --write-tree HEAD refs/candidates/t7-zone-geometry` was re-verified on 2026-08-12: merges clean.
- Restore the candidate into the working tree first:
  ```
  git restore --source=refs/candidates/t7-zone-geometry --worktree -- .
  git status --short
  ```
  Never stage `feedback.md` — it is user-owned and intentionally dirty.
- Candidate evidence already achieved: unit 609/609, component 202/202, typecheck/lint/format/build green. Browser measurement at 1280×720 already correct: horizontal gap 13 design px, vertical gaps 6 design px both sides, 34/34 exact labels, Field↔Extra x delta 0 for both players.
- **The single remaining failure:** keyboard arrow navigation reaches 40 of 42 targets. Both shared Extra Monster Zones have no inbound arrow route after the column x centres moved to `450,545,640,735,830` while the shared EMZs stayed at x `590/690`.
- Fix location named by the previous worker: `src/field/board-view-model.ts:524-530`, the neighbour/nav graph derivation. Per Impl step 10, neighbour maps must remain *usable*, not byte-identical — a tie may legitimately resolve to a different neighbour.
- After fixing, re-run every Validation box below, including the Chromium geometry and keyboard sweep. Do not trust the candidate's prior green output for suites your fix touches.

### Environment facts for validation

- Playwright is chromium-only on this host. Run browser checks as:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here because `playwright.config.ts` includes a `webkit-smoke` project unsupported on this machine. Use `npm run check:headless` plus the explicit Chromium invocation instead.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly` and no assertion failure. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing.

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

- [x] 1. Add the six unit tests and two component tests. Run `npm run test:unit -- duel-field` and `npm run test:component -- DuelField` — expect label/coordinate/API failures. (criterion: the six unit + two component tests exist and pass; red-first evidence preserved in `refs/candidates/t7-zone-geometry`)
- [x] 2. In `duel-field-layout.ts`, replace base/step x with the exact array `[450, 545, 640, 735, 830]`; set spell y `mirrored ? 130 : 590`; move Extra x to `330`. (criterion: `uses denser columns and wider row gaps` + `aligns each Extra Deck under its Field Zone` pass)
- [x] 3. Replace `zone`'s label construction with a pure owner-neutral label switch using the exact table above. Keep shared labels explicit. (criterion: `uses requested owner-neutral visible labels` passes)
- [x] 4. Implement/export `fieldZoneAccessibleName` with exhaustive `FieldZoneKind` handling and shared-id branch. No string parsing of the visible label. (criterion: `retains owner-aware accessible names` passes and `npm run typecheck` proves the switch exhaustive)
- [x] 5. Add `accessibleLabel` to `BoardZoneView` and `BoardStackView`. In `mapSnapshotToBoard`, map it from layout; in `createStacks`, append current count/top-card suffix to the expanded name while keeping short `label` + suffix for dialog/title display. (criterion: board mapping test asserts `Monster Zone 1` / `Your Monster Zone 1` and `Deck` / `Opponent Deck` split)
- [x] 6. In `addCard`, pass the expanded name to `cardAccessibleLabel`. (criterion: card label test expects `Hidden card in Your Monster Zone 3`)
- [x] 7. In `ZoneControl.svelte`, use `zone.accessibleLabel` in `aria-label` and keep `zone.label` in the visible span. In `StackControl.svelte`, use `stack.accessibleLabel` for `aria-label`. (criterion: `paints owner-neutral labels but announces ownership` and `keeps stack ownership in accessible names` pass)
- [x] 8. Update fixtures typed as `BoardZoneView` / `BoardStackView` to include `accessibleLabel`; do not change unrelated fixture geometry. (criterion: `npm run typecheck` clean with no fixture coordinate diffs)
- [x] 9. Update exact affected assertions (`Your Main Monster` → accessible `Your Monster Zone`, painted text per table). Do not mass-replace human-facing prompt-choice fixture labels — engine prompt labels are independent of painted layout. (criterion: `npm run test:component` 202/202 with no edits to prompt-choice fixture labels)
- [x] 10. Re-run focused suites; run field navigation tests because coordinates drive neighbours. Assert neighbour maps remain usable rather than byte-identical if a tie resolves differently. (criterion: `npm run test:unit -- duel-field field-navigation placement-candidates` passes)
  - [x] 10.1 Repair the vertical nav graph so the shared Extra Monster Zones keep inbound arrow routes: vertical alignment is horizontal-span overlap, not exact-column. (criterion: new `keeps every field target reachable with arrow keys alone` test fails before the change and passes after)

## Outputs

- Files edited: `src/field/duel-field-layout.ts`, `src/field/board-view-model.ts`, `src/app/components/duel-field/ZoneControl.svelte`, `StackControl.svelte`, `tests/unit/duel-field.test.ts`, `tests/component/DuelField.test.ts`, typed board fixture files that require `accessibleLabel`.
- Public type change: `BoardZoneView` and `BoardStackView` gain `accessibleLabel`; `fieldZoneAccessibleName` exported.
- Behaviour: visible labels/geometry only; physical target ids unchanged.
- Migration / config: none.

## Validation

- [x] `npm run test:unit -- duel-field field-navigation placement-candidates` passes (58 files / 611 tests passed)
- [x] `npm run test:component -- DuelField` passes (`npm run test:component`: 15 files / 202 tests passed)
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass (all three inside `npm run check:headless`, exit 0)
- [x] `npm run build` succeeds (`build:verify` status ok)
- [x] manual check at 1280×720 design ratio: labels match table; columns visibly closer; row gaps visibly larger; Extra aligns vertically with Field for both players (criterion: Chromium probe at 1280×720 dumps all 34 visible labels matching the table and Field↔Extra x delta 0 for both players)
- [x] manual keyboard check: arrow navigation still reaches every field target (criterion: Chromium arrow-key sweep reaches 42/42 nav targets, 0 unreachable, both shared EMZs with inbound routes)
- [x] browser measurement: central card edge gap = 13 design px horizontally; monster↔spell edge gap = 6 design px vertically (criterion: measured 12.98 design px horizontally ×4 gaps and 6.00 design px vertically on both sides)
- [x] app functional — no broken path from this slice (criterion: `PLAYWRIGHT_BROWSERS_PATH=… npx playwright test --project=chromium` 21/21 passed, including the full keyboard-only preset duel)
- [x] commit msg draft: `refactor(field): tighten zone labels and geometry` (criterion: branch head carries that exact subject)
