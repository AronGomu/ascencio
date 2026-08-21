# Grill: duel_vn_feedback

Source goals: [`feedback-duel.md`](../../feedback-duel.md), [`feedback-vn.md`](../../feedback-vn.md).

## Round 1 — Scope split, duel interaction model, shop economy & assets

Round doc: [`round-1.html`](round-1.html)

| #   | Question                                               | Answer                                                                                                                          | Precision                                                                                                                                                                                              |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Plan/branch split                                      | One combined plan executed on `main`                                                                                            | Abandon the worktrees — all of them. From this implementation on, everything regroups onto the main worktree forever. Update `AGENTS.md`.                                                              |
| 2   | Duel 5 — own hand order after a search                 | Own hand keeps a stable UI order by arrival; new arrivals append rightmost; engine hand shuffles ignored for local display only | —                                                                                                                                                                                                      |
| 3   | Duel 9 — what "restore last non-bugged state" restores | Replay from the seed with every recorded response except the rejected one, then re-issue that prompt                            | It must land on the last decision where the player had agency — the last decision that produced the error.                                                                                             |
| 4   | Duel 6 — when a drop opens a confirm menu              | Any drop with ≥2 legal actions opens a menu listing them plus Cancel; single-action drops stay instant                          | —                                                                                                                                                                                                      |
| 5   | Duel 4 — click on a hand card with one legal action    | Click always pins the zoom and the button list; the action only fires from its button                                           | A single-action card must be committed either by clicking its action button or by dragging it to the correct location.                                                                                 |
| 6   | Duel 8 — width of the engine-response fix              | Fix `ANNOUNCE_NUMBER` + audit every response encoder against the vendored types, one unit test per prompt kind                  | —                                                                                                                                                                                                      |
| 7   | VN shop 1 — source of set images                       | New `scripts/` acquisition step, pinned upstream, hash-verified like card images, into `generated/`                             | —                                                                                                                                                                                                      |
| 8   | VN reveal 5 — when bought cards enter the collection   | Keep crediting at open time                                                                                                     | An unopened pack is not sellable. The moment you click to open, every card is already in the collection; the reveal is presentation only. Skipping straight to the collection shows them.              |
| 9   | VN reveal 1 — auto-flip pacing and persistence         | ~450 ms left to right, checkbox remembered in the story save, default off, reduced motion cuts the animation not the pacing     | —                                                                                                                                                                                                      |
| 10  | VN — preview surface for the shop screens              | **Not** the existing preview panel — a new component                                                                            | For zoom-on-click in these screens the actual card zooms and its text appears beside it. Different component from the duel/deck preview panel.                                                         |
| 11  | Collection — data ownership and viewer scope           | Story keeps ownership; narrow read-only contract from `src/story/index.ts`; browse-only viewer; deck building not gated         | A collection belongs to one specific story **save**. Several saves ⇒ several independent collections. A story save contains its own collection of cards _and_ its own decks. Free play has every card. |
| 12  | VN 4/5 — home of the shared choice component           | Story-local `src/story/components/ChoiceList.svelte` + a story danger class for cancel/leave                                    | —                                                                                                                                                                                                      |

## Facts (scout, round 1)

