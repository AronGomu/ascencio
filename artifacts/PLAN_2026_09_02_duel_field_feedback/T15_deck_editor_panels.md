# T15: Deck editor panels adopt VariantB

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md` (§ Basilica residual pass, T13–T17)
**Depends:** T13
**Commit outcome:** deck editor workspace/library/catalog panels and its dialogs render as VariantB chamfered glass with gold Forum panel headers; editing behavior, drag, validation semantics unchanged.

## Context (self-contained)

- Goal: apply Basilica Slate VariantB (chamfered glass panels, gold-line edges, gold Forum titles) to residual surfaces.
- This slice: deck editor chrome in `src/deck-editor/`. Presentation only.
- Out of scope here: deck select screen `src/deck-select/` (own prototype/ADR-064), shared deck data `src/decks/`, card art/rarity halos, drag logic (`drag-state.ts`), store/route files, validation rules.
- Assumptions in force: tokens retuned brand-wide (T13).

## Requirements

- Restyle panel chrome of: `DeckLibrary.svelte`, `DeckWorkspace.svelte`, `DeckZoneGrid.svelte` (zone headers), `CardCatalog.svelte`, `ValidationIssues.svelte`, `EditorTabs.svelte`, and dialogs `LoadDeckDialog.svelte`, `YdkImport.svelte`, `YdkExport.svelte`, `DeckCardContextMenu.svelte` (all `src/deck-editor/components/`).
- Major panels (library, workspace, catalog) = `.ui-glass-panel ui-chamfer`; their headers = Forum uppercase letterspaced (`--ls-display`) — small panel headers may use a local `.panel-title` style on tokens instead of `.ui-dialog-title` (that class centers + gold-rules; header variant is left-aligned, `--muted`→`--accent` per prototype VariantB).
- Dialogs (`LoadDeckDialog`, import/export) = full VariantB dialog treatment (`.ui-glass-panel ui-chamfer` + `.ui-dialog-title`).
- Context menu / tap targets (`DeckCardContextMenu.svelte`, `TapTargetMenu.svelte`): square, `--glass-strong` + `--line-soft`; no chamfer (everyday control, DESIGN.md → Geometry: chamfer is ceremonial, not default).
- Validation issue colors stay `--danger` / `--selected` (semantics, not brand).
- No `data-cy` changes; no raw literals.

## Inputs

- files: components above; `src/deck-editor/layout/` for panel composition.
- **From Depends (T13):** classes verbatim — `.ui-chamfer`, `.ui-glass-panel`, `.ui-dialog-title`; tokens `--chamfer: 6px`, `--glass-strong: rgba(150, 175, 215, 0.036)`, `--gold-line: rgba(211, 178, 104, 0.6)`, `--ls-display: 0.16em`.

## Interface contract (level 5)

- **Produces:** library/workspace/catalog root panels carry `ui-glass-panel ui-chamfer`; editor dialogs (`LoadDeckDialog`, `YdkImport`, `YdkExport`) carry `ui-dialog-panel ui-chamfer` + `ui-dialog-title` (dialogs opaque per T13); `DeckCardContextMenu` + `TapTargetMenu` carry neither chamfer nor gold border. Component `<style>` root rules **no longer declare** competing `background` / `border` / `border-radius` (cascade rule — primitives lose to scoped styles otherwise). Props, events, `data-cy`: unchanged.
- **Consumes:** T13 class names verbatim (binding).
- **Errors:** n/a.
- **Invariants:** drag/drop hit areas unchanged (chamfer is `clip-path`; clip does not alter layout box — pointer events on cut corners are lost, so no interactive control may live inside the 6px corner cut). Validation colors semantic. Scroll containers keep scrollbars usable.
- **Integration links:** n/a.

## TDD

1. **Red** — two layers (jsdom never injects component CSS — see `tests/component/deck-editor/card-tile-art.test.ts:14-17` — so classList alone is a false green):
   - component tests: `DeckLibrary`, `DeckWorkspace`, `CardCatalog` roots have `ui-glass-panel ui-chamfer`; `LoadDeckDialog` title has `ui-dialog-title`; `DeckCardContextMenu` + `TapTargetMenu` roots have no `ui-chamfer`;
   - source-text tests (pattern from `card-tile-art.test.ts`): each major panel's `<style>` root rule declares no `background`/`border-radius`.
   Fails now.
2. **Green** — apply classes, **delete** duplicated local panel CSS declarations.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| 3 major panels | render each | `ui-glass-panel ui-chamfer` on root |
| editor dialogs | render `LoadDeckDialog`, `YdkImport`, `YdkExport` | `ui-dialog-panel ui-chamfer` + `ui-dialog-title` |
| context menus plain | render `DeckCardContextMenu`, `TapTargetMenu` | no `ui-chamfer` |
| no competing CSS | source-text read of panel `<style>` blocks | root rules free of `background`/`border-radius` |
| data-cy freeze | `npm run test:unit` | `data-cy-coverage.test.ts` green |
| corner-cut safety | render workspace | no button/input positioned inside 6px corner region (manual/dev check) |

## Impl steps

- [ ] 1. Red tests.
- [ ] 2. Panels: `DeckLibrary`, `DeckWorkspace`, `DeckZoneGrid` headers, `CardCatalog`, `ValidationIssues`, `EditorTabs`.
- [ ] 3. Dialogs: `LoadDeckDialog`, `YdkImport`, `YdkExport`; menu: `DeckCardContextMenu`, `TapTargetMenu` (square).
- [ ] 4. Green: component + unit suites.

## Validation

- [ ] tests pass: `npm run test:component && npm run test:unit`
- [ ] manual check: dev server → deck editor → add/remove cards, open load dialog, import/export, context menu; chamfer visible, nothing clipped-unclickable
- [ ] no silent-failure swallow added: `none`
- [ ] app functional — full edit round-trip works
- [ ] commit msg draft: `feat(deck-editor): panels + dialogs adopt VariantB chamfered glass per basilica residual pass`
