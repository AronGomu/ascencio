# Final Implementation Report — Duel Field Feedback + Basilica Residual UI

Date: 2026-09-03
Branch: `main`
Plan baseline: `0857479`
Implementation range: `3609b53..8d950c7`
Terminal state: **partial** — all requested code/docs merged and pushed; full browser gate blocked by pre-existing deck-editor E2E locator drift.

## Ticket State List

| Ticket | State | Commit | Evidence |
| --- | --- | --- | --- |
| T1 card back asset | done | `3609b53` | targeted unit 16/16; `check:headless`; Chromium runtime image + SVG fallback |
| T2 layout rework | done | `246ad02` | field area 1,357,664 → 1,491,488 px² (+9.86%); targeted 103/103; portrait no overflow |
| T3 stack size parity | done | `6a5cbc0` | targeted component 193/193; component 1086/1086; `check:headless` |
| T4 empty stack | done | `9e5bfc7` | targeted 57/57; component 1088/1088; `check:headless` |
| T5 hand fan arc | done | `d8a119d` | targeted 28/28; component 1090/1090; Chromium both hands unclipped |
| T6 selected hand overlay | done | `043f519` | targeted 216/216; `check:headless` |
| T7 submitted-selection gate | done | `598a3fe` | DuelField 194/194; `check:headless` |
| T8 hand Activate chip | done | `6d90f50` | targeted 226/226; component 1101/1101; Chromium acceptance 4/4 |
| T9 chain auto-pass guard | done | `234ee12` | real-core `chain` repro; targeted 23/23; integration 42/42; `check:headless` |
| T10 material-select dialog | done with engine limitation | `18e12a6` | targeted 328/328; component 203/203; XYZ integration 5/5; `check:headless` |
| T11 diagnostics download | done | `c0ac51d` | component 4/4; Chromium download 1/1; `check:headless` |
| T12 manual checklist | done | `1cee649` | 14 checks added; targeted 474 tests; `check:headless`; prod build |
| T13 VariantB tokens/primitives | done | `41dee7d` | primitive 54/54; unit 1831; `check:headless`; Chromium token observation |
| T14 battle dialogs | done | `f0f9f90` | TDD 9 red → 28 green; unit 1835; component 1117; `check:headless` |
| T15 deck-editor panels | done | `ce76272` | TDD 9 red → 11 green; component 1128; unit/headless/build; Chromium desktop + portrait |
| T16 story overlays | done | `f0b04fa` | component 1130; unit 1835; `check:headless`; five overlays in desktop + mobile Chromium |
| T17 verification/docs closeout | blocked validation | `8d950c7` | docs shipped; headless/component/build/reproducibility green; full E2E blocked below |

## Verification

### Green

- `npm run check:headless`: 23 legacy tests, 162 unit files / 1835 passed + 2 skipped, 17 integration files / 42 passed; vendor/assets/snapshot verification OK.
- `npm run test:component`: 118 files / 1130 passed.
- `npm run build`: OK; build budgets: shell 96,805 B, battle 358,272 B, deck-editor 149,985 B, story 141,218 B.
- `npm run build:reproducible`: `{ "status": "ok", "files": 786 }`.
- Card-back acquisition: `generated/card-images/card-back.jpg`, 44,343 B, SHA-256 `8b3fee7055b0b819ff3f84bb3c91274cd207f9f3a33966e239c3095b90f9c656`.

### Blocked gate

`npm run check:browser` reached `playwright test`. First deck-editor test failed:

```text
Test timeout of 180000ms exceeded.
Error: locator.click: Test timeout of 180000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Create deck' })
```

Rendered accessible name is `+ Create` (`src/deck-select/DeckSelectScreen.svelte:550`); stale locator is `e2e/deck-editor.spec.ts:154`. Eight deck-editor cases then repeated the same ~3.1-minute wait. Run stopped to avoid hours of duplicate timeouts. Docs-only T17 diff cannot cause this mismatch. Fix would touch excluded deck-select/E2E contract, so bounded repair was not applied. Remaining E2E + acceptance tests are unproven in final aggregate run.

## Assumptions

### A1 — Orchestration model routing

Requested Luna alias mapped to unavailable OpenRouter credentials; later custom worker default mapped to disabled Claude subscription. Workers rerouted to runtime-loaded `openai-codex/gpt-5.6-sol`. Implementation policy unchanged.

### A2 — T2 phase-bar height

Used `3rem`, not ticket's `2.5rem`: 48px is smallest height preserving existing 44px interactive floor plus borders. Chromium still measured +9.86% field area.

### A3 — T3 placement coordinates

Kept `placement.x/y` unchanged because CSS positions by center (`translate(-50%, -50%)`). Ticket's proposed half-padding offset would shift stacks 3px off center.

### A4 — T5 hand headroom

Used `0.17`, not `0.14`: Chromium measured 3.22px clipping at 0.14. Added viewport height growth because padding alone cannot move clip edge under global `border-box`.

### A5 — T6 selection recency

Session array is rebuilt in prompt order, not toggle order. Small diff-based recency tracker selects most recently toggled hand card.

### A6 — T10 engine behavior

Pinned core's tested XYZ detach scenario exposes no individual overlay addresses and auto-resolves detach. Dialog route is unit/component verified for overlay-bearing prompts; real-engine material selection remains unavailable without out-of-scope worker/core behavior.

### A7 — T14 PromptDialog title

`PromptControls` is shared outside dialogs. `PromptDialog` adds title class to its nested heading on mount, avoiding out-of-scope styling or exported-prop widening.

## Residual Risks

- T2: three pre-existing stage-margin E2E assertions expect 1920px while shipped stage is 1904px after 8px margins.
- T3: pre-existing stack `min-width` can exceed card width at very small geometry.
- T9: fresh non-pass guard intentionally surfaces every real fresh activation, not only GY triggers → more default-mode prompts.
- T10: core limitation described in A6.
- T17: browser/acceptance aggregate gate incomplete due stale `Create deck` locator.
- Existing Svelte warnings remain: missing ARIA role on `CardCatalog.svelte` mouseleave container; missing standard `line-clamp` in `ShopSellScreen.svelte`.

## User TODO

- [ ] Decide accessible-name contract for shared create control: keep visible/accessibility name `+ Create` and update stale E2E locators, or add `aria-label="Create deck"`. Then run `npm run check:browser`.
- [ ] Run new human checks in `artifacts/manual_test_checklist.md` for duel feedback items 1–14 and Basilica VariantB surfaces.

## Files Touched

Implementation commits touch battle UI/prompt logic, deck-editor components, story overlay shell, shared styles/tokens, diagnostics client, asset scripts, tests, `DESIGN.md`, and durable manual checklist. Frozen `vendor/` untouched. Owner-authored `feedback.md` untouched by this implementation.
