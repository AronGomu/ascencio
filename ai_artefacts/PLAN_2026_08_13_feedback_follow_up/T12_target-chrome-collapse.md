# T12: Target chrome + collapse

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T11
**Commit outcome:** Target list has dynamic full-source notice, target-only controls, no outside/Escape loss, stable 58×58 collapse/expand anchor.
**Evidence:** `0431136` (`feat(card-list): split target chrome and stable collapse`).

## Context (self-contained)

- Goal: Split browse vs target window mechanics before changing target selection semantics.
- This slice: Chrome/dismissal/collapse/notices only. Current selection callback behavior remains compiling until next ticket.
- Out of scope here: hard max, stale validation, exact-single draft/Validate, hover suppression, range enable rules.
- Assumptions: target has no `×`; outside/Escape do nothing; Cancel only engine-cancelable; collapse visual-only/not persisted. Hand participates in dynamic source notices.

## Requirements

- Expanded target header: title, count, filter notice, 44×44 `−`; no close.
- Collapsed root exactly 58×58; exactly one visible child/control `+` at same viewport x/y as previous minus within 0.5px.
- Collapse freezes current top-left. Own-size ResizeObserver must not recenter/persist collapsed coords. Boundary shrink may clamp collapsed shell; expansion restores prior anchor then clamps full shell.
- Target outside/Escape never calls close/cancel/choice and keeps draft mounted. Browse behavior stays unchanged.
- Target footer expanded: selection count, Alphabetical, Validate placeholder/current button, conditional red Cancel.
- Target sorting reuses T10 helpers: `alphabeticalAllowed=cardListAlphabeticalAllowed(targetEntries)`; force local flag false when disallowed; `displayTargetEntries=cardListDisplayEntries(targetEntries, alphabeticalAllowed && alphabetical)`; render display list only. Selected IDs stay choice IDs, never indexes.
- Notice uses represented source locations only, fixed order Hand→Extra Deck→Graveyard→Banished→Deck.
- Exact approved 4-zone sentence: `Filtered: legal targets from Extra Deck, Graveyard, Banished, and Deck`.
- Single-source target uses `Filtered: legal targets only`.

## Inputs

- `src/app/components/duel-field/FloatingFieldWindow.svelte`, `ZoneListDialog.svelte`.
- `src/app/presentation/card-list-dialog-model.ts`, `src/field/off-field-target-list.ts`.
- `tests/component/FloatingFieldWindow.test.ts`, `ZoneListDialog.test.ts`; acceptance card-list scenarios.
- `docs/ADR/017_ADR_floating_field_windows_and_dismissal.md`, `021_ADR_card_list_dialog_modes_and_selection.md`.
- `ai_artefacts/manual_test_checklist.md` — append/update only T12 human checks; preserve all other sections.
- **From Depends:** approved browse branch/dismissal; physical tile + projected menu; full uppercase `zoneBadge`; stable sort + field-local cap; `src/app/acceptance/card-list-dialog-scenarios.ts` is scenario source to extend.

## Exact API

`FloatingFieldWindow.svelte` adds:

```ts
export let collapsed = false;
```

`card-list-dialog-model.ts` adds:

```ts
export function cardListSourceNotice(
  entries: readonly Pick<OffFieldTargetEntry, "location">[],
): string;
```

New selectors: `zone-list-dialog-filter-notice`, `zone-list-dialog-collapse-button`, `zone-list-dialog-expand-button`; root `data-mode="target"`, `data-collapsed="true|false"`.

## TDD

1. **Red** — pure notice order/copy; primitive collapse positioning; target no-dismiss/control matrix; Chromium coord/size.
2. **Green** — frozen anchor/target branch/notice.
3. **Refactor** — split window shell mechanics from list state; no persisted collapse fields.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `shows exact four-zone notice` | Extra/GY/Banished/Deck shuffled | exact approved sentence/order |
| `shows dynamic Hand-inclusive notice` | Hand+GY+Deck | `Hand, Graveyard, and Deck` in fixed order |
| `target chrome has collapse but no close` | mandatory target | minus present; × absent |
| `shows Cancel only when cancelable` | false/true | absent/present; no × both |
| `outside and Escape preserve target` | selected target | no callbacks; dialog + pressed state remain |
| `collapses to one plus at same anchor` | click − | root58×58; one visible child; coord delta≤.5px |
| `expands without persistence write` | click + | prior expanded position; callback count unchanged |
| `reclamps expanded size after shrink` | boundary resize while collapsed | expanded border inside boundary |
| `browse dismissal remains unchanged` | browse routes | ×/Cancel/outside/Escape still close |
| `sorts target display then restores exact order` | visible target entries on→off | stable alphabetical; exact source IDs restored; selected IDs unchanged |
| `disables target sorting for hidden identity` | any hidden target | checkbox disabled + forced off; source order retained |

## Impl steps

- [x] 1. Add pure notice tests + component/primitive collapse/dismiss tests; prove red.
- [x] 2. Implement location-only `cardListSourceNotice`; dedupe sources + fixed order; no identity access.
- [x] 3. Add `collapsed` mechanics to FloatingFieldWindow with ephemeral expanded anchor; do not alter persisted `position` contract.
- [x] 4. Add target local collapsed state + header minus/plus structure; hide title/count/notice/body/footer when collapsed.
- [x] 5. Set `dismissOnOutsideClick=false`, `dismissOnEscape=false` in target mode; retain true in browse.
- [x] 6. Add target footer/control matrix + filter notice; wire exact target sorting/privacy reset rules above; keep current Validate callback behavior until T13.
- [x] 7. Add exact/dynamic/collapse acceptance scenarios + Chromium coordinate/visibility assertions.
- [x] 8. Run target + browse regression suites.

## Outputs

- Modified: FloatingFieldWindow, ZoneListDialog, model, styles, tests/acceptance.
- Public API: optional `collapsed` prop + source notice fn.
- Persistence unchanged; collapse defaults expanded each mount/reload.

## Validation

- [x] `npx vitest run tests/unit/card-list-dialog-model.test.ts tests/component/FloatingFieldWindow.test.ts tests/component/ZoneListDialog.test.ts` → exit 0.
- [x] `npm run typecheck && npm run lint` → exit 0.
- [x] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/card-list-dialog.spec.ts --grep "target chrome|collapse|dismiss|notice"` → exit 0.
- [ ] manual check — target draft survives outside/Escape/collapse; browse still dismisses.
- [x] app functional — `npm run build` exits 0.
- [x] commit msg draft: `feat(card-list): split target chrome and stable collapse`
