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
