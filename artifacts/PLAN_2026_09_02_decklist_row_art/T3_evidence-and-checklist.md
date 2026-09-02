# T3: evidence + checklist

**Plan:** `./artifacts/PLAN_2026_09_02_decklist_row_art.md`
**Depends:** T2
**Commit outcome:** slice proven in Chromium, budgets green, durable manual test checklist covers the new rows.

## Context (self-contained)

- Goal: decklist rows show art + frame color (`artifacts/PROTOTYPE_SPEC_decklist_rows.md`).
- This slice: acceptance evidence. Field acceptance uses automated Chromium evidence only; build budgets machine-enforced per domain.
- Out of scope here: behavior changes. Fix-forward only if a gate fails.
- Assumptions in force: T1–T2 merged; **no existing e2e spec visits a decklist surface** (`grep -rn "decklist" e2e/` → no matches) — this ticket adds navigation, it does not merely extend assertions.

## Requirements

- E2E: navigate to a decklist surface, assert the approved row. Extend an existing spec file; no new browser project.
- `artifacts/manual_test_checklist.md` (durable) gains steps for the three surfaces.
- No budget regression: `npm run build:verify` passes.

## Inputs

- **From T2:** rows on dock + floats; `data-cy` values: rows `deck-select-docked-list-row-{code}` / `deck-select-hover-list-row-{code}`, cp `…-row-copies-{code}`, art `…-row-art-{code}`. Dock renders only with a selected deck (`DeckSelectScreen.svelte:162` `docked` needs library mode + non-null resolver; `loadRest` needs a selected key); hover float needs pointer hover in duel-start mode.
- `e2e/` — existing specs; pick the one already reaching the deck editor library (locate: `grep -rln "deck-editor\|library" e2e/`), else the free-play flow in `e2e/duel-smoke.spec.ts`.
- `artifacts/manual_test_checklist.md` — append in its existing format.

## Interface contract (level 5)

- **Produces:** Playwright steps + assertions, shape:

```ts
// navigate: shell → deck editor → library → select/click a deck tile
const row = page.locator('[data-cy^="deck-select-docked-list-row-"]').first();
await expect(row).toBeVisible();
await expect(row).toHaveCSS("border-left-width", "5px");
await expect(row.locator('[data-cy*="-row-copies-"]')).toHaveCount(1);
await expect(row.locator('[data-cy*="-row-art-"]')).toHaveCount(1); // bundled decks have art
```

- **Consumes:** T2 `data-cy` contract verbatim.
- **Errors:** failing gate → quote exact output; one bounded repair loop, then stop and report.
- **Invariants:** DOM/CSS assertions, no screenshot-only evidence.
- **Integration links:** trigger: `npx playwright test <spec>` → dispatch: built app served to Chromium → receive: DOM assertions above → observe: Playwright pass report + `npm run build:verify` budget output.

## TDD

1. **Red** — prove assertions can fail: run once with a mutated selector (`-row-x-`) → red.
2. **Green** — real selectors against current build.
3. **Refactor** — none expected.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| e2e row visual | deck editor library, deck selected | row visible, 5px left border, cp + art spans present |
| build gates | `npm run build:verify` | all domain budgets pass |
| full suites | `npm run check:headless` + `npm run test:component` | green |

## Impl steps

- [x] 1. Add navigation + assertions to the chosen e2e spec; mutate-selector red check; green run.
- [x] 2. `npm run build:verify` — capture output.
- [x] 3. Append manual steps to `artifacts/manual_test_checklist.md`: (a) deck editor → library → select deck → dock shows art rows, colored borders, counts, aligned names; (b) free play → hover deck tile → float same; (c) story → pre-battle → float same; (d) missing art → row still readable (color + name).
- [x] 4. Update `docs/GLOSSARY.md` if "frame colour" / "decklist row" absent (make-glossary-aron).

## Validation

- [x] tests pass: focused Playwright 1/1; `build:verify` status `ok`; `check:headless` exit 0; component 112 files / 1059 tests
- [x] manual check: covered by checklist additions
- [x] no silent-failure swallow added — `none`
- [x] app functional — evidence above
- [x] commit msg draft: `test(e2e): prove decklist art rows in Chromium and record manual checks`
