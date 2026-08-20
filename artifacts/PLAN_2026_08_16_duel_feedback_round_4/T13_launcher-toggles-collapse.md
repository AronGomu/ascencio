# T13: Launcher click toggles collapse

**Plan:** `./artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** While a targeting effect resolves, clicking the haloed zone/pile toggles the target list between collapsed (single button) and expanded — it never dismisses the list.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). List Dialog feedback #5: "When the list dialog is collapsed, clicking the zone targeted by the effect does not remove the list dialog. While resolving the effect you can only collapse. Clicking the zone toggles the collapsed state: collapses into a single button or expands to normal."
- Today: `DuelField.svelte` `toggleTargetList()` (called from `activateCard`/`activateStack` when the pressed control is a target-list launcher) CLOSES the list (`dismissedTargetPromptKey = key; closeZoneList()`) or reopens it. Collapse state is internal to `ZoneListDialog.svelte` (`let collapsed = false`, `setCollapsed`, +/− buttons `zone-list-dialog-collapse-button` / `zone-list-dialog-expand-button`).
- Fix: lift collapse to `DuelField`; launcher click toggles it; dismissal paths for target mode stop firing from launchers.
- Out of scope here: browse-mode toggling (pile click still opens/closes browse list), outside-click behavior (`dismissZoneList` guards stay), validation text (T12), halo colors (T14).
- Assumptions in force: `synchronizeZoneList` resets per-prompt state on prompt-key change — collapse resets there too.

## Requirements

- `ZoneListDialog.svelte`: `collapsed` becomes a controlled prop: `export let collapsed = false;` + `export let oncollapsedchange: (value: boolean) => void = () => undefined;`. Internal `setCollapsed(value)` calls `oncollapsedchange(value)` instead of assigning local state (keep the focus-swap logic: await tick, focus the +/− button). Delete `$: if (!targetMode) collapsed = false;` (parent owns reset).
- `DuelField.svelte`:
  - `let targetListCollapsed = false;` reset to `false` inside `synchronizeZoneList` on prompt-key change.
  - `toggleTargetList()` rewrite: if `zoneListState?.mode === "target"` → `targetListCollapsed = !targetListCollapsed;` (no `closeZoneList`, no `dismissedTargetPromptKey`); else open list (`dismissedTargetPromptKey = null; zoneListState = { mode: "target", promptKey: key }; activateWindow("zoneList")`).
  - Target-mode `<ZoneListDialog mode="target" …>` call gains `collapsed={targetListCollapsed}` and `oncollapsedchange={(value) => (targetListCollapsed = value)}`.
  - Browse-mode call passes nothing (defaults keep old behavior).

## Inputs

- `src/battle/app/components/duel-field/DuelField.svelte`... correction: file is `src/battle/app/components/DuelField.svelte` — functions `toggleTargetList`, `synchronizeZoneList`, `activateCard`, `activateStack`, `dismissZoneList`; target-mode ZoneListDialog block.
- `src/battle/app/components/duel-field/ZoneListDialog.svelte` — `collapsed`, `setCollapsed`, `collapseButton`/`expandButton`, `FloatingFieldWindow` `{collapsed}` pass-through.
- Tests: `tests/component/ZoneListDialog.test.ts` (collapse coverage exists — search `collapse`), `tests/component/DuelField.test.ts` (launcher/target-list coverage — search `toggleTargetList`/`target list`).

## TDD

1. **Red** — `tests/component/DuelField.test.ts`:
   - test name: `a launcher click collapses the open target list instead of closing it` — mount with a cardSelection spec whose choices include off-field targets (reuse the suite's existing target-list fixture); click the launcher (`[data-field-target="stack:p0:deck"]` or the fixture's launcher) → target list still mounted, `[data-cy="zone-list-dialog-expand-button"]` visible (collapsed chrome), entries absent.
   - test name: `a second launcher click expands the collapsed target list` — click launcher twice → entries visible again, `[data-cy="zone-list-dialog-collapse-button"]` present.
   - test name: `a new prompt resets the collapse state` — collapse, then swap in a new prompt/spec (new promptId) → list expanded.
2. **Green** — impl per Requirements.
3. **Refactor** — `ZoneListDialog.test.ts`: adapt collapse tests to controlled prop (drive via prop + assert `oncollapsedchange` fired).

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| launcher click collapses open target list | 1 click on launcher | dialog collapsed, not dismissed |
| second click expands | 2 clicks | entries visible again |
| new prompt resets collapse | prompt swap while collapsed | expanded |
| collapse buttons still work | click − then + | `oncollapsedchange(true)` then `(false)`; focus moves per existing behavior |

## Impl steps

- [ ] 1. Red DuelField tests; `npm run test:component -- tests/component/DuelField.test.ts`.
- [ ] 2. `ZoneListDialog.svelte`: controlled `collapsed` + `oncollapsedchange` per Requirements.
- [ ] 3. `DuelField.svelte`: state, reset, `toggleTargetList` rewrite, prop wiring per Requirements.
- [ ] 4. Adapt `ZoneListDialog.test.ts` collapse tests.
- [ ] 5. `npm run test:component && npm run typecheck && npm run lint`.
- [ ] 6. Grep dead state: `dismissedTargetPromptKey` — still used by `dismissZoneList` (outside-click) → keep; remove only if compiler/lint flags unused.
- [ ] 7. Manual check: dev duel — activate a searcher; click the deck pile: list collapses to the + button; click again: expands; click elsewhere on field: unchanged behavior; − button still collapses.

## Outputs

- Files touched: `DuelField.svelte`, `ZoneListDialog.svelte`, `tests/component/DuelField.test.ts`, `tests/component/ZoneListDialog.test.ts`.
- Public API: `ZoneListDialog` `collapsed`/`oncollapsedchange` controlled props (browse call site unaffected via defaults).
- Migrate/config: none.

## Validation

- [ ] tests pass: `npm run test:component`
- [ ] manual check: launcher toggle matrix above
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `feat(list-dialog): launcher clicks toggle target-list collapse instead of dismissing`
