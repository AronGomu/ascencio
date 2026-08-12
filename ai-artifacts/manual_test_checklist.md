# Manual test checklist

Human-only checks that automated tests cannot cover. One section per plan ticket; never edit another ticket's section.

## T1 land-round-2-on-main

- [x] Chromium e2e completed 18/18 on merge commit `52eb619`; full keyboard-only preset duel finished with one response per prompt.
- [x] Headless, component, unit, integration, legacy, and production-build gates passed on merged round-2 baseline.
- [x] Current branch contains round-2 head `736b374`; `feedback.md` remained unstaged.

## T2 deck-registry-and-derived-card-pool

- [ ] Start app in Chromium: duel auto-starts with Starter (Player) against Starter (Opponent), with no deck picker or other new visible control.
- [ ] Play opening turn of default duel: original MVP cards, prompts, field, and opponent behaviour remain unchanged.
- [ ] Open each new `.ydk` in a compatible deck viewer: Burning Abyss, Nekroz, Shaddoll, and Spellbook lists match intended archetypes and contain full 15-card Extra Decks.

## T3 pre-duel-deck-picker-and-persistence

- [ ] Run `npm run dev`, open app in Chromium, confirm deck picker appears before any duel starts.
- [ ] Choose Burning Abyss for your deck, Shaddoll for opponent, press Start, confirm duel field opens.
- [ ] Reload page, confirm picker reopens with Burning Abyss and Shaddoll still selected.
- [ ] In DevTools, run `localStorage.getItem("ygo.ui.v1")`; confirm JSON has `"version":1` and chosen deck ids.
- [ ] Start chosen duel, surrender, press Change decks; confirm picker returns with same pair selected and no duel auto-starts.
- [ ] Start another duel, surrender, press Start another duel; confirm replacement Worker starts same chosen pair after ready.

## T4 opponent-policy-loop-breaker

- [ ] Run a deterministic diagnostic duel that previously repeated one unchanged opponent prompt; confirm duel advances without reaching the 1,000-response controller fuse.
- [ ] Inspect opponent response diagnostics for one unchanged prompt; confirm first two reasons stay normal, then reason becomes `break_loop_alternative` or `break_loop_exit`.
- [ ] Confirm every loop-break response id belongs to the current prompt, then play through next human prompt or duel result without an invalid-response error.

## T5 preview-hover-and-opponent-art-inversion

- [ ] Hover a passive field card, a player stack, an opponent stack, and one card in each open pile list; confirm persistent preview updates every time.
- [ ] Compare player and opponent pile/list art; confirm only opponent images are upside down while labels, counts, position badges, halos, and action chips stay upright.
- [ ] Inspect face-down cards on the board; confirm no visible `Hidden card` caption appears while screen-reader naming remains available.
- [ ] Use existing action chips, click a card, and drag a playable hand card; confirm each flow still works without layout, halo, zoom, or projector changes.

Ticket ids restart per plan, so sections are grouped by round. **Round 2 is the current implementation.** Where a round 2 ticket replaced round 1 behaviour, the round 1 section is marked **SUPERSEDED** and must not be run — its steps describe UI that no longer exists.

---

# Round 2 — 2026-08-09 duel field feedback (current)

## T1 header-bar-avatars-and-life-points


- [ ] `npm run dev`, open the app: the top row shows a duel header bar with the opponent avatar + LP on the left, your avatar + LP on the right, and a gear-icon settings button on the far right — no `Settings` text button anywhere.
- [ ] Both avatars show a placeholder circle image (or the card-back art once images finish loading) — never a broken image icon.
- [ ] Before the first duel snapshot arrives, both life-point readouts show `—`; once the duel starts they switch to numbers formatted like `8,000 LP`.
- [ ] Deal or take damage during a duel: both header LP readouts update to the new totals.
- [ ] Click the gear icon: the same menu opens as before (Settings / Surrender), and closing the menu returns focus to the gear button.
- [ ] The duel field itself no longer shows any life-point pills inside the board — only the header bar carries LP.
- [ ] Resize the window from a wide desktop down to a phone width: the header bar stays on one row (or wraps sanely), avatars and LP stay legible, and the gear button stays reachable and clickable.
- [ ] Keyboard only: tab to the gear button, confirm its accessible name announces as `Settings` and it activates with Enter/Space.

## T2 preview-panel-left-and-hover-status


