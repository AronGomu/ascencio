# Grill: Duel field feedback round 3

Goal source: `feedback.md` (30 items).
Round docs: `round-{n}.html` in this directory.

## Facts (scout)

- Round 2 shipped but unmerged — `feat/duel-field-round-2` @ `736b374`, 17 ahead of `main`, 0 behind. `main` @ `b5702e2` carries round 2 *docs only*. Source: `git log --oneline main..feat/duel-field-round-2`.
- Round 3 feedback describes the branch build, not `main`. `main` has no `PhaseStrip.svelte`, no `ZoneListDialog.svelte`, no `DuelHeaderBar.svelte`. Source: `git diff --stat main..feat/duel-field-round-2`.
- **Item 1 root cause:** `.duel-field-card { pointer-events: none; }` with `pointer-events: auto` only under `.duel-field-card.is-actionable`. `onpointerenter` therefore never fires on a non-actionable card. Stacks carry no such rule → graveyard hover works. Source: `src/styles/app.css:1160-1233` on `feat/duel-field-round-2`.
- Preview plumbing itself is correct: `previewFieldCard` → `cardPreviewForCode(card.code, ACTIVE_CARD_TEXTS)`, and `board-view-model.addCard` does set `code` for identity-visible opponent monsters. Source: `src/app/App.svelte:600`, `src/field/board-view-model.ts`.
- **Item 10:** attack targeting is a `selectCard` prompt → `cardSelection` spec → `FieldActionBar` demands a Confirm click. Source: `src/app/prompts/interaction-spec.ts` `INTERACTION_SPEC_KINDS`.
- **Item 11:** the battle-command prompt is `battleCommand` → `cardAction`; its `mainPhase2` / `endPhase` choices are already mapped to phase-strip chips by `phaseSlotChoices`. Source: `src/worker/protocol/PromptRegistry.ts:265-277`, `src/app/prompts/phase-transitions.ts`.
- **Item 12 is offline-buildable.** Local snapshot: 14,794 cards, 13,399 official scripts, 14,579 archived images. Probed codes all present with images: Dante 83531441, Scarm 84764038, Graff 20758643, Cir 57143342, Tour Guide 10802915, Nekroz of Brionac 26674724, Nekroz of Unicore 89463537, Nekroz Cycle 97211663, Manju 95492061, Shaddoll Dragon 77723643, Shaddoll Fusion 44394295, El Shaddoll Winda 94977269, Spellbook of Secrets 89739383, Spellbook Magician of Prophecy 14824019, High Priestess of Prophecy 86585274, Spellbook of Judgment 46448938, Beatrice 27552504. Source: `generated/mvp-assets-status.json`, `generated/assets/current/catalog/texts/en/*.json`, `generated/card-images/archive/full/`.
- **Item 12 blocker:** `MVP_SUPPORTED_CARD_CODES` in `src/duel/presets/deck-parser.ts` hard-lists 22 codes and `validateDeck` throws outside them.
- **Item 12 build coupling:** `scripts/lib/active-image-manifest.ts` enumerates exactly two `.ydk` files (`player.ydk`, `opponent.ydk`) to decide which images are bundled; new decks must be added there or their art will not ship.
- **Item 23 is computable:** `generated/assets/current/catalog/cards/*.json` carries `type` bits and `linkMarker`. `__ACTIVE_CARD_TEXTS__` carries only `code`/`name`/`description`; chosen Worker-side detection instead uses preloaded card metadata, avoiding a duplicate browser manifest field.
- **Item 19 needs no dependency:** the dragged card is one absolutely-positioned element; the effect is a `transform` recomputed inside a `requestAnimationFrame` loop that only runs while a pointer is down.
- Round 2 assumption A2 in force: UI settings live in memory for the session, no `localStorage`, no IndexedDB.
- Playwright needs `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers` and the pinned nix `-p` list; chromium only, foreground, `webkit-smoke` unrunnable on this host. Source: `ai-artifacts/HANDOFF_2026_08_10_duel_field_feedback_round_2.md`.

## Round 1 — Scope, layout budget, interaction, deck epic

