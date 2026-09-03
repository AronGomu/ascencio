# Grill: Screen feedback (feedback.md, 2026-09-02)

## Round 1 — All four screens

| # | Question | Answer | Precision |
| --- | --- | --- | --- |
| 1 | Deck select hover preview placement | Reuse existing float, swap to full card scan (`/runtime/images/`) at readable size (~2.4x row height) | — |
| 2 | Tile growth when few decks | Pure CSS auto-fit, raised minmax minimum, cap tile width ~420px | — |
| 3 | Star in top-right corner | — | Star = clickable **set-as-default** button, top-right of deck tile |
| 4 | Return-to-X history mechanism | Session-scoped previous-route memory in shell-store (deck editor); story reducer records previous screen (map). Label from route/screen → name map. Fallbacks: editor → Deck Selection, map → dialog | — |
| 5 | Import semantics | Replaces open deck's card lists as one undoable mutation; name untouched; reuses existing YdkImport dialog | — |
| 6 | Sort By select | Mutates deck order on change (undoable). Toggle re-applies current mode reversed. Tie-break chain ends A–Z. Placeholder "Sort By" until used | Deck mutation, must be undoable |
| 7 | Preview lock vs hover | Soft pin: hover temporarily overrides, preview returns to pinned card when pointer leaves | — |
| 8 | Zone-error mapping + tooltip | Main: size <40/>60 + main-card copy violations. Extra: size >15 + extra violations. Side same treatment. Custom styled tooltip on (!) hover/focus listing that zone's errors | — |
| 9 | Map header / StoryTopBar | Restructure StoryTopBar into full-width header bar on **every** story screen | Identical header bar for every VN screen (dialogs, map, shop). Elements like title/objective can be hidden per screen |
| 10 | Map hotspot hover info | Anchored popover on hover AND focus AND first tap; second tap/click enters location | — |
| 11 | Story resize strategy | Story screens fill 100% of container (shell stage), not 100svh; container-relative units | — |
| 12 | Bundled deck blocked-open | Kebab item disabled (visible, greyed, with reason); double-click shows shell toast "Bundled deck: cannot be modified" | — |

## Facts (scout)

- Decklist hover float already exists — `src/deck-select/DeckSelectScreen.svelte` (`artFor`, `FLOAT_GAP=12`, place at row anchor); rows report hover via `DecklistPanel.svelte` `onrowhover(code, anchor)`.
- Cropped→full image URL mapping exists: `/runtime/images-cropped/` → `/runtime/images/` — `src/deck-select/DeckTile.svelte` fallback.
- Deck tile today: default star top-left (non-button), favourite toggle ☆/★ button right side, checkmark top-right, counts line `Main X · Extra Y · Side Z`, `tile.meta` line, badges row — `src/deck-select/DeckTile.svelte`.
- "← Return to {backLabel}" label convention exists — `DeckSelectScreen.svelte:194`.
- Shell has hash routes, no previous-route memory — `src/shell/shell-store.ts`, `src/shell/routes.ts`.
- Story is an internal screen state machine (`go("narrative")` etc.) — `src/story/StoryApp.svelte`; map back hardcodes `go("narrative")`.
- YDK import dialog exists (paste + .ydk file, preview, unknown codes) — `src/deck-editor/components/YdkImport.svelte`; wired only from Deck Library (`onimport`).
- Sort buttons mutate deck: `onmutate({ type: "sort", mode: "alpha" | "type" })` — `src/deck-editor/components/DeckEditor.svelte:534-542`.
- Card copy limit badge: `.limit-badge` always renders limit 0–3 — `src/deck-editor/components/CardTile.svelte:103-105`.
- Side deck collapse state exists: `collapsedZones = { main:false, extra:false, side:false }` — `src/deck-editor/components/DeckWorkspace.svelte:52`.
- Validation strip: `ValidationIssues.svelte` rendered inside `DeckWorkspace.svelte:192`.
- Ownership/greying + reasons exist — `src/deck-editor/catalog-availability.ts` (`availableCopies`, `unavailableReason`, `ownedCatalog`).
- Unknown-card placeholder exists: `Missing card ${code}` — `CardTile.svelte:47`.
- StoryTopBar is a fixed top-left overlay (DP, shop, decks) — `src/story/components/StoryTopBar.svelte`; decks default `#/story/decks`.
- Narrative stage `min-height:100svh`, absolute children in vh/vw — `src/story/screens/NarrativeScreen.svelte:231-233`; shell letterboxed stage model — `src/shell/stage-layout.ts`.
- Map screen: header (eyebrow "Chapter 1 · River district", h1, objective, choice-acknowledgment), sidebar location list + detail panel, hotspots — `src/story/screens/IllustratedMapScreen.svelte`.
- Deck select count label `${shown.length}/${tiles.length}` sits in titlebar next to title, filter elsewhere in bar — `DeckSelectScreen.svelte:193,789`.
- Deck catalog result count: `{results.length} results` in catalog header — `src/deck-editor/components/CardCatalog.svelte:180`.
- Shell toast system exists — `TOAST_CONTEXT_KEY` in `src/shell/index.ts`.

## Round 2 — Deck tile star

| # | Question | Answer | Precision |
| --- | --- | --- | --- |
| 1 | Favourite toggle fate | **Drop favourite feature entirely** (flag, toggle, ordering by favourite) | Default star replaces favourite stars |
| 2 | Set-default star states | Non-default: outline star, click sets default. Current default: filled gold star, disabled, label "Default deck" | Setting default must remove the star from the previous default deck |