- **Duel 8 root cause.** Trace tail: `msg 143` (`ANNOUNCE_NUMBER`) → prompt-149 → response `choice-0-select` (`opponentReason: select_first_legal`) → `msg 1` (`MSG_RETRY`) → `session_closed:failed`. `PromptRegistry.ts:638-654` answers with `value: Number(message.options[rawIndex])`; ocgcore validates that field as an **index** into its own option list, so any option whose value exceeds the list length is rejected — source: `/home/aron/Downloads/ygo-duel-diagnostics-a562f5ad6794.json` entries 474-480, `src/battle/worker/protocol/PromptRegistry.ts:638`, `src/battle/worker/engine/engine-constants.ts:106`, `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts:1897` + `dist/index.js` (`case 19: t.i32(e.value)` — raw write, no mapping).
- **Sibling encoders already send indexes**: `SELECT_OPTION` → `index: rawIndex` (`PromptRegistry.ts:336`), `SELECT_CHAIN` → `index: rawIndex` (`:359`). `ANNOUNCE_CARD` sends a card code, correct for that message.
- **Duel 2 root cause.** `DuelField.svelte:85` declares `imageUrls`; no caller passes it, so `HandZoomOverlay` (`:1043-1045`) always falls back to the "Image unavailable" placeholder (`card-image-cache.ts:331`). Mounted cards are unaffected — `CardControl` leases from `imageLibrary` itself (`CardControl.svelte:114-125`).
- **Duel 10 root cause.** `app.css:2019-2025` centres the hand with `:first-child{margin-left:auto}` + `:last-child{margin-right:auto}`; the opponent band is `flex-direction:row-reverse` (`app.css:2059`), so both autos fall on the same visual side.
- **Duel 5 root cause.** `DuelStateProjector` re-orders the hand on `MSG_SHUFFLE_HAND` (`:895-919`); `HandBand` renders by `card.sequence` (`HandBand.svelte:55`).
- **Duel 4 current behaviour.** `activateCard` fires immediately when `choices.length === 1`, opens the chip menu otherwise — `DuelField.svelte:418-438`.
- **Duel 6 current behaviour.** A drop auto-picks per zone: spell/trap `activate` → `setSpellTrap`; monster `summon` → `specialSummon` → `setMonster`; extra monster zone `specialSummon` only — `src/battle/app/prompts/drop-target.ts`.
- **Rewind harness exists.** `tests/integration/programmed-duel.test.ts` replays a persisted response log against a fixed seed with no policy fallback; the worker trace keeps `seed`, `presetId`, `snapshotId` and every prompt/response pair (`src/battle/worker/diagnostics/duel-trace.ts`, schema v2).
- **VN card data is offline-complete.** `activeCatalog()` yields `DeckBuilderCardView` with name, description, attribute, race, level/rank/link, ATK, DEF and `imageUrl` (ADR-039); the story already consumes it (`StoryApp.svelte:61,242`).
- **Rarity halo tokens exist**: `--rarity-halo-*` in `src/story/styles.css:8-13` via `.rarity-halo[data-rarity]`.
- **Story art crops differently from the deck editor**: story tiles use `object-fit: cover`; the editor was fixed to show the whole art (commit `775b1a7`).
- **Collection exists** as `StoryState.collection: Record<code, count>`, credited in the `open-boosters` reducer case (`story-reducer.ts:263-266`); `buy-boosters` only debits DP and increments `boosters` (`:234-241`).
- **Packs are already unsellable**: `ShopSellScreen` iterates owned _cards_ only, priced by `SELL_PRICE_DP[rarity]` — no pack rows. Round-1 Q8 precision is already satisfied.

## Facts (scout, round 2 preparation)

- **Branch state.** `git log main..duel` and `main..vn` are **empty** — both are fully merged into `main`. `git log main..deck` holds **9 commits** (`161d1e8` … `62c0bf9`, deck-editor round 2: catalog left-click moves, single-row extra/side zones, whole-art tiles, favourites, autosave position log, e2e realign). The deckbuilder worktree is additionally **dirty**: modified `src/deck-editor/components/{CardCatalog,DeckEditor,DeckWorkspace}.svelte`, `src/styles/app.css`, `tests/unit/global-styles.test.ts`.
- **Worktrees**: `deckbuilder` (dirty), `duel` (clean), `vn` (modified `feedback-vn.md` only) under `/home/aron/.herdr/worktrees/ascencio/`.
- **Upstream for set images is already the project's upstream.** `https://db.ygoprodeck.com/api/v7/cardsets.php` returns `set_name`, `set_code`, `tcg_date` and, for most sets, `set_image` (`https://images.ygoprodeck.com/images/sets/{CODE}.jpg`, verified `HTTP/2 200`, ~72 KB for `LOB`). Some sets carry **no** `set_image` key (for example `STAX`). Card images already come from the same host (`scripts/lib/shop-set-image-codes.ts:28`, `scripts/sync-assets.ts:137-140`), and the 50 shop sets are generated by `scripts/generate-shop-sets.ts` from `cardinfo.php`.