| #   | Question | Answer | Precision |
| --- | -------- | ------ | --------- |
| 1   | What does round 3 branch off? | Merge `feat/duel-field-round-2` into `main` first, then branch round 3 off `main`. | |
| 2   | Is item 12 (4 archetype decks + deck picker) part of this plan? | Same plan, **first tickets**, so later UI work is exercised against real archetype decks. | |
| 3   | Who authors the four decklists? | **User supplies the four `.ydk` files.** | Blocking input → `TODO(user)` until delivered. |
| 4   | What happens to `MVP_SUPPORTED_CARD_CODES`? | Replace the hand-listed pool with the union of every bundled deck's codes, computed at build time. | |
| 5   | Item 9 — what gives when 100 % viewport height does not fit? | Keep the 44 px target floor. The preview panel collapses to a thin strip; the board keeps its size. | |
| 6   | Items 20/21 — final preview placement | Preview stays **left**, widened into the empty space (item 20). | Full-width bottom **only** when the viewport width cannot hold both minimum widths. Responsive fallback only. |
| 7   | Items 6/7/13/15 — final hand band spec | No hand rectangle; band spans ST1→ST5; >10 cards paginate with left/right arrows + horizontal scrollbar; never fan tighter than one card width. | |
| 8   | Does the opponent hand get the same treatment? | Yes, mirror it exactly. | |
| 9   | Item 23 — what decides Extra Monster Zone removal? | Decided at duel start from **both** chosen decklists; layout fixed for the whole duel. | |
| 10  | Item 25 — full halo palette | Green = valid/legal target. Orange = selected / awaiting confirmation. Drop candidate = green, filled tint. Keyboard focus = neutral outline. Feedback animation = teal. List-entry hover = orange. | |
| 11  | Items 18/19 — drag physics tier | **Tier 2** — cursor-following ghost, velocity-proportional tilt, spring settle on drop, lift shadow + scale. Hand-rolled rAF, no dependency. | |
| 12  | Item 30 — floating window position persistence | Persist to `localStorage` so it survives reloads. | |
| 13  | Items 28/29 — does the list dialog replace on-field targeting? | List dialog for off-field targets only (GY, deck, banished, extra, hand); on-field targets keep in-place highlighting; a mixed prompt shows both. | **The zone list dialog also becomes floatable and draggable across the duel field, same as the confirm window.** |
| 14  | Item 1 — how far does face-down identity tracking go? | Track it properly in the worker: a card whose identity became public before going face-down keeps its code for the local viewer; cleared when it leaves the zone or is shuffled away. | |
| 15  | Item 8 — what text next to the life points? | Static role: `You` / `Opponent`. | **No deck name.** Player name only. |

## Assumptions (unasked, logged)

- **A-G1** Item 3 (opponent stack cards inverted) = rotate the opponent's stack/list card art 180°, matching `.duel-field-card.is-opponent`. No new state.
- **A-G2** Item 4's "close button becomes a red X justified right" applies to `ZoneListDialog` only; `MenuDialog`, `SettingsDialog`, `PromptDialog` and `DuelResultDialog` keep their current buttons unless you say otherwise.
- **A-G3** Item 5 (action menu at the forefront) = raise `.card-action-chips` above every field layer via the existing `--duel-field-layer-*` scale; no portal/teleport.
- **A-G4** Item 14 (extra deck zone under the field zone) and item 16 (more vertical, less horizontal zone margin) are pure `duel-field-layout.ts` coordinate changes.
- **A-G5** Item 22 (phase badge left of the shared Extra Monster Zone) and item 24 (End turn button replaces the End badge) are `PhaseStrip.svelte` + CSS only.
- **A-G6** Item 27's "50 % of the available viewport" caps the *dialog list's* preview image height at `50svh`.
- **A-G7** Every ticket that moves or deletes a `data-cy` asserted in `e2e/duel-smoke.spec.ts` updates that spec in the same commit. Carried from round 2's process lesson.

## Round 2 — Deck flow, windows & persistence, reveal rules, acceptance

| #   | Question | Answer | Precision |
| --- | -------- | ------ | --------- |
| 1   | How and when do the four `.ydk` files arrive? | I seed placeholder lists from the local catalog now; user overwrites the four files at any time, no code change. | Nothing blocks. |
| 2   | Deck picker shape + which decks listed | Pre-duel screen replaces auto-start: two deck lists side by side + Start. Result dialog's rematch replays the same pair; a separate "Change decks" button returns to the picker. | |
| 3   | Collapsed preview strip + narrow fallback definition | Short viewport: small art thumbnail + name, effect text scrolls in the remaining height. Narrow viewport: full-width bottom band. | |
| 4   | Draggable windows vs outside-click close; shared position? | Outside click always closes the zone list (item 4 wins) regardless of dragging. The confirm window never closes on outside click. Each window stores its own position under its own key. | |
| 5   | `localStorage` schema + what else persists | One versioned key, window positions **and** the selected deck pair, so a reload returns to the same matchup. | |
| 6   | Face-down public-knowledge reveal rule table | Implement exactly the proposed table. | |
| 7   | Opponent policy facing archetype decks | Accept misplays as out of scope. Add a loop breaker: identical prompt signature repeating with no state-revision change forces a different legal choice, then pass / end phase. | |
| 8   | Item 17 hover zoom magnitude + surfaces | 1.35x, 120 ms ease-out, on hand cards + field cards + zone-list entries. Hand grows upward, field cards from centre, halo scales with the card, disabled under `prefers-reduced-motion`. | |
| 9   | Item 29 vs item 10 — single-candidate confirm rule | One rule: min=max=1 submits on click, no confirmation. Multi-select keeps the counter + Confirm inside the floating window. | |
| 10  | Acceptance bar proving a deck works | **Manual only** — user plays one duel per deck and reports. | No deck-specific automated tests. Decks exist for manual testing. |

