# Manual test checklist

Human-only checks that automated tests cannot cover. One section per plan ticket; never edit another ticket's section.

## T6 field-action-bar

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

## T7 end-turn-corner-button

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

## T9 card-action-chips

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

## T10 hand-drag-and-drop

- [ ] Reach a Main Phase idle-command prompt and press-and-drag a summonable monster out of your hand: after roughly 8px of movement the card fades slightly and the empty Main Monster zones fill with an orange tint that is clearly different from the plain orange legality halo.
- [ ] While that drag is live, no Spell/Trap zone, no Field zone, no opponent zone and no already-occupied monster zone lights up.
- [ ] Release over one of the tinted zones: the monster is summoned into exactly that zone in one gesture — no second click, and no zone-picker prompt appears.
- [ ] Drag the same kind of card and release it over an _occupied_ monster zone: nothing happens at all, the card stays in your hand and no response is sent.
- [ ] Drag a card and release it outside the board entirely: nothing happens and the tint disappears.
- [ ] Drag a settable Spell or Trap out of your hand: only the Spell/Trap zones tint, never the monster row, and dropping on one plays it.
- [ ] Start a drag and then press `Escape` or switch to another window mid-gesture: the tint clears and no card is played.
- [ ] Drag a hand card that also has pinned action chips showing (click it first to pin, then drag it): the chips must not swallow the drop — the zone under the pointer is the one that receives the card.
- [ ] Click a hand card normally (no movement) after this change: the chips still pin and still work exactly as before.
- [ ] Play a card by dragging, then keep playing with chips and the keyboard for the rest of the turn: nothing about the earlier drag leaks into a later decision (no zone gets chosen for you unexpectedly).
- [ ] Keyboard only, with no mouse touched: the whole duel is still playable and no drag behaviour interferes.
- [ ] Rare case, if you can reach it: play a card whose zone the engine refuses (e.g. a summon that must go to a specific zone). The normal zone-selection prompt appears with its own highlighted zones and you pick one by hand — the mis-guess costs you nothing.

## T11 card-preview-panel

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
