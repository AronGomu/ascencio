# T11: Preview keeps last known card

**Plan:** `./ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** Hovering any hidden/unknown card leaves the left preview panel showing the previous card; only known cards update it.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). Left Side Panel feedback: "When hovering a hidden card, keep the previous image shown as the preview. Only update the card preview when the pointer is over a visible card with information."
- Today `App.svelte` swaps the panel to `HIDDEN_CARD_PREVIEW` ("Face-down card / No information is available…") in three handlers: `previewFieldCard`, `previewStackCard`, `previewZoneListEntry` (lines ~846–871). `previewHudCard` already keeps-previous (returns on null).
- This slice: make all preview handlers keep-previous on unknown; retire `HIDDEN_CARD_PREVIEW` if orphaned.
- Out of scope here: preview reset on new duel (stays — `afterUpdate` clears `previewCard` on generation change), CardPreviewPanel markup, zoom gating (T6).
- Assumptions in force: T4 may already make extra-deck stack hover carry no code; with this ticket that hover becomes a no-op update. Order does not matter — both behave.

## Requirements

- `previewFieldCard(card)`: `if (card.code === undefined) return;` then existing known path.
- `previewStackCard(stack)`: `const code = stackTopCode(stack); if (code === undefined) return;` then existing path.
- `previewZoneListEntry(entry)`: `if (entry.code === undefined) return;` then `cardPreviewForCode` (drop the `?? HIDDEN_CARD_PREVIEW` fallback; if lookup returns null, keep previous).
- Remove `HIDDEN_CARD_PREVIEW` import from `App.svelte`; delete the constant from `src/battle/app/presentation/card-preview.ts` only if `grep -rn "HIDDEN_CARD_PREVIEW" src/ tests/` shows no remaining source users (update its unit tests instead of keeping dead export).

## Inputs

- `src/battle/app/App.svelte` — the three handlers + import block from `./presentation/card-preview.ts`.
- `src/battle/app/presentation/card-preview.ts` — `HIDDEN_CARD_PREVIEW`, `cardPreviewForCode`, `stackTopCode`.
- Tests: `tests/unit/card-preview.test.ts` (constant coverage), app-level preview coverage — `grep -rn "HIDDEN_CARD_PREVIEW\|Face-down card" tests/component/` (AppShell/AppChrome suites) and update expectations.

## TDD

1. **Red** — component test in the App-level suite that currently pins the old behavior (find via `grep -rn "No information is available" tests/`); rewrite as:
   - test name: `hovering a hidden card keeps the previous preview` — mount app-level fixture (existing pattern in `tests/component/AppShell.test.ts` / `AppChrome.test.ts`), hover a known card (panel shows its name), then hover a hidden card → `[data-cy="card-preview-name"]` still shows the first card's name.
   - test name: `hovering before any known card leaves the empty state` — fresh mount, hover hidden card → `[data-cy="card-preview-empty"]` still rendered.
   If no app-level hover test exists, add both to `tests/component/AppShell.test.ts` following its mount helpers.
2. **Green** — handler edits per Requirements.
3. **Refactor** — retire `HIDDEN_CARD_PREVIEW` + its tests if orphaned.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| hovering hidden keeps previous preview | known hover → hidden hover | panel still shows known card name |
| hidden hover before any known card | fresh mount → hidden hover | empty-state copy stays |
| card-preview unit suite | — | green after constant removal/update |

## Impl steps

- [ ] 1. Locate + rewrite/add the app-level tests; `npm run test:component`; red.
- [ ] 2. Edit the three handlers in `App.svelte` per Requirements.
- [ ] 3. `grep -rn "HIDDEN_CARD_PREVIEW" src/ tests/` — remove constant + stale tests if orphaned; otherwise leave exported.
- [ ] 4. `npm run test:component && npm run test:unit && npm run typecheck && npm run lint`.
- [ ] 5. Manual check: dev duel — hover own card then opponent set card: preview unchanged; hover opponent face-up: preview updates.

## Outputs

- Files touched: `src/battle/app/App.svelte`, possibly `src/battle/app/presentation/card-preview.ts`, `tests/component/AppShell.test.ts` (or sibling), `tests/unit/card-preview.test.ts`.
- Behavior: preview panel = last known card, sticky across hidden hovers; still resets per duel generation.
- Migrate/config: none.

## Validation

- [ ] tests pass: `npm run test:component`, `npm run test:unit`
- [ ] manual check: hidden hover keeps preview
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `fix(preview): keep the last known card when hovering hidden cards`