## Facts (scout) — round 2 additions

- `src/app/stores/duel-store.ts:306` calls `client.startDuel(MVP_PRESET_ID)` against one hardcoded preset; App auto-starts as soon as `$duel.status === "idle"` and `coreVersion !== null`.
- `src/worker/create-browser-runtime.ts:4-5` imports `decks/opponent.ydk?raw` and `decks/player.ydk?raw`. Deck files are pure data behind a Vite `?raw` import — replacing their contents needs no code change.
- `grep -rn localStorage src/` → no matches. Item 30 introduces browser persistence to this codebase for the first time.
- `src/worker/opponent/OpponentPolicy.ts` is a first-legal/strongest-attack heuristic with reasons `summon_first_legal`, `activate_first_legal`, `attack_strongest`, `advance_phase`, `select_first_legal`, `select_valid_sum`, `preserve_order`. No loop detection.
- Existing responsive breakpoint for the preview column is `@media (max-width: 79rem)` in `src/styles/app.css`, derived from `mainWidth − 22rem panel − 1rem gap − 2rem field padding ≥ 52rem board min-width` (≈1264 px floor). The narrow fallback item 6 asks for already exists in skeleton form.

## Shared understanding

### Goal

Ship all 30 items of `feedback.md` as duel-field feedback round 3, on a branch cut from `main`
*after* `feat/duel-field-round-2` is merged into it. Four archetype decks and a pre-duel deck
picker land **first**, so every later UI ticket is validated against a real Burning Abyss /
Nekroz / Shaddoll / Spellbook board instead of 22 vanilla LOB cards.

Success = 30/30 items shipped, `npm run check` green, one manual duel per deck completed by the
user without a deadlock.

### Settled

**Base and sequencing**
- S1 Merge `feat/duel-field-round-2` (`736b374`) into `main`, then branch `feat/duel-field-round-3` off `main`.
- S2 The deck epic is the first work in the plan, not the last.

**Decks (item 12)**
- S3 Four new `.ydk` files are seeded from the local catalog by the plan and may be overwritten by the user at any time with no code change — deck files are `?raw` Vite imports, pure data.
- S4 `MVP_SUPPORTED_CARD_CODES` stops being a hand-written list. The reviewed pool becomes the build-time union of every bundled deck's codes.
- S5 The pre-duel picker replaces auto-start. Two deck lists side by side, a Start button. Rematch replays the same pair; a "Change decks" button returns to the picker.
- S6 Acceptance for a deck is **manual only**: one duel per deck, played and reported by the user. No deck-specific automated tests. Everything structural around the decks (registry parsing, derived pool, picker behaviour, image manifest) is still test-driven.
- S7 `OpponentPolicy` keeps its first-legal heuristics. It gains **only** a loop breaker: an identical prompt signature repeating with no state-revision change forces a different legal choice, and once they are exhausted, pass or end the phase.

**Layout**
- S8 The 44 px pointer-target floor and the board's `min-width: 52rem` never yield. The preview column is what degrades.
- S9 The preview stays on the **left** and widens into the empty space (item 20). The full-width bottom band (item 21) is a responsive fallback that fires only when the viewport cannot hold both minimum widths.
- S10 Short viewport: the preview collapses to a small art thumbnail plus the card name, with the effect text scrolling in whatever height is left.
- S11 The hand has no zone rectangle. The band spans exactly spell/trap zone 1 through 5. Above 10 cards it paginates with left/right arrows plus a horizontal scrollbar, and cards never fan tighter than one card width. The opponent's hand mirrors this exactly.
- S12 The shared Extra Monster Zones are removed when neither chosen decklist contains a Link monster. Decided once at duel start from both decklists; the layout is then fixed for the whole duel.
- S13 Life points carry a static role label, `You` and `Opponent`. No deck name.

