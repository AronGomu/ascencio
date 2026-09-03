# T12: Put validation errors on deck zones

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T11  
**Commit outcome:** Validation strip disappears; invalid zones show red borders and focusable (!) tooltips listing their own errors.

## Context (self-contained)

Goal: DB9. Validation issues already carry `zone: "main"|"extra"|"side"`. Out of scope: changing legality rules/messages.

## Requirements

R1. Remove `ValidationIssues` strip/component mount.
R2. Attribute issues by explicit `zone`, else by every deck zone containing `cardCode`; zone-less/card-less deck-global issues attach to main as the single global-error home. Zone gets red border only when attributed issue severity is `error`; warnings keep normal border but remain in tooltip.
R3. Zone heading displays `(!)` only when that zone has issues.
R4. Hover/focus on icon opens styled multiline tooltip listing exact issue messages; Escape/blur/pointerleave closes.
R5. Tooltip works keyboard + touch (button toggles); icon has accessible expanded/described relationship.
R6. Never parse message text. Mapping order: explicit `issue.zone` → every zone whose code list contains `issue.cardCode` → main for global issue.

## Inputs

I1. Read `DeckWorkspace.svelte`, `DeckZoneGrid.svelte`, `ValidationIssues.svelte`, `src/decks/deck-validation.ts`, validation UI tests.
I2. From T11: side initially collapsed; invalid indicator must remain visible while collapsed.

## Interface contract (level 5)

P1. `DeckWorkspace` defines pure `zonesForIssue(issue, deck): readonly DeckZone[]`; explicit zone wins, card code maps by membership (possibly multiple zones), global maps `["main"]`. `DeckZoneGrid` gains `issues: readonly DeckValidationIssue[]`, default `[]`.
P2. Root class `invalid={issues.some(({severity})=>severity==="error")}`; heading structure becomes non-button container holding separate collapse button + separate icon button (never nested buttons). Icon `data-cy={\`deck-zone-error-${zone}\`}`; tooltip `role="tooltip"`, `data-cy={\`deck-zone-error-tooltip-${zone}\`}`.
P3. Tooltip renders one `<li>` per issue in supplied order; exact existing message text.
P4. Icon `aria-label={\`${label} has ${issues.length} validation ${issues.length===1?"error":"errors"}\`}` and `aria-expanded`.
E1. None; validation remains pure.
N1. Collapsing zone never hides heading/icon; legal zones have normal border/no icon.

## TDD

1. **Red** — per-zone grouping, border, tooltip pointer/focus/touch, collapsed visibility, old-strip absence.
2. **Green** — pass issue subsets; implement local tooltip.
3. **Refactor** — remove orphan component/import/styles if no other consumer.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Main too small | main issue | main red + icon; others normal |
| Extra overflow | extra issue | extra tooltip exact message |
| Side issue collapsed | side collapsed | heading icon visible |
| Keyboard | focus icon/Escape | tooltip opens/closes |
| Legal deck | no issues | no icons/red borders |

## Impl steps

- [ ] 1. Rewrite `deck-validation-ui.test.ts` red.
- [ ] 2. Group/pass issues by zone.
- [ ] 3. Add invalid border + tooltip state/markup/styles.
- [ ] 4. Delete now-unused `ValidationIssues.svelte` only if no consumers.

## Validation

- [ ] `npx vitest run tests/component/deck-editor/deck-validation-ui.test.ts`
- [ ] `npx vitest run tests/unit/decks/deck-validation.test.ts tests/unit/data-cy-coverage.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: invalid main/extra/side, collapsed side, mouse/keyboard/touch tooltip.
- [ ] No silent-failure swallow added: none.
- [ ] App functional: validation still blocks illegal duel use where existing flow requires it.
- [ ] Commit msg draft: `feat(deck-editor): attach legality errors to their zones`
