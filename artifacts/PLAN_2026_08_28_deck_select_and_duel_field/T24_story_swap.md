# T24: Story pre-battle swap

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** T17, T23
**Commit outcome:** The story pre-battle screen renders the shared `DeckSelectScreen` in `duel-start` mode — deck tile grid with favourites, locked opponent seat card ("🔒 Set by the story"), illegal decks visible-but-disabled with reasons, block notices, Start latch preserved. Component + e2e tests green.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md`) — Free Play and Story share the exact screen; story differences: opponent fixed by the encounter (portrait/name/deck locked), illegal decks listed disabled with the reason (free play hides them), library = the save's decks.
- This slice: story domain swap. Encounter briefing copy (title/eyebrow/facts) survives as the screen's eyebrow/title + block notice; the old two-column briefing layout is replaced by the shared screen.
- Out of scope here: story deck rename/duplicate/delete from this screen — `manageable=false`; the save's decks are managed through the story deck-editor route the screen's Open action already reaches (existing `onopendecks` save-first flow). Logged as plan assumption; kebab arrives for story in a later round if the owner asks.
- Assumptions in force: T17 `DeckSelectScreen` props (quoted below); T23 `StoryState.favouriteDeckIds` + reducer command `{ type: "deck-set-favourite", id, favourite }`; story verdicts come from `preBattleDeckOptions` (`src/story/decks/pre-battle-decks.ts` — recomputed live, never `deck.validation` cache); default = save's `defaultDeckId`; selecting a deck records `deck-set-default` (current behavior, kept).

## Requirements

- Rewrite `src/story/screens/PreBattleScreen.svelte` hosting `DeckSelectScreen`. Keep file name + props (`allowReturn,decks,defaultDeckId,decksError,onstart,onreturn,onselectdeck,onretrydecks,onopendecks`) so `src/story/StoryApp.svelte` (~line 914) wiring survives; add props the tiles need:

```ts
/** The save's decks as records, for counts/cover/decklists; pairs with `decks` (verdicts) by id. */
export let deckRecords: readonly StoryDeck[] = [];
export let favouriteDeckIds: readonly string[] = [];
export let onfavourite: (id: string, favourite: boolean) => void = () => undefined;
export let catalog: ReadonlyMap<number, DeckBuilderCardView> = new Map();
/** Encounter identity for the locked seat card. */
export let opponentName = "Rin's Echo";
export let opponentDeckName = "Relay Deck";
```

  `StoryApp.svelte` passes `deckRecords={state.decks}`, `favouriteDeckIds={state.favouriteDeckIds}`, `onfavourite={(id, favourite) => dispatch({ type: "deck-set-favourite", id, favourite })}`, `catalog={cardViewByCode}`.
- Mapping in new `src/story/decks/pre-battle-tiles.ts` (pure, tested):

```ts
export function preBattleDeckTile(
  option: PreBattleDeckOption,            // {id,name,legal,issue}
  record: StoryDeck | undefined,          // matched by id; undefined defends a mid-flush mismatch
  context: Readonly<{
    catalog: ReadonlyMap<number, DeckBuilderCardView>;
    favouriteDeckIds: readonly string[];
    defaultDeckId: string | null;
  }>,
): DeckTileModel;
```

  - `key=option.id`, `name=option.name`, counts/cover from `record` lists (absent record → zeros/null), `legal=option.legal`, `blockReason=option.issue`, `meta = option.issue ?? "Save deck"`, `bundled=false`, `lockedBy=null`, `deletable=false`, `favourite`/`isDefault` from context, `updatedAt = record?.updatedAt ?? null`.
- Screen usage inside `PreBattleScreen.svelte`:
  - `mode="duel-start"`, `eyebrow="Pre-battle briefing"`, `title={opponentName}`, `manageable=false`, `startLabel="Start Duel"`.
  - `opponent = { id: "encounter", name: opponentName, line: "Set by the story", locked: true }`; `opponents=[]`; `opponentDeck` = locked tile `{key:"encounter-deck", name: opponentDeckName, meta:"🔒 Set by the story", deletable:false, ...}` with real counts from the encounter deck — `src/story/decks/encounter-deck.ts` builds the opponent selection for the handoff, so its lists exist; read that file for the exact export (F1) and derive counts from it.
  - Selection: preserve current semantics verbatim — `chosenId ?? preBattleSelection(decks, defaultDeckId)` opening pick, `onselect` → `choose(id)` (records `deck-set-default` once per deck via existing `record()` latch), Start latch `started`, `leaving` latch on `onopendecks`, `blocked = decksError !== null || decks === null || block !== null`.
  - `blockNotice`: `decksError` → error + retry affordance; `decks === null` → "Checking your decks against the card database…" status; `preBattleBlock(...)` → its `reason` with the block action button ("Build a deck"/"Open the deck editor" → `leave()`). Retry + block-action buttons don't exist in the shared screen — render them under it in this component (own `data-cy`: keep `story-briefing-deck-error-retry`, `story-briefing-block-action`, `story-briefing-checkpoint` "Your progress is saved before the duel starts.").
  - `canStart = !blocked && selectedId !== null`; `onstart` → existing `start()` (records fallback selection, latches, calls `onstart` prop). `onback` → `onreturn`. `allowReturn=false` must hide the back control, and the screen has no prop for that — this ticket adds `export let showBack = true;` to `DeckSelectScreen` (hides both footer Back and the narrow back icon), component-tested; PreBattle passes `showBack={allowReturn}`.
  - `decklistFor(id)` → record lists → rows named via `catalog`; `cardImageFor(code)` → `catalog.get(code)?.imageUrl ?? null`.
- Old briefing markup (`story-briefing-*` facts grid, deck rows) replaced; keep `data-cy` names still asserted by story e2e where the element survives (`story-briefing-start` → now `deck-select-start`; update tests instead of aliasing — `git grep -ln "story-briefing" tests/ e2e/`).
- Story is save-owned: illegal decks stay visible + disabled with reason (design), which the tile already does via `legal/blockReason`.

## Inputs

- `src/story/screens/PreBattleScreen.svelte` — current latches (`started`, `leaving`, `chosenId`, `recordedId`), `record()`, `choose()`, `leave()`, `start()` — port verbatim.
- `src/story/decks/pre-battle-decks.ts` — `PreBattleDeckOption`, `preBattleSelection`, `preBattleBlock` (unchanged).
- `src/story/StoryApp.svelte` ~line 914 mount + `cardViewByCode` (~line 172), `preBattleDeckChoices` (~line 365).
- `src/story/decks/encounter-deck.ts` — opponent deck lists (read for exact export).
- `src/story/model/story-state.ts` — `StoryDeck` shape (extends `DeckRecord`: `main/extra/side/updatedAt` present).
- **From T17:** `DeckSelectScreen` props `mode,eyebrow,title,tiles,sort,selectedKey,startLabel,canStart,blockNotice,manageable,opponent,opponents,opponentDeck,playerDeck,seat,decklistFor,cardImageFor,onselect,onstart,onback,onfavourite,forceNarrow` from `src/deck-select/index.ts`; locked opponent renders non-interactive with `🔒 Set by the story` caption (T15).
- **From T23:** `favouriteDeckIds` on state; command `deck-set-favourite`.

## TDD

1. **Red** — `tests/unit/story/pre-battle-tiles.test.ts` + rewrite `tests/component/story/pre-battle-deck-picker.test.ts`; fail.
2. **Green** — implement.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `option+record map to tile` | legal option, record 40/2/0, favourited, default | counts, cover, favourite, isDefault, deletable=false |
| `illegal option keeps its reason` | `legal=false, issue="Main deck has 39 cards..."` | `legal=false`, `blockReason` = issue, meta = issue |
| `default deck opens selected; picking records once` | decks + default d2, click d1 twice | selected d1, exactly one `deck-set-default` dispatch |
| `illegal tiles render disabled, never selectable` | 1 legal + 1 illegal | illegal tile press disabled, arrows skip it |
| `locked opponent seat` | render | non-interactive portrait, `duel-start-opponent-deck-locked` caption, no picker |
| `favourite star dispatches story command` | star d1 | `onfavourite("d1", true)` |
| `no-decks block offers build` | `decks=[]` | block reason + `story-briefing-block-action` "Build a deck", start disabled |
| `catalog pending holds start` | `decks=null` | status text, start disabled |
| `start latches once` | valid pick, double-press start | `onstart` once, button "Entering duel…" |
| `showBack=false hides back` (deck-select test) | prop false | no back control |
| e2e `story-duel` | full story flow via new selectors | green |

Run: `npx vitest run tests/unit/story tests/component/story tests/component/deck-select && npx playwright test e2e/story-duel.spec.ts`

## Impl steps

- [ ] 1. Add `showBack` prop + test to `DeckSelectScreen`.
- [ ] 2. Read `src/story/decks/encounter-deck.ts`; note opponent deck lists export.
- [ ] 3. Write failing `tests/unit/story/pre-battle-tiles.test.ts`; implement `src/story/decks/pre-battle-tiles.ts`.
- [ ] 4. Rewrite `tests/component/story/pre-battle-deck-picker.test.ts` (red), then `PreBattleScreen.svelte` per Requirements.
- [ ] 5. Wire new props in `StoryApp.svelte`.
- [ ] 6. Update selectors: `git grep -ln "story-briefing" tests/ e2e/` → adjust.
- [ ] 7. `npx vitest run tests/unit tests/component` green; `npx playwright test e2e/story-duel.spec.ts` green.
- [ ] 8. `npm run lint && npm run typecheck && npm run build` → green.

## Outputs

- New: `src/story/decks/pre-battle-tiles.ts`, `tests/unit/story/pre-battle-tiles.test.ts`.
- Edited: `src/story/screens/PreBattleScreen.svelte` (rewritten), `src/story/StoryApp.svelte`, `src/deck-select/DeckSelectScreen.svelte` (+`showBack`), story component/e2e tests.
- Public API: none cross-domain beyond `showBack` prop.

## Validation

- [ ] `npx vitest run tests/unit tests/component` green
- [ ] `npx playwright test e2e/story-duel.spec.ts` green
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] manual: story pre-battle shows tiles, locked opponent, favourite star persists in save, start latch works
- [ ] commit msg draft: `feat(story): run the pre-battle briefing on the shared deck-selection screen`