**Interaction**
- S14 Halo palette: green = any valid/legal target; orange = selected or awaiting confirmation; drop candidate = green with a filled tint; keyboard focus = neutral outline, never green or orange; feedback animation = teal; list-entry hover = orange.
- S15 Hover zoom is 1.35x over 120 ms ease-out on hand cards, field cards and zone-list entries. Hand cards grow upward, field cards from their centre, the halo scales with the card, and the whole effect is disabled under `prefers-reduced-motion`.
- S16 Drag physics are **tier 2**: a ghost that follows the cursor, tilt proportional to pointer velocity, a spring settle on drop, a lift shadow and a scale. Hand-rolled `requestAnimationFrame`, **no dependency added**.
- S17 One selection rule: any prompt whose minimum and maximum are both 1 submits on the click with no confirmation. This covers attack targets (item 10) and single-candidate effects (item 29) alike. Multi-select keeps a counter and a Confirm button inside the floating window.
- S18 The zone list dialog is used for targets **outside** the field (graveyard, deck, banished, extra deck, hand). On-field targets keep in-place highlighting, and a mixed prompt shows both at once.
- S19 Both the zone list dialog and the confirm window become draggable floating windows constrained to the duel field. Clicking outside **closes the zone list** and **never closes the confirm window**, because dismissing the latter would discard a live decision.

**Persistence**
- S20 `localStorage` enters the codebase behind one versioned key holding the two window positions and the selected deck pair. Unparseable or wrong-version data is discarded and defaults are used. No other UI setting becomes persistent.

**Privacy / worker**
- S21 The worker tracks public knowledge of face-down cards, exactly per this table:

  | Event | Ruling |
  | --- | --- |
  | Moves from graveyard / banished / face-up field into a face-down field position | KEEP identity |
  | Face-up card on the field is turned face-down | KEEP identity |
  | Publicly revealed to the local player by an effect, then placed face-down | KEEP identity |
  | Opponent sets a card from hand | stays hidden |
  | Summoned face-down from deck or a hidden hand | stays hidden |
  | Leaves its zone, returns to deck/hand/extra, or is shuffled | CLEAR the reveal |

  Conservative by construction: the projection may forget a reveal, it must never invent one.

### Assumptions (decided by the planner, logged not asked)

- A-G1 Item 3 = rotate the opponent's stack and list card art 180 degrees, matching `.duel-field-card.is-opponent`. No new state.
- A-G2 Item 4's red X close button applies to `ZoneListDialog` only. `MenuDialog`, `SettingsDialog`, `PromptDialog` and `DuelResultDialog` keep their current buttons.
- A-G3 Item 5 = raise `.card-action-chips` above every field layer using the existing `--duel-field-layer-*` scale. No portal, no teleport.
- A-G4 Items 14 and 16 are coordinate changes in `src/field/duel-field-layout.ts`.
- A-G5 Items 22 and 24 are `PhaseStrip.svelte` plus CSS.
- A-G6 Item 27 caps the zone-list dialog's preview image at `50svh`.
- A-G7 Any ticket that moves or deletes a `data-cy` asserted in `e2e/duel-smoke.spec.ts` updates that spec in the same commit. Carried from round 2's process lesson.
- A-G8 The deck registry lists **six** decks: the four new archetypes plus the two existing MVP decks, which stay selectable as a known-good pair and remain the default selection so the existing e2e walkers keep a deterministic card pool.
- A-G9 The loop breaker triggers at **3** consecutive identical prompt signatures with an unchanged state revision.
- A-G10 The `localStorage` key is `ygo.ui.v1`, holding `{ windows: { zoneList, confirm }, decks: { player, opponent } }`.
- A-G11 Item 23's Link detection reads the catalog `type` bit `0x4000000`; the browser-side card manifest gains one field to carry it.
- A-G12 Playwright stays chromium-only and foreground, with `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers` and the pinned nix `-p` list. `webkit-smoke` is unrunnable on this host.

### Out of scope

- Improving opponent play quality beyond the loop breaker.
- Deck editing, deck import from arbitrary user files, side decks.
- Persisting any UI setting other than window positions and the deck pair.
- Engine or WASM upgrade, card data pipeline changes beyond the image/text manifest widening.
- Story systems, progression, multiplayer, i18n, mobile-first redesign.
- Automated per-deck matchup simulation (explicitly declined in round 2, question 10).