- [ ] `npm run dev`, open on a wide desktop window: the card preview panel sits to the LEFT of the duel field (not the right), and the field is the right column.
- [ ] Hover a face-down card of yours or a hidden opponent hand card: the preview panel now fills with a hidden-card view — art placeholder, name `Face-down card`, text `No information is available for this card.` — instead of leaving the previous card up or staying blank.
- [ ] Hover any stack (deck, extra deck, graveyard, banished) with at least one public card in it: the panel fills with that stack's top public card.
- [ ] Hover an empty or fully-private stack: the panel shows the hidden-card view, not the previous card.
- [ ] Under the card art/text (or under the empty-state copy when nothing is previewed), a status line is visible.
- [ ] While a response has just been sent and the engine hasn't answered yet, the status line reads `Waiting for the engine` with an animated three-dot indicator after it.
- [ ] While it's the opponent's turn and you have no prompt, the status line reads `Opponent is acting` with the animated three-dot indicator.
- [ ] While you have an active prompt, the status line echoes that prompt's title (e.g. `Choose a Main Phase action`) with no animated dots.
- [ ] With OS-level "reduce motion" turned on, the three dots are still visible next to the status text but do not animate.
- [ ] Resize the window down to 1024px wide: the board still renders and every board control remains clickable, and the preview column does not push a horizontal scrollbar onto the page.
- [ ] Shrink further below the responsive breakpoint (~79rem/1264px): the preview panel stacks above the field (not beside it) rather than disappearing or overlapping.

## T3 phase-strip-and-end-turn-placement


- [ ] `npm run dev`, reach a Main Phase 1 idle-command prompt: an in-field phase strip is visible in the free centre band of the board, split into a left group (`Draw`, `Standby`, `Main 1`) and a right group (`Battle`, `Main 2`, `End`), and it does not visually overlap either shared Extra Monster Zone.
- [ ] During Main Phase 1, the `Main 1` chip has a blue halo (the current-phase highlight), `Battle` and `End` are lit and clickable, and `Draw`/`Standby`/`Main 2` are greyed and not clickable.
- [ ] Click the `Battle` chip: the duel advances into the Battle Phase, the `Battle` chip now carries the blue halo, and the board (cards, zones) stays fully clickable — no click is swallowed by the strip.
- [ ] Progress through Draw, Standby, both Main Phases, Battle Start/Step/Damage/Damage Calculation and End: exactly one chip carries the current-phase halo at a time, and every battle sub-phase (`battleStart`, `battleStep`, `damage`, `damageCalculation`, `battle`) lights the single `Battle` chip.
- [ ] The `End turn` button sits at the right edge of the board, roughly level with the two banished zones (between them vertically), and stays clickable and functional exactly as before (ends your turn when clicked).
- [ ] The top-right status pills (`Choose Action`/`Waiting Opponent` and the old phase pill) are gone; nothing at the top-right corner of the field displays that text or blocks clicks there.
- [ ] Resize the window across a few widths (desktop, ~1024px, phone width): the phase strip and End turn button stay inside the board's free band, do not overlap the banished zones or Extra Monster Zones, and every card/zone remains clickable at each size.
- [ ] Keyboard only: tab through the field; the phase strip chips and the End turn button are each reachable and operable via keyboard, and tabbing does not get stuck inside the board region.
- [ ] With a screen reader, each phase chip announces its phase name plus `current`/`available` state (e.g. "Battle phase, available"); the strip as a whole is one `Duel phases` group, not announced twice.

## T4 auto-response-and-prompt-trimming


- [ ] `npm run dev`, open Settings: two new checkboxes are present after the existing two, labelled `Place cards automatically` (checked by default) and `Skip prompts with a single answer` (checked by default).
- [ ] Play a turn with default settings: no `Choose a chain response` dialog appears when you have nothing to chain (only a `Pass` option) — the duel proceeds straight past it.
- [ ] Reach a chain prompt that genuinely offers you an activation (you have a card you could chain): the dialog still appears and waits for your click; it is not skipped.
- [ ] Open the Main Phase action list (the field action bar, when it is showing, or the equivalent card-action chips): `Shuffle Deck` is never offered as an action, on any turn.
- [ ] Turn off `Skip prompts with a single answer` in Settings, then play a turn where a trivial chain (nothing to activate) would occur: the `Choose a chain response` dialog now appears and must be answered by hand (Pass).
- [ ] Turn `Skip prompts with a single answer` back on mid-duel: from that point on, trivial prompts go back to resolving automatically without a click.
- [ ] Reload the page: both new settings reset to their defaults (checked), matching the existing session-only behaviour of the other two toggles.

## T5 auto-placement-and-single-click-actions


