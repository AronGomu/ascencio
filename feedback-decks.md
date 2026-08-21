# Feeback - Decks

## General

## Decks Menu

1. "deck-library-search-field", "", "" and "" should all be on the same first row.

2. The "default" tag should be in on same line of deck name but justified right instead of taking an entire new row.

3. On the same row, completly justified right in the corner, add a clickable star icon. If clicked, add decks to favourite. By default, order decks in the list favourite first (by date) then others by date. Default is always first in the list.

4. Rename, duplicate, export, set default, delete directly into deck/{id} page on the top row

## Deck Builder

1. There is still margins to exploit on full hd screens

2. No scroll bar should appear on "shell-region-decks" before going to responsive mobile size.

3. Left clicking on a card in the deck should move it to the sideboard. Same from sideboard to deck.

3.1 Left clicking a card in the extra deck should remove it from that deck.

4. Left clicking on a card in the "deck-catalog" should add the card to the main deck or extra deck. Move to sideboard only if main deck is full.

Note : keep right clicking

5. The sidebar to collapse or uncollaps the main, extra or side should take whole width and be clickable to do the effect on the whole width.

6. Reduce width of card viewer in not mobile view. Make is fit card image preview width with tight margins (also impact duel)

7. Card image shown in card rectangle ni deck and results only show top left corner of image. Make sure either :
   1. use and resize the actual image
   2. Fit the image entirely within

8. Put all 15 slots of extra deck and sideboard on 1 row. Resize to fit.

9. Bug to fix : i cannot drag and drop valid card to sideboard

10. Add a checkbox at the corner top right of "deck-catalog" with label "to sideboard". If checked, clicked-on card go to the sideboard instead of the main deck first.

11. Make sure to auto save on each update of the deck, extra and side (card position movements included)

12. Make a custom scroll bar for results in catalag to blend better with the dark background. Still visible though.

13. Load the cards lazily in the search result of catalog and do a "infinite scroll" style to avoid loading all cards at once in the result panel.

14. Wire the entire card database. Add performance test to make sure that all loading and searching is as fast as possible.
