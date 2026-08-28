# T8: SelectableDeck lists + updatedAt

**Plan:** `./artifacts/PLAN_2026_08_27_deck_selection_screen.md`
**Depends:** T1
**Commit outcome:** Every `SelectableDeck` (bundled and local) carries its full card lists and, for locals, `updatedAt` — enough for tiles to show `Main N · Extra N · Side N`, cover art (first Extra else first Main), and modified-sort. Existing consumers unaffected.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md` §Data model gaps) — tiles need counts, cover card, last-modified; today `SelectableDeck` carries only `key,label,source,selection`.
- This slice: data widening inside the battle domain, exported through the existing `src/battle/index.ts` entry (type shape widens; frozen export **names** unchanged → boundary test untouched).
- Out of scope here: `DeckRecord.coverCardCode` field (design's "suggested fix" — NOT taken; cover derives from lists, no schema change), UI, consumers.
- Assumptions in force: cover card rule = first Extra card, else first Main card, else null — derived by hosts from `lists`, no stored field.

## Requirements

- Edit `src/battle/decks/selectable-decks.ts`:

```ts
export interface SelectableDeck {
  readonly key: string;
  readonly label: string;
  readonly source: "preset" | "local";
  readonly selection: BattleDeckSelection;
  /** The deck's cards, for tiles: counts, cover art, hover decklists. */
  readonly lists: Readonly<{
    readonly main: readonly number[];
    readonly extra: readonly number[];
    readonly side: readonly number[];
  }>;
  /** Local decks: `DeckRecord.updatedAt` ISO. Presets: null (bundled, dateless). */
  readonly updatedAt: string | null;
}
```

- `listSelectableDecks(...)`: local branch already holds `deck` (`ValidatedDeckSnapshot` with `main/extra/side`) and iterates `repository.list()` records — take `updatedAt` from the `DeckRecord` (`record.updatedAt`), `lists` from the resolved snapshot. Freeze `lists`.
- `presetSelectableDecks(presets)`: currently metadata-only. Parse each preset's `.ydk` once via existing parser: `src/battle/duel/presets/deck-parser.ts` over `DECK_SOURCES` map from `src/battle/duel/presets/deck-sources-browser.ts` (`ReadonlyMap<DeckId, string>`, compiled-in strings — sync, cheap). Read `deck-parser.ts` for the exact parse fn name/signature before use (F1); memoize parsed lists per module load so repeated listings don't re-parse.
  - Node-side callers: check whether `presetSelectableDecks` runs under Node tests via `deck-sources-node.ts`; if the browser sources map is browser-only, inject sources: keep signature `presetSelectableDecks(presets)` and import the browser map directly — confirm existing tests (`npx vitest run tests/unit`, `npm run test:legacy`) still pass; if a Node test breaks on the import, thread an optional `sources: ReadonlyMap<DeckId, string>` parameter defaulting to the browser map, and update that test's call.
- No change to `findSelectableDeck`, `supportedDuelCardCodes`, key formats (`preset:${id}`, `local:${id}:${revision}`), or `src/battle/index.ts` export names.

## Inputs

- `src/battle/decks/selectable-decks.ts` — current impl (local branch builds `key/label/source/selection` from `resolveDeck` result; preset branch maps `DeckMetadata`).
- `src/battle/duel/presets/deck-sources-browser.ts` — `export const DECK_SOURCES: ReadonlyMap<DeckId, string>` (line 9).
- `src/battle/duel/presets/deck-parser.ts` — ydk parser (read for exact API).
- `src/decks/deck-contracts.ts` — `DeckRecord.updatedAt: string`.
- Existing tests touching SelectableDeck: `git grep -l "SelectableDeck\|listSelectableDecks\|presetSelectableDecks" tests/` — extend, don't fork.
- **From Depends:** T1 exists but nothing here imports it (this ticket is battle-internal).

## TDD

1. **Red** — extend the existing selectable-decks unit test file (find via grep above; if none exists create `tests/unit/battle/selectable-decks.test.ts`) with lists/updatedAt assertions; fail.
2. **Green** — implement widening.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `preset decks carry parsed lists` | `presetSelectableDecks(DECK_CATALOG)` | every entry `lists.main.length >= 40`-ish (assert `> 0`), `updatedAt === null` |
| `preset lists match the ydk source` | one known preset (e.g. `mvp-player`) | `lists.main.length` equals count parsed independently in test from `DECK_SOURCES.get("mvp-player")` |
| `local decks carry record updatedAt and snapshot lists` | fake repository with one ready deck updatedAt "2026-08-01T00:00:00.000Z" | entry `updatedAt` exact, `lists` equal snapshot lists, frozen |
| `existing key/label/selection shape unchanged` | same fixtures | keys `preset:mvp-player` / `local:<id>:<rev>` as before |

Run: `npx vitest run tests/unit/battle` (plus `npm run test:legacy` if legacy suite covers these — check `package.json` `test:legacy` glob first)

## Impl steps

- [ ] 1. `git grep -ln "listSelectableDecks\|presetSelectableDecks" tests/` — locate existing coverage; write failing tests there (or new file per TDD note).
- [ ] 2. Read `src/battle/duel/presets/deck-parser.ts`; note exact parse fn.
- [ ] 3. Widen `SelectableDeck` interface + both builders in `src/battle/decks/selectable-decks.ts`; memoized preset parse.
- [ ] 4. `npx vitest run tests/unit && npm run test:legacy` → green (fix Node-source injection per Requirements if needed).
- [ ] 5. `npm run lint && npm run typecheck && npm run build` → green.

## Outputs

- Edited: `src/battle/decks/selectable-decks.ts`, selectable-decks test file.
- Public API: `SelectableDeck` gains `lists` + `updatedAt` (via existing `src/battle/index.ts` type export). T10/T11 quote: cover code = `lists.extra[0] ?? lists.main[0] ?? null`.

## Validation

- [ ] `npx vitest run tests/unit && npm run test:legacy` green
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] app functional — existing consumers (`FreePlayMatchSetup`, `free-play-deck-listing`) compile untouched (added fields only)
- [ ] commit msg draft: `feat(duel): carry card lists and modification time on every selectable deck`
