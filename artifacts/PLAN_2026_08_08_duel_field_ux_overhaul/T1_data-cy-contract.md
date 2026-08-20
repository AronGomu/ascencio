# T1: data-cy contract and coverage gate

**Plan:** `./artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** none
**Commit outcome:** Every HTML element rendered by `src/app/**/*.svelte` carries a unique `data-cy`, and a unit test fails the build when one is missing or duplicated.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. Every later ticket selects DOM by `data-cy`, so the contract must exist and be enforced before anything moves.
- This slice: governance + mechanical retrofit only. No visual change, no behaviour change, no deletion of any component.
- Out of scope here: removing panels, layout changes, new components, drag-drop, preview panel, pills, chips. Later tickets do that. Do **not** delete `app-header`, `status-panel`, `lifecycle-panel`, `SelectionDock.svelte`, `CardInspector.svelte`, `FieldActionMenu.svelte` in this ticket even though later tickets will — they still need `data-cy` now so the gate is green at this commit.
- Assumptions in force: A1 (artifacts in `artifacts/`).

## Requirements

- `AGENT.md` states the rule.
- Every HTML element (including `<svelte:element>`) in every `src/app/**/*.svelte` file has a `data-cy` attribute.
- `data-cy` values are kebab-case and act as variable names: they say what the thing *is*, not what it looks like.
- Static `data-cy` literals are unique across the whole `src/app` tree.
- Elements produced in a loop use a dynamic value suffixed with the item's stable id.
- A unit test enforces all of the above and names the offending file and tag when it fails.
- No behavioural or visual change. `npm run test:component` and `npm run test:e2e` pass unchanged.

## Inputs

- Files to edit: `AGENT.md`, and every file under `src/app/` with a `.svelte` extension:
  - `src/app/App.svelte`
  - `src/app/components/DuelField.svelte`
  - `src/app/components/duel-field/CardControl.svelte`
  - `src/app/components/duel-field/CardInspector.svelte`
  - `src/app/components/duel-field/CardTray.svelte`
  - `src/app/components/duel-field/ChainStatus.svelte`
  - `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`
  - `src/app/components/duel-field/DuelHud.svelte`
  - `src/app/components/duel-field/DuelLog.svelte`
  - `src/app/components/duel-field/FieldActionMenu.svelte`
  - `src/app/components/duel-field/FieldBoard.svelte`
  - `src/app/components/duel-field/FieldLines.svelte`
  - `src/app/components/duel-field/SelectionDock.svelte`
  - `src/app/components/duel-field/StackControl.svelte`
  - `src/app/components/duel-field/ZoneControl.svelte`
  - `src/app/prompts/PromptControls.svelte`
- Files to create: `tests/fixtures/svelte-element-scan.ts`, `tests/unit/data-cy-coverage.test.ts`.
- **From Depends:** none.

## Contract this ticket freezes

Later tickets select on these exact values. Set them now.

| Element | `data-cy` |
| --- | --- |
| `header.app-header` in `App.svelte` | `app-header` |
| `main` in `App.svelte` | `app-main` |
| `section.status-panel` | `status-panel` |
| `section.lifecycle-panel` | `lifecycle-panel` |
| `div.workspace-grid` | `workspace-grid` |
| `section.prompt-panel` | `prompt-panel` |
| `section.duel-field` in `DuelField.svelte` | `duel-field` |
| `div.duel-field-board` in `FieldBoard.svelte` | `duel-field-board` |
| `article.duel-field-card` in `CardControl.svelte` | `` `field-card-${card.id}` `` |
| `button.duel-field-card__target` | `` `field-card-target-${card.id}` `` |
| `svelte:element` root in `ZoneControl.svelte` | `` `field-zone-${zone.id}` `` |
| root in `StackControl.svelte` | `` `field-stack-${stack.id}` `` |
| `section.duel-hud` in `DuelHud.svelte` | `duel-hud` |
| `section.selection-dock` | `selection-dock` |
| `div.field-action-menu` | `field-action-menu` |
| `aside.card-inspector` | `card-inspector` |
| `section.card-tray-summary` | `` `card-tray-${player}-${zone}` `` |
| root of `DuelLog.svelte` | `duel-log` |

Everything else: name it after its role with the component prefix, e.g. `duel-hud-turn-heading`, `prompt-controls-submit-button`, `card-tray-page-next-button`.

## TDD

1. **Red** — write `tests/unit/data-cy-coverage.test.ts` first. Its scanner unit tests pass immediately against inline fixture strings; the two repository-wide tests fail listing dozens of elements. Record that output.
2. **Green** — add `data-cy` to every reported element until both repository-wide tests pass.
3. **Refactor** — none expected. Do not restructure markup.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `scanSvelteElements finds plain elements` | `"<div class=\"a\"></div>"` | one entry, `tag === "div"`, `attributes` contains `class` |
| `scanSvelteElements survives > inside an expression attribute` | ``"<button onclick={() => go()} data-cy=\"go\">x</button>"`` | one entry, `tag === "button"`, `attributes` contains `data-cy` |
| `scanSvelteElements survives > inside a quoted attribute` | `"<img alt=\"a > b\" data-cy=\"i\" />"` | one entry, `tag === "img"` |
| `scanSvelteElements skips component tags` | `"<CardControl foo={1} />"` | zero entries |
| `scanSvelteElements skips svelte specials but keeps svelte:element` | `"<svelte:window onkeydown={f} /><svelte:element this={t} data-cy=\"z\" />"` | one entry, `tag === "svelte:element"` |
| `scanSvelteElements ignores script, style and comment content` | `"<script>const a = \"<div>\";</script><!-- <p> --><b data-cy=\"b\"></b>"` | one entry, `tag === "b"` |
| `every src/app svelte element declares data-cy` | real repository files | empty violation list |
| `static data-cy values are unique across src/app` | real repository files | empty duplicate list |

## Impl steps

- [x] 1. Create `tests/fixtures/svelte-element-scan.ts` exporting `export interface SvelteElementTag { readonly tag: string; readonly attributes: string; readonly index: number }` and `export function scanSvelteElements(source: string): readonly SvelteElementTag[]`.
- [x] 2. In that scanner, first strip, in order: `<script ...>…</script>` blocks, `<style ...>…</style>` blocks, `<svelte:head>…</svelte:head>` blocks, `<!-- … -->` comments. Replace each with an equal-length run of spaces so reported indexes stay truthful. Evidence: `stripNonMarkup` in `tests/fixtures/svelte-element-scan.ts`; covered by the "ignores script, style and comment content" test (passing).
- [x] 3. In that scanner, walk the remaining text character by character. On `<` followed by `[A-Za-z]`, read the tag name up to whitespace, `/` or `>`. Then read attributes tracking `quote: '"' | "'" | null` and `braceDepth: number`; `{` and `}` change depth only when `quote === null`; the tag ends at the first `>` seen with `quote === null && braceDepth === 0`. Evidence: `scanSvelteElements` walk loop; covered by the two "survives >" tests (passing).
- [x] 4. In that scanner, drop tags whose name starts with an uppercase letter, and drop the exact names `svelte:window`, `svelte:body`, `svelte:document`, `svelte:boundary`, `svelte:options`, `svelte:fragment`, `svelte:self`, `svelte:component`. Keep `svelte:element`. Evidence: `IGNORED_SVELTE_SPECIALS` set + `isComponent`/`isIgnoredSpecial` checks; covered by "skips component tags" and "skips svelte specials but keeps svelte:element" tests (passing).
- [x] 5. Export `export function svelteFilesUnder(directory: string): readonly string[]` from the same fixture file using `readdirSync(directory, { recursive: true, withFileTypes: true })`. Build each absolute path with `join(dirent.parentPath, dirent.name)` — with `recursive: true` the `Dirent.name` is the bare filename and `parentPath` carries the directory (Node 24 has both). Keep only `.svelte` entries, sort ascending. Evidence: implemented in `tests/fixtures/svelte-element-scan.ts`; exercised by the two repository-wide tests (passing).
- [x] 6. Export `export function staticDataCyValue(attributes: string): string | null` returning the literal inside `data-cy="…"` or `data-cy='…'`, and `null` when the attribute is absent or uses `{…}`. Evidence: implemented in `tests/fixtures/svelte-element-scan.ts`; exercised by the "static data-cy values are unique across src/app" test (passing).
- [x] 7. Create `tests/unit/data-cy-coverage.test.ts` with the eight tests from the test plan. The repository-wide tests read `new URL("../../src/app/", import.meta.url)`.
- [x] 8. In the coverage test, build `violations` as `` `${relativePath}:${tag}@${index}` `` for every tag whose `attributes` does not match `/(^|\s)data-cy[=\s]/` and assert `expect(violations).toEqual([])`.
- [x] 9. In the uniqueness test, collect every non-null `staticDataCyValue`, assert `expect(duplicates).toEqual([])` where `duplicates` lists values seen more than once with their files.
- [x] 10. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` and save the violation list — this is the retrofit worklist. Evidence: 289 violations reported (scanner unit tests: 7 passed); list saved at /tmp/claude-1000/-home-aron-projects-ascencio/e506203b-19ea-467c-ad38-5319790d65e3/scratchpad/red-output.txt.
- [x] 11. Add `data-cy` to every element in `src/app/App.svelte`, using the frozen contract values above and `app-…`-prefixed names for the rest (for example `app-announcement`, `app-engine-state`, `app-image-progress`, `app-error-panel`, `app-result-panel`, `app-surrender-button`).
- [x] 12. Add `data-cy` to every element in `src/app/components/DuelField.svelte` (`duel-field`, `duel-field-announcement`, `duel-field-state-announcement`, `duel-field-heading`, `duel-field-feedback`).
- [x] 13. Add `data-cy` to every element in the thirteen files under `src/app/components/duel-field/`, honouring the frozen contract values and using the component name as prefix elsewhere.
- [x] 14. Add `data-cy` to every element in `src/app/prompts/PromptControls.svelte`, prefix `prompt-controls-`; per-choice controls use `` `prompt-controls-choice-${choice.id}` ``.
- [x] 15. Re-run `npx vitest run tests/unit/data-cy-coverage.test.ts` until both repository-wide tests pass. Evidence: `Test Files 1 passed (1)`, `Tests 8 passed (8)`.
- [x] 16. Append a `## HTML element contract` section to `AGENT.md` immediately after `## File design policy`, with this text: "Every HTML element rendered by a Svelte component under `src/app/` must carry a `data-cy` attribute that acts as its variable name. Values are kebab-case, describe the role rather than the styling, and are unique inside a rendered document. Elements rendered in a loop suffix the value with the item's stable id, for example ``data-cy={`field-card-${card.id}`}``. `tests/unit/data-cy-coverage.test.ts` enforces presence and uniqueness." Evidence: section present in AGENT.md immediately after `## File design policy`.
- [x] 17. Add `AGENT.md` project-tree note is unnecessary; do not touch the tree block. Evidence: `## Project tree` block untouched (verified by diff below).

