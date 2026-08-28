# T21: Free-play deck management ops

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** T20
**Commit outcome:** On the free-play duel-start screen, local decks can be renamed, duplicated and deleted from kebab or footer; Open jumps into the deck editor on that deck. Bundled/AI-owned decks stay undeletable. Listing refreshes after every op.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md` §Deck actions (kebab menu), §Desktop layout footer) — duel start manages the library in place, kebab and footer being two paths to identical operations.
- This slice: mutation wiring for free play. T20 shipped the screen with `manageable=false`; this flips it on.
- Out of scope here: deck-editor library swap (T22), story (T24), new repository capabilities beyond what exists + `renameDeck` semantics done via load-save.
- Assumptions in force: T20's `FreePlayMatchSetup.svelte` hosts `DeckSelectScreen` with callbacks `onrename(key,name)`, `onduplicate(key)`, `ondelete(key)`, `onopen(key)`; tile mapping fn `freePlayDeckTile` sets `deletable = source === "local"`; local key format `local:${deckId}:${revision}`.

## Requirements

- New `src/shell/screens/free-play-deck-actions.ts` — one op per fn, each opens `IndexedDbDeckRepository`, acts, closes (pattern: `loadFreePlayDecks` in `src/shell/screens/free-play-deck-listing.ts`):

```ts
import { deckId, type DeckId } from "../../decks/index.ts";

/** local:${id}:${revision} -> { id, revision }; null for preset keys. */
export function parseLocalDeckKey(key: string): Readonly<{ id: DeckId; revision: number }> | null;