## Assumptions (logged, not asked)

- **Duel 1** (preview text): drop the justified alignment, keep the effect text left-aligned, same `0.35rem` gap as name→stats, immediately under the stats row (`src/styles/app.css:387-435`).
- **Duel 3**: action buttons render one per row directly above the zoomed card, each at the full width of the zoomed card, font scaled to the 1.6× frame.
- **Duel 7**: `field-end-turn-button` gets `white-space: nowrap` plus a larger min-height/padding — one row, bigger, no other rail change.
- **VN shop 2**: HD (≥1280 px) shows exactly 4 set tiles per row with vertical scrolling; "Latest release" shows the 4 most recently released sets in chronological order.
- **VN card list 1**: rarity sort button is tri-state — off → common-to-rarest → rarest-to-common → off — grouping by rarity, alphabetical inside each group.
- **VN reveal 2**: 9 cards on one full-width row on desktop, one scrollable column on mobile, centred both axes.
- **VN reveal 3**: hover scales the card 2× with the orange selection halo fading in; reveal screen only.
- **VN reveal 4**: with a single pack the reveal screen shows only a Back button — no "See results", no "Skip".
- **Trunk migration**: ADR-022's _import boundaries_ survive (they are machine-enforced and unrelated to branching); only its worktree/branch topology is retired, by a new ADR.

## Round 2 — Trunk migration, per-save collections and decks, set-image pipeline

Round doc: [`round-2.html`](round-2.html)

| #   | Question                                                        | Answer                                                                                                              | Precision                                                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How the unmerged `deck` work lands before worktrees are removed | Ticket 1: land deck, verify gates, remove worktrees, delete local branches, keep remotes                            | This is planning only. **Assume** the deck work is already implemented and merged into `main`, and the worktrees are already gone.                                                                                                                                                                                                                                |
| 2   | Does a story save own its decks as well as its collection       | Save-scoped decks; the global database becomes the free-play library; migration assigns existing decks to free play | Free play is a section where every card is available and its saved decks are free-play-specific; otherwise decks are specific to each save.                                                                                                                                                                                                                       |
| 3   | What the deck editor shows when entered from a story save       | (custom)                                                                                                            | Same menu from free play and from the story; both have a Collection button on the deck menu opening the new collection screen. From the story it shows only cards owned in that playthrough and **decks are built from owned cards only**. The collection screen has a "show every existing card" checkbox, default off. Free play owns max copies of every card. |
| 4   | What "free play" means concretely                               | Explicit mode chosen on the home screen                                                                             | Replace `Duel` in the menu with **Free Play**, which opens a submenu: start a match, or deck builder (all cards, max copies). Starting a game returns to the duel menu with free-play decks. A Return button goes back to the game's main menu. **The visual novel menu becomes the new main menu**; add Free Play as its last option.                            |
| 5   | Set images: fallback when upstream has none                     | Plain typographic tile: set code and year on a flat panel                                                           | —                                                                                                                                                                                                                                                                                                                                                                 |
| 6   | Set images: storage and verification discipline                 | `generated/` + sha256 manifest verified at build, plain static runtime URLs (ADR-039 style)                         | —                                                                                                                                                                                                                                                                                                                                                                 |
| 7   | Zoom-with-text component: which screens use it                  | (custom)                                                                                                            | Every screen that has no fixed preview panel. Today that is only the reveal screens.                                                                                                                                                                                                                                                                              |
| 8   | Drop confirm menu: where it appears                             | Centred modal dialog                                                                                                | —                                                                                                                                                                                                                                                                                                                                                                 |
| 9   | Duel rewind: edge cases and which errors offer it               | Restore offered only when the trace holds ≥1 human response; offered for any fatal duel error                       | —                                                                                                                                                                                                                                                                                                                                                                 |

## Facts (scout, round 3 preparation)