## Shared understanding

- Spec level: 5 — target reached
- Goal: implement every item of owner feedback.md (2026-09-02) across Deck Selection, Deck Builder, Visual Novel and Map screens.

### Settled — Deck Selection
- DS1: decklist-row hover float swaps cropped art for full card scan (`/runtime/images-cropped/` → `/runtime/images/`), sized ~2.4× row height so card text is legible. Same anchor/gap logic.
- DS2: move `deck-select-count` (`shown/total`) from titlebar to immediately right of the filter input.
- DS3: grid `auto-fit` with raised minmax minimum; tile width capped ~420px; no JS tiers.
- DS4: tile body = name + one tag line aligned with kebab. Remove: checkmark, date, Main/Extra/Side counts. Top-right = set-default star **button**: outline = click to set default (clears previous default's star), filled gold + disabled (`aria-label` "Default deck") = current default. Favourite feature deleted end-to-end: flag, toggle, favourite-first ordering, story pre-battle favourite plumbing.
- DS5: bundled deck — kebab "Open in deck builder" disabled (visible, greyed, reason); double-click → shell toast `Bundled deck: cannot be modified`.
- DS6: `+ Create` → `Create` (both instances, incl. compact probe).

### Settled — Deck Builder
- DB1: `.limit-badge` hidden when limit is 3; still rendered for 0/1/2.
- DB2: margin between `deck-catalog-filters` and `deck-catalog-results-region`.
- DB3: remove header "Deck Library" button; add red "Return to X" bottom-left under `card-preview-panel`, same width, outside that section. X = previous screen from session-scoped previous-route memory added to shell-store (label map per route kind); fallback "Deck Selection".
- DB4: header "Import" button opens existing `YdkImport` dialog; on commit replaces open deck's card lists as **one undoable mutation**, deck name untouched. Unowned-in-collection cards render greyed/disabled but stay in the list; unknown codes keep `Missing card {code}` placeholder. YDK format only (paste + .ydk file), as the dialog already does. Load button untouched.
- DB5: replace both sort buttons with one `<select>` placeholder "Sort By" + asc/desc toggle. Modes: A–Z · CardType>A–Z · Level>CardType>A–Z · Attribute>CardType>A–Z · MonsterType>CardType>A–Z · ATK>CardType>A–Z · DEF>CardType>A–Z. Applies on change as an undoable deck mutation; toggle re-applies current mode reversed (primary key only; tie-break chain stays ascending, ends A–Z).
- DB6: double-click adds (catalog) / removes (deck zones); single click selects + soft-pins preview (hover peeks, returns to pinned on pointer leave).
- DB7: removing from main deck deletes the card (no auto-move to side).
- DB8: `collapsedZones.side` starts `true`.
- DB9: `ValidationIssues` strip removed. Errors attributed per zone: main size <40/>60 + main-card copy violations → main border red; extra >15 + extra violations → extra; side same treatment. "(!)" icon in the zone header, custom styled tooltip on hover/focus listing that zone's errors.

### Settled — Visual Novel + Map
- VN1: story screens size to their container (shell stage), not 100svh; container-relative units so background, characters and dialogue scale together.
- M1: map back button → red "Return to X" bottom-left; story reducer records previous screen; if last was narrative → return there; fallback dialog/narrative.
- M2/M7: sidebar location cards + detail panel removed; anchored popover beside hotspot on hover AND focus AND first tap (second tap/click enters). Popover carries name, marker type, summary, locked reason, completed state.
- M3/M9: `StoryTopBar` restructured into one full-width header bar identical across all story screens (dialogs, map, shop): DP · shop · deck builder · Title · Objective · settings; per-screen slots may hide (e.g. title/objective outside map).
- M4: fix deck-builder button landing on main menu (route `#/story/decks` mishandled downstream).
- M5: remove eyebrow "Chapter X…" and `choice-acknowledgment`.
- M6: map art fills the freed space.

### Contracts (binding shapes)
- Shell history: `ShellState` gains `readonly previousRoute: AppRoute | null` (session-only, set on every `navigate`/`syncFromHash` route change, never persisted).
- Route label map: `routeLabel(route: AppRoute): string` — e.g. free-play-decks → "Deck Selection", story → "Story", home → "Main Menu".
- Story reducer: state gains `previousScreen: StoryScreen | null`; map back uses it, fallback `"narrative"`.
- Sort: `onmutate({ type: "sort", mode: SortMode, direction: "asc" | "desc" })` where `SortMode = "alpha" | "type" | "level" | "attribute" | "race" | "atk" | "def"` (existing `"alpha"`/`"type"` semantics preserved).
- Import mutation: one deck-command producing full `DeckCardLists` replacement, single history entry.
- Toast copy: `Bundled deck: cannot be modified`.

### Assumptions
- "Tags" line on deck tile = existing `tile.meta` minus date/counts; exact tag source confirmed at ticket-writing time from `DeckTileModel` mapping.
- Non-YDK decklist formats out of scope (YDK covers the ask; dialog already built).
- Seat-card/pre-battle contexts keep `showFavourite=false` paths removed cleanly with the feature.

### Out of scope
- feedback.md `# Duel Field / ## Right Pane` — empty section, no ask.
- Multiplayer, story systems beyond the screens above, engine/vendor changes.

