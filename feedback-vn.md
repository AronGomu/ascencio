# Feeback - Visual Novel

## Menu

## General

4. All multiple choice should share the same component and be in the center of the screen, choices button quite big. Apply same for shopkeeper : buy, sell, leave shop.

5. Make button action that cancel or return to previous state red : exemple "leave shop" button

---

## Map

## Shop

1. Fetch the original images for each set.

2. Make the size of the html card for each set bigger. On HD size, i should see 4 cards per row and i should scroll down to see others
   Latest release show the last 4 in chronogical order.

3. Use the card image from the database. Must have the same appearance as the cards in the deckbuilder.

### Card List View

1. In the card list view for a set. On the first row with the back button and the title : add a sort by rarity button that toggles regrouping the cards by their rarity (rarity > alphabetical).
   3 state :
   Not toggled
   Click once => common to rarest
   Click once again => rarest to common
   click third time => disable grouping by rarities

2. Use the same card preview from duels and decks.

### Card Reveal

1. Do the same card reveal as hearthstone. All the cards are shown face down and you can hover over them and see the rarity through the halo fading in on hover.
   Clicking on the card activate flip animation on it.
   There is a checkbox you can check that automate the animation flips so you dont have to click on it. You just click open and everything is doing it for you automatically.
   If opening a specific amount of booster, you open 1 booster at a time and there is an open all option to open all remaining boosters.
   Clicking open all booster show a list similar to set card list view. Whenever opening all boosters, do not show duplicates, instead show a quantity number. Add the same grouping by rarities button. Basically use the same screen layout.
   After opening boosters 1 by 1, you have "see all" button that goes to that "see all opened card" same layout.

2. Make sure the cards in the card reveal are centered vertically and horizontally. Make the card bigger, the 9 cards should be on 1 row in computer screen that takes whole width with minimal margin and on 1 scrollable column on mobile size.

3. Add smooth zoom animation on cards to make them 2 times bigger on hover with orange halo fading in to show they are selected only on the screen of cards reveal. next to the zoomed card, add a floating window with the card effect.

4. Remove the button "See result" or "skip" if opening only 1 pack. Just have a back button.

5. Buying the booster add the cards to your collection the moment you spent the DP.

# NEW FEATURE - Your collection

In the deck builder main menu, you have an option to consult your collection. This open the same layout as looking through all your opened cards and the cards of a set but on your entire collection of cards.
This feature will evolate to contains proper filters and search options and the possibility to see all cards (even those no in your collection). A true database interface.
