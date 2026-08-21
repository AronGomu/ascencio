# Feeback - Duel Field

## Decision Dialog

## Right Side Panel

## List Dialog

## Left Side Panel

## Halo

In the duel screen :

1. The current text in the card preview section is justified to the end. Fix that. Give same gap as between card name and card stats and put it just after the cards stats.

2. When hovering a card, it says "card image unavailable" and shows the back of the card instead. Fix it.

3. When you hover a card with a possible activatation. Show the list of action button item 1 per row above the card. Each button take the full width of the zoomed card. Adjust text size accordingly with new size.

4. When clicking of a card in the hand. That freezes the card in zoomed position and the action menu list stays at the same place too. The card is shown as selected with orange halo border.
   Clicking outside cancel that selection and return the card in the original non-zoomed state.
   If you click on the selected card again, it returns to the original non‑zoomed state.
   However, if you click one of the action buttons in the action button menu, it returns the card to its original state and triggers the action.

5. Whenever you search a card, if you add it to your hand, it should always appear at the rightmost position in the hand.

6. Whenever you use the drag-and-drop option, if you take a spell card and move it to a spell zone, there are several possible actions: activate it or set it. If there is a choice, a confirmation menu should appear to select the correct action or cancel the drag-and-drop. For example, if you try to play a spell by dragging it from your hand to an available spell and trap zone, a menu will trigger to either activate the card, set the card in that specific zone, or cancel the action and return the card to your hand.

7. Do not break the text for the enter button into two rows; it should be only one row. Also, make the button bigger.

8. I found a bug when activating Maxi by dragging and dropping the card. The game offered to place it in the Spell and Trap Zone, which sent Maxi to the graveyard and seemed to activate its effects, but I received an OCG error response see : /home/aron/Downloads/ygo-duel-diagnostics-a562f5ad6794.json

9. Whenever I receive an error from the OCG core, a dialog should appear that allows me to download the report and the diagnostic. After downloading, there should be a button next to it that, when clicked, restores the last previous non‑bugged state so I can continue the duel.

10. There is a bug with the hand of my opponent. At the start of a duel, I see three of his cards at the center, but the leftmost and rightmost cards are justified left and right. Make sure that every single card is grouped together at the center, at the horizontal center.
