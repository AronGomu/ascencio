# Manual test checklist

Human-only checks that automated tests cannot cover. One section per plan ticket; never edit another ticket's section.

## T6 field-action-bar

- [ ] Start a duel and reach a "select a card" prompt: a compact bar appears pinned to the bottom of the duel field, below the board, with the prompt title on it.
- [ ] The bar sits in its own strip under the board — it does not cover the player's hand, and no empty strip is left under the board once the bar disappears.
- [ ] A legal-action card at the bottom of the board is still clickable while the action bar is on screen (click a hand card whose action menu should open; the menu opens, nothing swallows the click).
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
- [ ] When no `End turn` choice is currently legal (e.g. mid-menu on a card action with no phase choice offered), the corner button is visibly disabled and unclickable, but still reads `End turn`.
- [ ] The field action bar no longer shows its own `End turn` / `End Battle Phase` button — that choice only ever appears in the corner now. If a prompt's only reason to show the bar was that choice, no bar appears at all.
- [ ] The corner button never sits on top of the board — a legal-action card in the board's bottom-right corner is still clickable with the corner button on screen.
- [ ] When the field action bar is also open, the corner button and the bar do not overlap each other at any window width, including a narrow phone-width window where the bar and button both need room in the bottom strip.
- [ ] Resize the window from a wide desktop down to a phone width: the corner button stays fully on screen and never overlaps the board at any size.
- [ ] Double-clicking the corner button quickly (or clicking again while a response is pending) only ends the phase once.
- [ ] Keyboard only: tab to the corner button, confirm it announces its current label (`End turn` or `End Battle Phase`) and its disabled state is announced when it's not usable.
