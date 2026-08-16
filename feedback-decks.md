# Feeback - Decks

## General

1. Update the pre-configured starting deck for the duel application and insert it as default, as decks are already saved in the deck storage. And also update the dual starting menu to auto-select a default deck. So basically, in the deck interface you can assign a default deck, and by default it assigns that. Then you have a select picker with a filter to select other decks you created and stored as decks. For the opponent is auto-assigned the Shadow deck for now.

2.

## Decks Menu

1. Replace "import YDK" with simply "Import Deck".

2. Remove : "Local decks", "Deck Library", "Visual Novel chooses a deck ID. This module stores and resolves decks."

3. Remove "deck-library-status-{id}" row. Instead, replace it with a halo-type highlight. It's green for a valid decklist, orange for a warning decklist, and when you hover the card, a tooltip shows the deck warnings; red is for an invalid decklist.

## Deck Builder

1. The card preview should be at the left and the card search should be at the right. Invert the position of those two panels.

2. Make sure the preview panel is exactly the same feature used by the dual simulator. It should be shared.

3. Bind Control + Z to the undo action. It should do the same thing as clicking on Undo.

4. Expand the width and height of the different sections to use almost the entire viewport for the width and the height, just leave a very minimal margin.

5. Remove the import and export button at the top right to make them exclusive to the previous window in the deck selector.

6. Make the text input for the deck name way smaller.

7. In the main panel, make the main deck, extra deck, and side deck sections collapsible, and make the extra deck and side deck sections take full width within the panel, not placed side by side. They should be one above the other, with the extra deck first, then the side deck. Also, by default, the side deck is collapsed.

8. Remove from main panel : "Deck workspace" and "Build deck" rows. Same for "Pinned card details" and "Card catalog" and "Find cards".

9. Wire the real card database and replace the placeholder for the preview and the card in the search and the deck with the real cards. Same as the duo simulator.

10. Whenever the maximum number of copies is already present in the deck, show the card with a red highlight instead of green to indicate that you cannot add more.

11. When the mouse pointer hovers over a card, the preview should update. If you click on a card and select it, leaving the card area returns the preview to the currently selected card.

12. When you drag and drop a card from the main deck, extra deck, or side deck outside of a valid zone for the deck, treat this action as removing the card from the deck.

13. Remove the “remove picked card” button and remove the “drop picked card” in the main deck, side deck, or extra deck whenever you drag and drop a card. Only use the highlights of the actual zones to signal to the user that it’s droppable.

14. If I right‑click on an already selected card from either the main deck, side deck, or extra deck, it will remove the card from the deck. If I do the same in the card catalog, it will add the card to the deck—first to the main deck, then, if there is not enough space, to the side deck or the extra deck.

15. Do not auto-sort the card. Instead, in the main panel for the deck workspace, add a button to sort by alphabetical order or sort by type of card. It will put monsters first, spells second, and traps third, then sort alphabetically. The user can take a card and drag and drop it onto another card or an empty slot on the deck workspace; it will either swap places with the selected card or move to the empty slot.

16. When you try to drop a card into an invalid zone, the zone should highlight red to show that it's not possible.

17. When you go above 40 cards, you should only add a new row with the new slots up to 50. If you go over 50, it adds another new row. The 40 out of 40 changes to 40 out of 40‑60 : "X/40-60".

18. At the top, remove the number, the cards for main and the number of cards in the main, extra and the number of cards in the extra, and side and the number of cards in the extra. Also remove the deck status. And the autosave.

19. Add two new buttons to the top: a Load button to load a deck from the saved decks, and a dialog that opens with two tabs. The first tab lists your decks, and the second tab contains the list of autosaves. The autosave list keeps in memory the last hundred actions you took to update the deck—adding or removing a card, or moving a card from the main deck to the side deck, etc. Do not record the position of the card within a section, main deck, side deck, or extra deck. And for each entry, put the timestamp and then the deck name inputted at the time of the edit.

20. Bind Ctrl+Y to redo an action. It should do the same thing as the redo button.