- [ ] `npm run dev`, with `Place cards automatically` left on (the default): summon or set a monster — it lands directly in the centre-most legal zone with no follow-up "choose a zone" prompt of any kind. (manual check: auto-place ON)
- [ ] Turn `Place cards automatically` off in Settings, then summon or set a monster: the legal zones halo, one click on any one of them plays the card immediately with no `Confirm placement` button anywhere, and one click on an empty part of the board (no card, no zone, no bar/strip/button) cancels the pending placement and returns you to the previous prompt. (manual check: auto-place OFF)
- [ ] With auto-place on, repeatedly summon/set monsters across a duel and confirm the chosen zone always looks like the same "most central first" order a player would expect (centre main-monster zone before the edges, main row before the extra monster zones, your side before the opponent's).
- [ ] With auto-place off, open a hand card that offers exactly one action (e.g. only `Activate`): clicking the card fires that action immediately — no chip menu ever appears for it.
- [ ] With auto-place off, open a hand card that offers two or more actions: clicking the card still opens the chip menu exactly as before, and clicking a chip fires that one action.
- [ ] With auto-place off, start a placement, then click a legal zone: the card is played immediately with no separate `Confirm placement` step.
- [ ] With auto-place off, start a placement that is cancelable and click elsewhere on the empty board: the prompt cancels cleanly, no error/toast appears, and you're returned to the state before the placement started.
- [ ] With auto-place off, start a placement that is *not* cancelable (if you can reach one) and click elsewhere on the empty board: nothing happens — the prompt stays open, no error appears.
- [ ] Dragging a hand card onto a highlighted zone (T10) still plays it in one gesture and still wins over auto-placement — the drag never pops up a redundant place prompt regardless of the auto-place setting.
- [ ] Play a full duel with auto-place on and `Skip prompts with a single answer` on (both defaults): the duel proceeds smoothly with the fewest possible prompts, and no click is ever swallowed by a stray Confirm bar that shouldn't be there.
- [ ] Reload the page: `Place cards automatically` resets to checked (the default), matching the other settings' session-only behaviour.

## T6 stack-interaction-targets


- [ ] `npm run dev`; get the engine to offer a graveyard activation (e.g. an effect that can be activated from the graveyard): the graveyard pile glows with the same orange "you may act here" halo the field's actionable zones and cards use.
- [ ] ~~While that graveyard pile glows, the modal `PromptDialog` still opens — clicking the pile itself does nothing.~~ **Superseded by T8 and T11:** the pile is now clickable and opens its zone list, and the chain modal is gone. Verify instead via the T8 and T11 sections.
- [ ] Clicking on a glowing stack does not throw a console error.
- [ ] Reach a banished-pile activation, an extra-deck activation, and a deck activation (if you can find/force one) in turn: each pile glows the same orange while the choice is live, and each is answerable by clicking the pile and acting from its list.
- [ ] Confirm no previously reachable choice became unanswerable across a full duel: every prompt that used to resolve via the modal (including graveyard/banished/deck/extra activations) is still answerable start to finish.

## T7 stack-top-card-face


- [ ] `npm run dev`, send a monster to the graveyard: the graveyard pile shows that card's art with `GY` and the count still readable on top of the art.
- [ ] The deck and extra deck piles are unchanged (no art appears on the deck pile; the extra deck pile behaves as before).
- [ ] Open and restart a duel twice while watching devtools memory for `blob:` URLs: no image lease leaks — the count of live `blob:` URLs does not keep growing across restarts.

## T8 zone-list-dialog


- [ ] `npm run dev`; click your graveyard: a centred list opens over the field, scrolls horizontally, numbers each card starting at 1, previews the hovered card in the left preview panel, and closes on Escape. (manual check)
- [ ] Click the opponent's extra deck: every entry in the list is face-down (card back only, no name, no art) regardless of what you might otherwise infer from earlier play. (manual check)
- [ ] ~~Click your deck: the list shows one face-down placeholder per card in your deck count.~~ **Superseded by T10:** the deck list now renders the real projected deck order. Verify via the T10 section.
- [ ] The dialog never shows a backdrop and never blocks the rest of the board — a legal-action card elsewhere on the field is still clickable while the dialog is open.
- [ ] Reach a graveyard or banished-pile activation prompt (e.g. an effect that activates from the graveyard): the pile itself gets the orange actionable halo, and clicking it opens the list with an orange halo and action chips on the specific card the engine is offering — no separate modal "Choose a chain response" dialog appears for this case.
- [ ] With that same list open, click the action chip on the actionable card: the action fires, the dialog closes, and the duel proceeds — the same as clicking a chip on a card on the board.
- [ ] Click an already-open pile a second time: the list closes.
- [ ] Trigger a new prompt (e.g. pass priority to the opponent) while a zone list is open: the list closes automatically without needing another click.
- [ ] An empty pile (0 cards) is not clickable and shows no hover/focus affordance.
- [ ] Keyboard only: tab to a non-empty pile, press Enter/Space to open its list, tab through the entries and any action chips, and confirm Escape closes the dialog and returns focus sensibly.

## T9 projected-deck-order


- [ ] Complete a duel, inspect final projected state, confirm `players[0].deck.length === players[0].deckCount`.

## T10 deck-list-in-zone-dialog


- [ ] `npm run dev`; click your deck: the list shows one face-down entry per remaining card, numbered from the top with position 1 first.
- [ ] Click the opponent's deck: every unrevealed entry stays face-down with no card name, code, or face art exposed.
- [ ] If the preset deck contains an excavate effect, resolve it: legitimately revealed positions render face-up, then return face-down after a shuffle.
- [ ] With either 40-card deck dialog open, scroll the list and click a legal card target elsewhere on the board: the dialog stays usable without intercepting unrelated board clicks.
- [ ] Confirm the deck pile itself still shows only its name and count, never card art.

## T11 inline-chain-response


- [ ] `npm run dev`; trigger a chain: no modal appears, the preview reads `Do you respond?` with pulsing dots, and every activatable source glows orange on the field or on its pile.
- [ ] On a cancelable chain, click an activatable source to respond; trigger another chain and click empty field to pass. Both choices advance the duel exactly once.
- [ ] Trigger a forced chain: clicking empty field does nothing, no `Pass` button appears, and clicking the required field or pile source answers it.

## T12 result-dialog


- [ ] `npm run dev`, surrender from the menu: a centred modal dialog announces `Duel surrendered`, focus lands on its heading, and `Start another duel` starts a clean duel.
- [ ] Click the dialog backdrop and press Escape: the result dialog stays open; no close control appears, while restart and diagnostics remain reachable.
- [ ] Complete a duel normally: the winner announcement appears without reflowing the page behind it, and diagnostics still download.

## R1 review-repairs

- [ ] Trigger an optional chain, open a glowing graveyard pile, then click its Close button and a non-chip area of an entry tile in separate attempts: neither click passes the chain; clicking genuine empty field still passes exactly once.
- [ ] During a cancelable multi-card pile selection, open the pile and click the zone-list header: the selection stays live and no cancel response is sent.
- [ ] Reach or force a deck-located choice in a deck of known size: its chip and orange halo appear on the correct top-relative list position, and no unrevealed mirrored slot exposes a card name.
- [ ] Trigger a chain while the duel field is unavailable through its render-failure path: the prompt dialog mounts and remains answerable under the field-error panel.
- [ ] Open a non-empty pile with the mouse, leave focus on the pile button, then press Escape: the list closes; pressing Escape with no zone list open does not disturb chips or other dialogs.
- [ ] Reach a field prompt that requires the field action bar, then resize across desktop and phone widths: the bar stays fully in the viewport and entirely below the duel board without covering hand clicks.
- [ ] Play a full duel start to finish: every field, pile, chain, and dialog prompt remains answerable.

---

# Round 1 — 2026-08-08 duel field UX overhaul (archive)

Kept for history. Read the SUPERSEDED banners before running anything here.

## R1-T6 field-action-bar — SUPERSEDED


> Superseded by round 2. `Shuffle Deck` no longer exists as an action (round 2 T4), the bar's `End turn` moved into the board's phase strip (round 2 T3), and single-action cards now fire on one click without a `Confirm` step (round 2 T5). Do not run this section; use round 2 T3, T4 and T5 instead.

- [ ] Start a duel and reach a "select a card" prompt: a compact bar appears pinned to the bottom of the duel field, below the board, with the prompt title on it.
- [ ] The bar sits in its own strip under the board — it does not cover the player's hand, and no empty strip is left under the board once the bar disappears.
- [ ] A legal-action card at the bottom of the board is still clickable while the action bar is on screen (click a hand card that has actions; its chips appear and stay pinned, nothing swallows the click).
- [ ] Select two cards: the bar shows `2 selected` as a count on one line, never a comma-separated list of card names.
- [ ] `Confirm selection` is disabled until the selection is legal, and the red validation text under it explains why.
- [ ] `Cancel` appears only on prompts the engine allows you to back out of, and backing out returns you to the same board state.
- [ ] Reach a counter-allocation prompt: each choice has its own `−` / value / `+` group, `−` is dead at 0, `+` is dead at the maximum, and the button reads `Confirm allocation`.
- [ ] Reach an ordering prompt: each row has `↑` / `↓`, the top row's `↑` and the bottom row's `↓` are dead, and the button reads `Confirm order`.
- [ ] With enough counter or order rows to overflow, the list scrolls inside the bar instead of growing the bar to full height, and the board stays fully visible.
- [ ] Reach a place-selection prompt: the button reads `Confirm placement` and the zone you click is the one that gets used.
- [ ] Global choices such as `Shuffle Deck` or `Enter Battle Phase` are buttons on the bar and act on click.
- [ ] A yes/no or announce prompt opens the centre prompt dialog instead — no action bar appears on the field for it.
- [ ] Resize the window from a wide desktop down to a phone width: the bar stays fully on screen, stays clear of the board at every size, and never clips off the field edge.
- [ ] Keyboard only: tab from the board into the bar, operate every control, and confirm — focus outlines stay visible throughout.
- [ ] With a screen reader, the bar announces as the `Field decision` region and the validation text is read out when confirm is blocked.

## R1-T7 end-turn-corner-button — SUPERSEDED


> Superseded by round 2 T3: `End turn` no longer sits in the bottom-right corner outside the board. It now sits at the board's right edge, level with the banished zones, deliberately inside the board's bounding box. The "never sits on top of the board" step below is no longer the intended design. Do not run this section; use round 2 T3.

- [ ] An orange `End turn` button sits fixed in the bottom-right corner of the duel field at all times, whether or not any other prompt is on screen.
- [ ] In Main Phase with nothing else to do, the button is enabled and reads `End turn`; clicking it ends the phase.
- [ ] In Battle Phase, the same corner button reads `End Battle Phase` instead, and clicking it ends the battle phase.
- [ ] When no `End turn` choice is currently legal (e.g. a card-action prompt that offers no phase choice), the corner button is visibly disabled and unclickable, but still reads `End turn`.
- [ ] The field action bar no longer shows its own `End turn` / `End Battle Phase` button — that choice only ever appears in the corner now. If a prompt's only reason to show the bar was that choice, no bar appears at all.
- [ ] The corner button never sits on top of the board — a legal-action card in the board's bottom-right corner is still clickable with the corner button on screen.
- [ ] When the field action bar is also open, the corner button and the bar do not overlap each other at any window width, including a narrow phone-width window where the bar and button both need room in the bottom strip.
- [ ] Resize the window from a wide desktop down to a phone width: the corner button stays fully on screen and never overlaps the board at any size.
- [ ] Double-clicking the corner button quickly (or clicking again while a response is pending) only ends the phase once.
- [ ] Keyboard only: tab to the corner button, confirm it announces its current label (`End turn` or `End Battle Phase`) and its disabled state is announced when it's not usable.

## R1-T9 card-action-chips — PARTLY SUPERSEDED


> Round 2 T5 changed chip behaviour: a card offering exactly one action now fires it on a single click and never opens a chip menu, and placement no longer has a `Confirm placement` step. The multi-action chip steps below still hold. Prefer round 2 T5 for anything about clicking a card.

- [ ] Reach a Main Phase idle-command prompt: every card you can act on wears an orange halo, and cards you cannot act on wear none.
- [ ] Actionable zones (e.g. a place-selection prompt) wear the same orange halo; a card you have _selected_ keeps its distinct lime highlight, so legality and selection never look alike.
- [ ] Hover an actionable card with the mouse: tiny orange chips fade in floating just above the card's top edge, and nothing appears when you hover a card with no legal action.
- [ ] Move the pointer from the middle of the card straight up onto a chip without the chips disappearing on the way — there must be no dead gap between the card and its chips.
- [ ] Chip wording is the short action only (`Summon`, `Set`, `Activate`, `Flip`, `Special Summon`, `Change Position`), never the engine's full `Activate <card name>` sentence.
- [ ] Hover a chip and wait for the native tooltip: it shows the full engine label for that action.
- [ ] A monster in hand that can be both summoned and set shows both chips at once, and they stay the same fixed size regardless of the word length.
- [ ] There is no `Inspect` chip, no `Close actions` chip, and no `Inspect` button on any card on the board.
- [ ] Click a chip: the action is taken exactly once, the chips disappear, and the duel moves on — clicking fast twice must not send two responses.
- [ ] Click the card itself (not a chip): the chips stay pinned open even after you move the mouse away; clicking a different actionable card moves the pin to that card.
- [ ] Press and drag from a card, then release somewhere harmless (empty space outside the board): the drag must _not_ pin the chips — only a clean click does. Dragging a _hand_ card onto a highlighted zone now plays it instead (see T10); drag a board card, or release off the board, to check this one.
- [ ] Keyboard only: arrow to an actionable card, press `Enter`: the chips pin and focus lands on the first chip with a visible focus ring.
- [ ] With a chip focused, `ArrowRight` / `ArrowLeft` walk the chips and wrap around at both ends; `Home` and `End` jump to the first and last chip.
- [ ] Press `Escape` with a chip focused: the chips unpin and focus is back on the card itself, ready for arrow-key board navigation.
- [ ] Tab or arrow the keyboard focus onto an actionable card without pressing Enter: the chips show while the card holds focus and hide again once focus moves elsewhere.
- [ ] Chips never fall off the edge of the window: check an actionable card in the leftmost and rightmost columns, and on a phone-width window.
- [ ] Chips never cover the board's own controls in a way that blocks them: with chips showing, the `End turn` corner button and the field action bar are both still clickable.
- [ ] Play a full duel using only the chips for card actions: every Main Phase, Battle Phase and chain decision stays answerable to the end of the duel.
- [ ] With a screen reader, a chip announces the full engine label (e.g. `Activate Mystical Space Typhoon`), not the short word, and the chip group announces as `<card name> actions`.

## R1-T10 hand-drag-and-drop


> Still current. Round 2 T5 added auto-placement but drag still wins over it — see the corresponding step in round 2 T5.

- [ ] Reach a Main Phase idle-command prompt and press-and-drag a summonable monster out of your hand: after roughly 8px of movement the card fades slightly and the empty Main Monster zones fill with an orange tint that is clearly different from the plain orange legality halo.
- [ ] While that drag is live, no Spell/Trap zone, no Field zone, no opponent zone and no already-occupied monster zone lights up.
- [ ] Release over one of the tinted zones: the monster is summoned into exactly that zone in one gesture — no second click, and no zone-picker prompt appears.
- [ ] Drag the same kind of card and release it over an _occupied_ monster zone: nothing happens at all, the card stays in your hand and no response is sent.
- [ ] Drag a hand card whose only offers are a Normal Summon and/or a Set, and release it on either shared Extra Monster Zone in the middle row: nothing happens — the card stays in your hand, your once-per-turn Normal Summon is still available, and no zone-picker prompt appears. Those two zones must never tint for such a card either.
- [ ] Drag a hand card the engine offers a _Special_ Summon for and release it on a tinted shared Extra Monster Zone: the card arrives there as a Special Summon and your Normal Summon for the turn is still unspent.
- [ ] Drag a card and release it outside the board entirely: nothing happens and the tint disappears.
- [ ] Drag a settable Spell or Trap out of your hand: only the Spell/Trap zones tint, never the monster row, and dropping on one plays it.
- [ ] Start a drag and then press `Escape` or switch to another window mid-gesture: the tint clears and no card is played.
- [ ] Drag a hand card that also has pinned action chips showing (click it first to pin, then drag it): the chips must not swallow the drop — the zone under the pointer is the one that receives the card.
- [ ] Click a hand card normally (no movement) after this change: the chips still pin and still work exactly as before.
- [ ] Play a card by dragging, then keep playing with chips and the keyboard for the rest of the turn: nothing about the earlier drag leaks into a later decision (no zone gets chosen for you unexpectedly).
- [ ] Keyboard only, with no mouse touched: the whole duel is still playable and no drag behaviour interferes.
- [ ] Rare case, if you can reach it: play a card whose zone the engine refuses (e.g. a summon that must go to a specific zone). The normal zone-selection prompt appears with its own highlighted zones and you pick one by hand — the mis-guess costs you nothing.

## R1-T11 card-preview-panel — SUPERSEDED


> Superseded by round 2 T2: the preview panel moved to the LEFT column, hovering a face-down card now fills the panel with a hidden-card view instead of leaving it unchanged, and the panel gained a status line. Do not run this section; use round 2 T2.

- [ ] Open the app on a wide desktop window (wider than ~1264px): a `22rem` panel sits to the right of the duel field, its top edge level with the field's and its bottom edge level with the field's, and the board is still fully visible with no horizontal scrollbar anywhere.
- [ ] Before you touch anything, the panel reads `Hover a card to see its details.` and shows no image, no name and no effect text.
- [ ] Hover each card in your hand in turn: the panel fills with that card's art, name and effect text, and swaps as you move between cards.
- [ ] Press and hold the pointer down on a face-up monster on the field (without moving it): the panel fills with that card while the button is held.
- [ ] Move the pointer off the card and onto the panel: the content stays put — it must not blank out while you are reading it.
- [ ] Hover a face-down card of yours and an opponent hand card: the panel does not change at all — it neither fills with the hidden card nor clears whatever it was showing.
- [ ] Keyboard only: arrow the board focus from card to card — the panel follows the focused card exactly as hovering does.
- [ ] Find a card with long effect text: the text region scrolls inside the panel, and the panel and the duel field stay the same height — the field must not get taller to fit the text.
- [ ] Try to click, tab into, or select anything in the panel: nothing in it is focusable or clickable, and tabbing through the page skips it entirely.
- [ ] With the Duel HUD enabled, open a card tray and click an `Inspect …` button: the panel fills with that card instead of a modal dialog opening.
- [ ] There is no card-inspector dialog anywhere any more, and pressing `Escape` with the panel filled does nothing (it must not close or clear the panel, and it must not disturb pinned action chips).
- [ ] Slowly shrink the window below ~1264px: the panel drops beneath the duel field, the field becomes full width, and the panel is capped at about `18rem` tall with its text still scrollable.
- [ ] Keep shrinking to a phone width: the panel stays under the field, stays fully on screen, and nothing on the page scrolls sideways except the duel field itself.
- [ ] Surrender and start another duel: the panel resets to its empty state instead of holding the previous duel's card.
- [ ] Play a full duel with the panel on screen: card art keeps loading correctly and the app never slows down or shows a broken image placeholder where art should be.

## R1-T8 status-and-life-pills — SUPERSEDED


> Superseded by round 2. The in-field life-point pills were deleted and life points moved to the header bar (round 2 T1); the top-right priority/phase pills were deleted and replaced by the in-field phase strip (round 2 T3). Nothing in this section still exists. Do not run it; use round 2 T1 and T3.

- [ ] On your turn, the field's top-right corner reads `Choose Action - Main 1` (or the current phase) in two pills separated by a `-`, the left pill green.
- [ ] While the opponent is acting (your response has been sent and you have no prompt), the left pill turns orange and reads `Waiting Opponent`; the phase pill still updates.
- [ ] Play through Draw, Standby, both Main Phases, Battle Start, Battle Step, Damage, Damage Calculation, Battle and End: the phase pill shows the matching human-readable name at each step.
- [ ] Two life-point pills are visible inside the duel field itself (not the Duel HUD): the opponent's top-left, yours bottom-left, each formatted like `8,000 LP`.
- [ ] Deal or take damage: both LP pills update to the new totals immediately.
- [ ] The status pills and both life pills never block a click — a card underneath any of them (top-right corner, top-left corner, bottom-left corner) is still clickable/draggable exactly as if the pill were not there.
- [ ] With a screen reader, the priority/phase pill group announces once per change (not once per unrelated re-render) as a single `polite` region; the `-` separator itself is not announced.
- [ ] There is no `Inspect` button in the Duel HUD pointing at a missing `card-inspector` id — Inspect buttons still open the card preview panel with no console error.

## T7 zone-naming-and-field-geometry (round 3)

- [ ] `npm run dev` at a 1280×720-ish window: every painted zone label is short and owner-neutral — `Monster Zone 1…5`, `Spell/Trap Zone 1…5`, `Field Zone`, `Deck`, `Extra Deck`, `GY`, `Banished`, `Hand` — with no `Your`/`Opponent` prefix anywhere on the board, and only the two shared zones still read `Shared Extra Monster Zone left/right`.
- [ ] Eyeball the five central columns: cards sit visibly closer together horizontally than before, and the two rows on each side sit visibly further apart vertically, without any card overlapping its neighbour.
- [ ] Eyeball both outer columns: each player's Extra Deck pile sits directly under (opponent: over) that player's Field Zone, sharing the same vertical line.
- [ ] With a screen reader on, tab into the field and arrow around: player-0 controls announce `Your …`, player-1 controls announce `Opponent …`, the shared zones announce `Shared Extra Monster Zone left/right`, `Spell/Trap` is spoken as `Spell and Trap`, and `GY` is spoken as `Graveyard`.
- [ ] With a screen reader on, focus a card on the field: it announces the owner-aware zone (e.g. `The Legendary Fisherman in Your Monster Zone 2`) while the painted zone underneath still reads `Monster Zone 2`.
- [ ] Arrow-key around the whole field by hand: both shared Extra Monster Zones are reachable (press Up from your Monster Zone 2/3/4, or Down from the opponent's), and no zone, pile, or hand card is stranded with no way in.
- [ ] Arrow navigation still feels sane after the shared zones joined the vertical path: pressing Up twice from your monster row lands on the opponent's row via the shared zone rather than jumping somewhere unrelated.
- [ ] Play a short duel: summoning, setting, dragging from hand, and opening a pile's list all still land on the intended zone — the tighter columns did not shift any hit target off its card.

## T6 face-down-public-knowledge (round 3)

- [ ] `npm run dev` and start a duel. Let the opponent summon a monster face-up, then wait for it to be flipped/set face-down in the same zone (or force it with a card that changes position): the board still paints the card back, but hovering it fills the preview panel with that monster's art, name and effect text.
- [ ] Focus that same face-down opponent monster with the keyboard: the screen reader announces the known card name and its zone, not `Hidden card`.
- [ ] Privacy check — the opponent sets a card straight out of its hand (nothing revealed it first): the board paints a card back, hovering it leaves the preview panel on `Face-down card` with no art, no name and no effect text, and keyboard focus announces no card name.
- [ ] Still on that set-from-hand card: open Settings → download diagnostics (or the result dialog's `Download diagnostics`) and search the file for that card's name and passcode — neither appears anywhere in the snapshot or event log.
- [ ] Opponent GY/Banished trays: a face-up card in an opponent pile is still named and inspectable; an unrevealed opponent Extra Deck entry is still unnamed and shows only a card back.
- [ ] Watch a known face-down opponent card get destroyed or sent to the GY: it appears in the GY named, and the preview panel resolves it from the GY as usual.
- [ ] Watch a known face-down opponent card leave the field for the hand or deck (a card that returns it): once it is back in a hidden zone it is no longer identified, and a later set of that same card is unnamed again.
- [ ] Your own cards are unchanged: your hand, your set spells/traps and your face-down monsters all still hover-preview with full art, name and effect text.
- [ ] Play a full duel to the result dialog: no error banner, no worker restart, and the field never shows an identified card in a zone that should be secret.

## T8 hand-band-and-pagination (round 3)

- [ ] `npm run dev`, start a duel with 11+ cards in your hand (e.g. via a diagnostic/test deck or by drawing extra cards): only 10 cards are visible at once, a `Page 1 of 2` status is present, and the 11th+ card is reachable only after paging.
- [ ] With that 11+ hand, use keyboard-only play: focus card sequence 9 (10th card) and press ArrowRight — sequence 10 becomes focused and the page visibly turns to page 2. From sequence 10, press ArrowLeft — sequence 9 becomes focused again and the page turns back to page 1. No duplicate cards, no lost focus.
- [ ] Mirror the same crossing for the opponent's hand if it also holds 11+ cards: ArrowLeft moves forward across the page boundary, ArrowRight moves back (mirrored direction from the player's).
- [ ] Click the previous/next arrows directly with the mouse: the page changes by 10 cards, the correct arrow disables at each end (page 1 has no previous, the last page has no next), and both arrow buttons are comfortably clickable (not tiny/finicky targets).
- [ ] With a hand wider than the viewport at a page's card count, use the mouse wheel or trackpad over the hand row: it scrolls horizontally to reach cards within the current page without needing the arrows.
- [ ] Visually confirm neither hand shows a bordered/dashed rectangle behind the cards any more — cards sit directly on the plain board background.
- [ ] Visually confirm the opponent's hand still mirrors the player's hand: card backs face the same way as before, and the left-to-right visual order looks like a mirror image of your own hand's order.
- [ ] Visually confirm both hands span exactly the five Spell/Trap zone columns (S/T1 through S/T5) — the hand's left/right edges line up with the outer edges of the leftmost and rightmost Spell/Trap zones, not wider or narrower.
- [ ] Visually confirm each player's Deck/GY and Banished piles sit snugly next to the Spell/Trap row and Monster row respectively, with the same visual gap as between any two adjacent central-column zones — no crowding or odd extra whitespace around the pile column.
- [ ] Drag a hand card onto a highlighted zone as usual (e.g. Summon/Set): the drag still works exactly as before paging was added, from any page.
- [ ] Play a full duel to completion: no console errors, no broken path, and the hand always remains usable (draw, discard, play from any page) throughout.
