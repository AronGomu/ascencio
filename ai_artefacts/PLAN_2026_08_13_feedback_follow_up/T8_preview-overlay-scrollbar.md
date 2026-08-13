# T8: Preview overlay scrollbar

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T7, T4
**Commit outcome:** Preview effect text is bounded, keyboard/wheel scrollable, width-stable, controlled by shared custom vertical overlay thumb.

## Context (self-contained)

- Goal: Fix unbounded preview text + match hand scrollbar visually without replacing native scroll semantics.
- This slice: Restructure CardPreviewPanel only; reuse shared scrollbar unchanged.
- Out of scope here: card metadata chips absent from `CardPreviewView`, rail status, preview domain/API expansion, card-list.
- Assumptions: user chose custom overlay. Reserve 10px inline-end text gutter permanently; overlay decorative/nonfocusable; real text scroller focusable.

## Requirements

- Panel/body uses grid with final `minmax(0,1fr)` row; text cannot size parent.
- Real effect-text element owns `overflow-y:auto`, wheel, PageUp/PageDown/Home/End; `tabindex="0"`, `aria-label="Card effect text"`.
- Native scrollbar chrome hidden; permanent 10px padding/gutter keeps short/long paragraph width identical.
- Reuse `OverlayScrollbar axis="vertical"`; no copied math/listeners.
- Preserve one image lease lifecycle, fallback, empty preview, name/description privacy.
- Supersede old “panel fully inert/direct descendants” tests only where scroll focus/wrapper requires.

## Inputs

- `src/app/components/CardPreviewPanel.svelte`, `tests/component/CardPreviewPanel.test.ts`, `src/styles/app.css`.
- `src/app/presentation/card-preview.ts` — `CardPreviewView` fields are code/name/description only.
- `docs/ADR/006_ADR_preview_panel_replaces_card_inspector.md`, `019_ADR_full_height_duel_shell_and_pixel_geometry.md`.
- `ai_artefacts/manual_test_checklist.md` — append/update only T8 human checks; preserve all other sections.
- **From Depends:** `OverlayScrollbar.svelte` exact props; shell gives preview fixed full height; rail owns status so preview props are content/image only.

## DOM contract

```text
aside.card-preview-panel
├─ art
└─ body
   ├─ name
   └─ text-region
      ├─ text scroller (data-cy=card-preview-text)
      └─ OverlayScrollbar prefix=card-preview-text
```

New selectors: `card-preview-body`, `card-preview-text-region`, `card-preview-text-scrollbar`, `card-preview-text-scrollbar-thumb`. Keep existing panel/art/image/name/text selectors.

## TDD

1. **Red** — bounded structure/component lifecycle tests + long/short/drag/keyboard Chromium scenarios.
2. **Green** — wrapper/CSS/shared scrollbar.
3. **Refactor** — remove native-gutter/fixed-height/direct-child stale rules; no metadata invention.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `renders bounded body around art name and effect text` | preview | exact semantic structure/data-cy |
| `keeps image lease lifecycle` | code/library change/destroy/error | release once; fallback unchanged |
| `hides overlay for short text` | short scenario | bar hidden |
| `shows and maps vertical thumb for long text` | long | scrollHeight>clientHeight; thumb visible/position follows scrollTop |
| `dragging thumb scrolls text` | pointer delta | scrollTop increases |
| `keeps paragraph width stable` | short vs long | width difference≤0.5px; reserved 10px |
| `keeps text inside panel` | long | scroller bottom≤panel bottom |
| `keeps keyboard semantics` | focus + End/PageDown | scrollTop changes; overlay not tabbable |
| `updates after content change` | short→long | bar resyncs via content key |

## Impl steps

- [x] 1. Replace obsolete direct-child/inert assertions in CardPreviewPanel tests with exact structure/focus/lifecycle tests; prove red.
- [x] 2. Extend field acceptance scenarios with `preview-short` + `preview-long`; add Chromium metric/keyboard/drag tests; prove red.
- [x] 3. Add body/text-region wrappers with unique `data-cy`; bind real text scroller.
- [x] 4. Mount shared `OverlayScrollbar axis="vertical"`, prefix `card-preview-text`, content key from preview code+description length.
- [x] 5. Add bounded grid, hidden native chrome, fixed 10px inline gutter; preserve art/name sizing.
- [x] 6. Remove old native scrollbar styling + any direct-descendant CSS assumptions.
- [x] 7. Run component + acceptance; verify keyboard in Chromium.

## Outputs

- Modified: CardPreviewPanel, app.css, component + acceptance scenarios/spec.
- Reused API: `OverlayScrollbar`; no new shared API.
- Behavior change: effect text scroll region becomes one keyboard tab stop; overlay remains aria-hidden.

## Validation

- [x] `npx vitest run tests/component/CardPreviewPanel.test.ts tests/component/OverlayScrollbar.test.ts tests/unit/card-preview.test.ts` → exit 0.
- [x] `npm run typecheck && npm run lint` → exit 0.
- [x] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/full-height-field.spec.ts --grep "preview"` → exit 0.
- [ ] manual keyboard check — focus effect text, PageDown/End scroll; focus ring visible; overlay absent from Tab order.
- [x] app functional — `npm run build` exits 0.
- [x] commit msg draft: `fix(preview): bound effect text with overlay scroll`