- **Save slots** are `manual:1|2|3`, `autosave`, `checkpoint:pre-duel`; each slot stores one serialized `StoryState` envelope — source: `src/story/saves/story-save-contracts.ts:25-99`.
- **The collection is already per-save by construction**: it is a field of `StoryState`, so it is snapshotted and rolled back with the save (ADR-033). Decks are not — they live in `ygo-story-decks` (IDB v2) with history, favourites and a default-deck pointer (`src/decks/deck-database.ts:10-24`).
- **Domains load lazily**: `src/shell/domain-loaders.ts:51-53` dynamically imports `battle`, `deck-editor` and `story`; `DOMAIN_BUDGET_BYTES` (`scripts/lib/domain-chunk-closure.ts:31`) enforces a byte budget per domain chunk through `build:verify` and `tests/unit/domain-chunk-closure.test.ts`. Making the story the app root moves it into the first paint.
- **Routes today**: `home`, `duel`, `duel-session/:handoffId`, `decks`, `decks/:deckId`, `story`, `admin`, all hash-based — `src/shell/routes.ts`.
- **Menus today**: the shell home lists Story, Decks, Duel, Settings (`src/shell/screens/HomeScreen.svelte`); the story title lists New Game, Continue, Load, Settings, Main menu (`src/story/screens/TitleScreen.svelte`).
- **Story duels use bundled presets**: the story hands the shell an `encounterId` + label, never a deck (`src/story/handoff/story-handoff.ts`); the duel resolves decks itself and pins a fixed Shaddoll opponent (commit `95eec33`).

## Round 3 — Save-owned decks, ownership gate, app shell

Round doc: [`round-3.html`](round-3.html)

| #   | Question                                                  | Answer                                                                                                           | Precision                          |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | Where a story save's decks physically live                | Inside `StoryState`, like the wallet and collection: saving snapshots them, loading rolls them back              | —                                  |
| 2   | What a brand-new story save starts with                   | A starter deck **and** its cards credited to the collection, so the deck is legal and editable                   | Start collection and starter deck. |
| 3   | Which deck a story duel uses                              | The save's default deck, changeable at pre-battle from a picker limited to that save's decks                     | —                                  |
| 4   | How the story catalog treats unowned cards                | Catalog shows owned cards only; the show-all checkbox belongs to the collection screen alone                     | —                                  |
| 5   | How free play's "everything at max copies" is represented | A mode flag — ownership answers "unlimited"; the collection screen shows the whole database with no owned counts | —                                  |
| 6   | Main menu as story title: routes and lazy loading         | Extract the menu into the shell (story-styled), keep the story lazy; `#/duel` → `#/free-play`, `#/` = main menu  | —                                  |
| 7   | What sits behind "Start a match" in free play             | Today's duel entry with free-play decks **plus** an opponent picker                                              | —                                  |
| 8   | One plan or two sequential plans                          | One plan, every ticket in dependency order                                                                       | —                                  |

## Facts (scout, round 4 preparation)

- **A starter deck already exists and is already seeded**: `ensureStarterDeck` imports `src/battle/duel/presets/decks/player.ydk?raw`, is idempotent, and short-circuits when a default deck exists — `src/decks/starter-deck.ts`.
- **The story already has a decks entry point**: `StoryTopBar` renders a decks button (`ondecks`), which `StoryApp.svelte:639-653` does not currently wire, so it falls through to its default hash navigation.
- **A new save starts with 1000 DP** (`createInitialStoryState`, `src/story/model/story-state.ts`); a pack costs 150 DP (commit `996a308`).

## Round 4 — Ownership integrity, route table, free-play opponents

Round doc: [`round-4.html`](round-4.html)