export async function renameLocalDeck(key: string, name: string): Promise<void>;
export async function duplicateLocalDeck(key: string): Promise<void>;
export async function deleteLocalDeck(key: string): Promise<void>;
```

  - `renameLocalDeck`: `load(id)` → `save(revision, { ...deck, name: trimmed, updatedAt: new Date().toISOString(), revision: revision + 1 }, history)` — read `src/decks/indexeddb-deck-repository.ts` `save` contract first (F1: whether save bumps revision itself; mirror what `src/deck-editor/deck-editor-store.ts` `rename(name)` at line ~421 does and reuse its exact field handling).
  - `duplicateLocalDeck`: mirror `deck-editor-store.ts` `duplicate(id)` (~line 452) semantics: new id, name suffix, fresh history. Copy the record-building shape, not the store plumbing.
  - `deleteLocalDeck`: `repository.delete(id, revision)`.
  - Preset key passed to any op → throw `Error("Bundled decks cannot be modified")` (UI never offers it; the throw is the guard).
- `FreePlayMatchSetup.svelte`:
  - `manageable=true`.
  - `onrename` → `renameLocalDeck` → `refreshFreePlayDecks(loadBattle)` → re-seed selection (renamed deck's key changed revision → re-resolve by deckId prefix `local:${id}:`, keep it selected).
  - `onduplicate` → `duplicateLocalDeck` → refresh → select the new copy (design: "creates an editable local copy and selects it" — newest `updatedAt` local deck after refresh).
  - `ondelete` → `deleteLocalDeck` → refresh → if deleted deck was a seat's pick, re-seed via existing fallback chain (T20 ported `seatKey`).
  - `onopen(key)`: local → navigate to that deck in the editor — call new prop? No: existing prop `ondecks()` goes to the library route. Extend `FreePlayMatchSetup` props with `export let onopendeck: (id: string) => void = () => undefined;` and wire in `src/shell/AppShell.svelte`: `onopendeck={(id) => store.navigate(deckRoute("free-play", deckId(id)))}` (import `deckRoute` already used there ~line 567; `deckId` from `src/decks/index.ts`). Preset deck open → `ondecks()` (library root; presets have no editor page).
  - Op failure (IndexedDB refused, revision conflict) → `blockNotice` = error message; screen stays usable.
- All ops are user-local data mutations behind explicit confirm dialogs (delete) — no extra confirmation layer beyond T13's `DeleteDeckConfirm`.

## Inputs

- `src/deck-editor/deck-editor-store.ts` — `rename` (~421), `duplicate` (~452), `deleteDeck` (~500) for exact record semantics. **Do not import the store** (deck-editor is another domain); replicate the repository calls in the shell module.
- `src/decks/indexeddb-deck-repository.ts`, `src/decks/deck-repository.ts` — `load/save/delete` contracts.
- `src/shell/AppShell.svelte` — FreePlayMatchSetup mount (~line 560) + `deckRoute` usage (~line 567).
- **From Depends (T20):** `FreePlayMatchSetup.svelte` hosts screen with `manageable` prop; `refreshFreePlayDecks(loadBattle)` revalidates; seat re-seed fn ported from old `seatKey`; local key format `local:${deckId}:${revision}`.

## TDD

1. **Red** — unit tests for `free-play-deck-actions.ts` against `fake-indexeddb` or the repo's existing fake repository test double (find: `git grep -ln "IndexedDbDeckRepository" tests/` and reuse that harness); component tests for the wiring; fail.
2. **Green** — implement.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `parseLocalDeckKey round-trips` | `local:abc:3` / `preset:nekroz` | `{id:"abc",revision:3}` / null |
| `rename persists new name and bumps revision` | seeded deck, rename "New" | reloaded record name "New", revision +1 per repository contract |
| `duplicate creates independent copy` | seeded deck | 2 records, distinct ids, copy name suffixed |
| `delete removes record` | seeded deck | `list()` empty |
| `preset key throws` | `renameLocalDeck("preset:nekroz", "x")` | rejects `Bundled decks cannot be modified` |
| `screen: rename via kebab updates tile and keeps selection` | rename selected local deck | tile shows new name, still selected |
| `screen: duplicate selects the copy` | duplicate k1 | selection = new key |
| `screen: delete re-seeds the seat` | delete selected local deck | selection falls back to remembered/default per seat chain |
| `screen: open on local deck reports deck id` | kebab Open on `local:abc:3` | `onopendeck("abc")` |
| `screen: op failure surfaces as block notice` | repository save rejects | `deck-select-block-notice` shows message |

Run: `npx vitest run tests/unit/shell tests/component/FreePlayMatchSetup.test.ts`

## Impl steps

- [x] 1. Locate repository test harness (`git grep -ln "IndexedDbDeckRepository" tests/`); write failing `tests/unit/shell/free-play-deck-actions.test.ts`. — harness = `tests/unit/decks/indexeddb-deck-repository.test.ts` (`fake-indexeddb/auto` + `deleteDB`); red: `Error: Cannot find module '.../free-play-deck-actions.ts'`.
- [x] 2. Read `deck-editor-store.ts` rename/duplicate/delete + repository `save` contract; note revision handling verbatim. — `save` sets `revision: expectedRevision + 1` and `updatedAt` itself (`indexeddb-deck-repository.ts:236-241`); `create` forces `revision: 1`. Caller passes the record unchanged but for `name`, as `renameDeck` does.
- [x] 3. Create `src/shell/screens/free-play-deck-actions.ts`. — file exists; `npx vitest run tests/unit/shell/free-play-deck-actions.test.ts` → 7 passed.
- [x] 4. Extend `tests/component/FreePlayMatchSetup.test.ts` with the 5 screen cases (red), then wire callbacks + `manageable=true` + `onopendeck` prop in `FreePlayMatchSetup.svelte`. — red: 6 failed | 16 passed; green: 22 passed.
- [x] 5. Wire `onopendeck` in `src/shell/AppShell.svelte` via `deckRoute("free-play", deckId(id))`. — `AppShell.svelte:570`.
- [x] 6. `npx vitest run tests/unit tests/component` → green. — 266 files, 2822 passed | 2 skipped.
- [x] 7. Manual: rename/duplicate/delete a local deck from `#/free-play`; Open lands in editor on that deck. — walked in real Chromium against the production build (scratch Playwright spec, since an agent cannot press the buttons itself): rename keeps the seat under the new key, duplicate seats the copy, delete removes it with no block notice, bundled Delete stays disabled, Open lands on `#/free-play/decks/<id>` with the deck's name in the editor. 1 passed.
- [x] 8. `npm run lint && npm run typecheck && npm run build` → green. — eslint clean; `svelte-check found 0 errors and 2 warnings in 2 files` (both pre-existing, in `deck-editor` and `story`); `build:verify` → `"status": "ok"`, shell chunk 93,373 bytes.

## Outputs

- New: `src/shell/screens/free-play-deck-actions.ts`, `tests/unit/shell/free-play-deck-actions.test.ts`.
- Edited: `src/shell/screens/FreePlayMatchSetup.svelte`, `src/shell/AppShell.svelte`, `tests/component/FreePlayMatchSetup.test.ts`.
- Public API: none new cross-domain; `onopendeck(id)` prop consumed by AppShell.

## Validation

- [x] `npx vitest run tests/unit tests/component` green — `Test Files 266 passed (266)`, `Tests 2822 passed | 2 skipped (2824)`
- [x] `npm run lint && npm run typecheck && npm run build` green — plus `npm run check:headless` (format, lint, typecheck, legacy 23, unit 1778, integration 39, vendor/assets/snapshot ok) and `npm run test:component` (110 files, 1046 passed)
- [x] manual pass per step 7 — Chromium walkthrough passed
- [x] commit msg draft: `feat(shell): manage local decks from the duel-start screen itself`
