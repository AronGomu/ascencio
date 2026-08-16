# Feeback - Visual Novel

## General

1. Update all interfaces that come from the menu to have a return button that goes back to the menu instead of having to use the URL.

2. When I click on Hide UI, instead of having only a new button that appears at the bottom right, Show UI, update the button Hide UI to become Show UI, and if I click on it, it shows the UI again. Basically, make it a toggle button.

3. Rename Pause to a gear icon.

4. Remove the Open Pose Menu button.

5. Move the Save, Load, Settings buttons into the menu itself.

6. Remove the experimental from auto and skip.

7. At the top of the screen, add a DP currency with a starting number of 1000.

8. Next to the DP currency, add a shop icon, and whenever you click on it, it directly goes to the shop when it’s available. For now, ignore the restrictions, but in the future there will be restrictions on when you can access the shop and when you cannot.

9. Next to the shop icon, add a deck icon—a deck of cards. Whenever you click on it, it opens the deck builder interface, the deck builder application. Within the deck builder interface, you select your current deck, select your default deck, and manage everything deck-related.

## Map

1. Remove the open pose menu button and replace it with the gear icon button; it should be placed at the same location as the dialog window.

2. For the test, add the shop location on the map. When I click on the shop location, it will redirect me to the shop interface.

## Shop

The shop interface does not yet exist, so here is a list of criteria to help guide the reseasrch for a first design and first prototype.

1. There should be a shopkeeper, so in the shop interface there will be visual novel-like steps whenever you dialogue with the shopkeeper.

2. There will be many extensions you can choose from, because I plan to include the entire list of sets released in real life Yu‑Gi‑Oh extensions. So there should be a first interface that can handle the choice between hundreds of extensions.

3. On the interface to choose an extension to buy from, there should be a row with the latest extensions that have been unlocked.

4. When you click on an extension, a menu appears with options to buy one pack, ten packs, or a specific amount, and to view the list of cards for the extension. Clicking on the list opens a window with a back button to return to the shop. In that window you can scroll through all the cards displayed in a grid with a preview panel on the left. When the mouse pointer hovers over a card, you can zoom in to show the card in detail.

5. When you show cards in the shop, each card has a different halo based on the rarity of the card. Reuse the rarity of Yu‑Gi‑Oh and infer a halo color for each, and in any menu of the shop, whenever you show a card, assign its matching halo.

6. At the top of the shop interface, you should see the number of DP points—the currency in the game—and the number of booster packs you have. When you click on the booster packs, a dialog opens with the entire list of boosters. You have two options.

First, you can select any number of boosters in the grid list. After selecting, a button appears to open them, and next to it is another button, **Open All**, which will open all the boosters. If you click the **Open** button, an animation plays for opening the packs and each card.

Second, if you click **Open All**, a slight animation plays, but all the cards are revealed at once, and you are taken to a new screen where you see the list of all the cards you opened.

7. For the shop, there is also the option to sell cards. Whenever you open, you can sell any cards to the shopkeeper, and it will buy them at a fixed amount for each card. The starting number is 10 for a common, and then you can infer the number of DP for all rarities.

8. When you enter the shop, it first shows a menu where you can interact with the shopkeeper NPC. The first option is “Buy Cards,” and clicking it opens the specific shop interface to purchase cards.