| #   | Question                                           | Answer                                                                                                                                                                | Precision                                                                         |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Selling a card one of that save's decks uses       | Selling is unrestricted; affected decks are marked illegal and must be fixed before an encounter                                                                      | Show a dialog naming the deck(s) that become illegal **before** the sale commits. |
| 2   | An illegal deck at encounter start                 | Pre-battle blocks the start with a named reason and a direct link to the deck editor                                                                                  | Illegal decks appear disabled, red border, illegal warning.                       |
| 3   | The full route table after the menu move           | Context in the path: `#/free-play/decks(/:id)`, `#/story/decks(/:id)`, `#/story/collection`, `#/free-play/collection`; settings is a dialog anywhere; `#/admin` stays | —                                                                                 |
| 4   | What the free-play opponent picker can choose from | Bundled preset decks **plus** your own free-play decks; last pairing remembered                                                                                       | —                                                                                 |
| 5   | Starting grant for a new story save                | Existing `player.ydk` starter deck, its cards credited, 1000 DP unchanged                                                                                             | —                                                                                 |

## Shared understanding

### Goal

Land `feedback-duel.md` (10 items) and `feedback-vn.md` (shop, card list, card reveal, general, plus the collection feature) as **one plan of dependency-ordered, commit-sized tickets executed on `main`**. The round grew past cosmetics: it fixes a duel-killing engine-response bug and its whole bug class, adds replay-based duel recovery, moves deck ownership into the story save, introduces an ownership-gated story economy, and restructures the app's entry navigation around a story-styled main menu with an explicit Free Play mode.

### Settled — process and repository

- **One plan**, every ticket in dependency order, executed on `main`. No worktrees, no domain branches.
- The plan **assumes** the deck-editor round-2 work is already merged into `main` and the three worktrees are already removed.
- `AGENTS.md` is rewritten for single-branch trunk development; a new ADR retires ADR-022's branch/worktree topology. ADR-022's **import boundaries survive unchanged** and stay machine-enforced by `eslint.config.js` and `tests/unit/domain-boundaries.test.ts`.

### Settled — duel (feedback-duel.md 1–10)

1. Card-preview effect text: no justified alignment, left-aligned, same `0.35rem` gap as name→stats, placed directly under the stats row.
2. Hand-zoom art: the overlay leases from `imageLibrary` like `CardControl` does; the dead `imageUrls` prop on `DuelField` goes away. No more "Image unavailable" on hover.
3. Action buttons render one per row directly above the zoomed card, each the full width of the zoomed card, text scaled to the 1.6× frame.
4. Clicking a hand card **always** pins the zoom and its button list — even with one legal action — with the orange selected halo. Clicking outside, or the card again, cancels and unzooms. An action fires only from its button; drag-and-drop stays the other way to commit.
5. The local player's hand keeps a stable arrival order with new arrivals appended rightmost; `MSG_SHUFFLE_HAND` no longer reorders the local display. Engine order still governs every response.
6. A drop whose zone offers **two or more** legal actions opens a **centred modal** listing them plus Cancel; single-action drops stay instant.
7. `field-end-turn-button`: one row (`white-space: nowrap`), bigger.
8. `ANNOUNCE_NUMBER` answers with the option **index**, not its value, **plus** an audit of every response encoder against the vendored types — one unit test per prompt kind.
9. A fatal duel error opens a dialog with **Download diagnostics** and **Restore**. Restore replays the trace deterministically from the seed to the last decision the player had agency over and re-issues that prompt. It is offered whenever the trace holds at least one human response, for any fatal duel error; otherwise the dialog offers download plus restart.
10. Both hands centre with `justify-content: safe center`; the `:first-child`/`:last-child` auto-margin hack that breaks the `row-reverse` opponent band is removed.

### Settled — story: shop, reveal, collection