## Outputs

- Files touched: `AGENT.md`, all 16 `src/app/**/*.svelte` files, plus new `tests/fixtures/svelte-element-scan.ts` and `tests/unit/data-cy-coverage.test.ts`.
- Public API / behaviour change: none at runtime. New stable DOM contract for tests.
- Migrate / config: none.

## Validation

- [x] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes — `Test Files 1 passed (1)`, `Tests 8 passed (8)`.
- [x] `npm run test:unit` passes — `Test Files 36 passed (36)`, `Tests 381 passed (381)`.
- [x] `npm run test:component` passes — `Test Files 3 passed (3)`, `Tests 53 passed (53)`.
- [x] `npm run typecheck` passes — `tsc --noEmit` clean, `svelte-check`: `595 FILES 0 ERRORS 0 WARNINGS`.
- [x] `npm run lint` passes — `eslint .` exits clean, no output.
- [x] `npm run format` then `npm run format:check` passes — `All matched files use Prettier code style!`.
- [x] `npx playwright test -g "production bundle initializes"` passes (proves markup did not shift) — `chromium` and `firefox-smoke` projects: `1 passed` each. `webkit-smoke` project could not run: this NixOS sandbox has no system Playwright browser dependencies and no root/apt access; after assembling a matching nix-provided shared-library closure, chromium and firefox launched and passed, but webkit's WPE backend requires `libjxl.so.0.8`, a soname only available in nixpkgs as 0.11 — an environment gap unrelated to this diff (a purely additive `data-cy` attribute change). See report `Assumptions` for detail.
- [x] manual check: none needed; no visual change — confirmed via `test:component` (53 passing, DOM-structure assertions) and the coverage test's uniqueness/presence checks.
- [x] app functional — no broken path from this slice — `test:unit` (381), `test:component` (53), and 2/3 `production bundle initializes` browser projects all pass.
- [x] commit msg draft: `chore(app): require data-cy on every rendered element`