- **Set images**: a new `scripts/` step reads `db.ygoprodeck.com/api/v7/cardsets.php`, downloads each `set_image` into `generated/`, records a sha256 manifest verified at build time, and serves plain static runtime URLs (ADR-039 discipline). Sets with no upstream image render a typographic tile (set code + year).
- **Set grid**: 4 tiles per row at HD with vertical scrolling; "Latest Released" shows the 4 most recent sets in chronological order.
- **Card art** in the shop matches the deck editor exactly — whole art, not the cropped `object-fit: cover` tiles.
- **Set card list**: tri-state rarity sort (off → common-to-rarest → rarest-to-common → off), alphabetical inside each rarity group; keeps the shared duel/deck preview panel.
- **Card reveal**: cards start face down; hovering fades in the rarity halo; clicking flips one; an auto-flip checkbox reveals left to right about every 450 ms, is remembered in the story save and defaults to off; reduced motion cuts the animation, not the pacing. Boosters open one at a time with an "open all" option; open-all shows the set-card-list layout with per-card quantities instead of duplicates and the same rarity grouping; after opening one by one, a "see all" button reaches the same screen. Nine cards sit on one full-width row on desktop, one scrollable column on mobile, centred both axes. Hover zooms a card 2× with the orange halo and opens a **new zoom-with-text component** (not the preview panel) beside it. Opening a single pack shows only a Back button — no "See results", no "Skip".
- **Economy**: clicking open credits every card to the collection immediately; the reveal is presentation only. Packs remain unsellable (already true).
- **General**: one story-local `ChoiceList` component, centred, large buttons, used by narrative choices and the shopkeeper menu; cancel/leave actions use a red story danger class.

### Settled — saves, decks and ownership

- **Decks move inside `StoryState`**, beside the wallet and collection: saving snapshots them, loading rolls them back together (ADR-033 consistency). The existing `ygo-story-decks` database becomes the **free-play** library, and existing decks migrate there.
- **A new story save** grants the existing `player.ydk` starter deck, credits its cards to the collection, and starts with 1000 DP.
- **Story duels** play the save's default deck, swappable at pre-battle from a picker limited to that save's decks. Illegal decks appear disabled with a red border and an illegal warning; pre-battle blocks the start with a named reason and a direct link to the editor.
- **Story catalog** offers owned cards only. The collection screen carries the "show every existing card" checkbox, default off; the catalog does not.
- **Selling** stays unrestricted, but a sale that would make a deck illegal shows a dialog naming those decks before it commits.
- **Free play** answers ownership as unlimited through a mode flag — nothing materialised in storage. Its collection screen shows the whole database without owned counts.

### Settled — shell and navigation

- The **main menu moves into the shell** as its own story-styled screen at `#/`: New Game, Continue, Load, Settings, and **Free Play last**. The old shell home screen is removed and the story domain stays lazily loaded.
- **Free Play** opens a submenu: Start a match, Deck builder, Return to main menu.
- The free-play duel keeps today's entry and gains an **opponent picker** offering bundled preset decks and your own free-play decks; the last pairing is remembered.
- **Routes**: `#/` main menu · `#/story` · `#/story/decks` · `#/story/decks/:id` · `#/story/collection` · `#/free-play` · `#/free-play/decks` · `#/free-play/decks/:id` · `#/free-play/collection` · `#/duel/session/:handoffId` · `#/admin`. Settings is a dialog reachable from any menu.

### Assumptions (logged, not asked)

- Duel 1, 3, 7 render exactly as described above; no other rail or preview change rides along.
- VN shop grid, tri-state sort semantics, reveal layout and single-pack Back button as described above.
- "Maximum copies" in free play means the pinned ruleset's per-card deck limit still applies during validation — the unlimited flag governs _ownership_, never deck legality.
- The deck editor shows a context banner naming the story save or Free Play.
- The collection screen reuses the shop's rarity-grouping control.
- The sell confirmation dialog lists affected decks by name.
- `#/duel` and `#/decks` redirect to `#/free-play` and `#/free-play/decks` so old bookmarks and the PWA start URL keep working.
- Per-domain chunk budgets are re-measured and re-baselined where the restructure moves code; `build:verify` stays green.

### Out of scope

- Multiplayer, networked duels, deck sharing beyond the existing YDK import/export.
- Banlist editing, alternate rulesets, or a card-database interface richer than the collection screen's rarity grouping and show-all checkbox (the "true database" direction is explicitly later).
- Opponent AI improvements beyond handing it a chosen deck.
- Story content beyond the existing prologue; new encounters, new maps, new characters.
- Canvas field decoration, ADR-024 portrait work, engine vendor upgrades.
- An ownership gate in free play.
