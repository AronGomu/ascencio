# Duel Field Implementation Feedbacks

1. Preview: the card image preview does not work when I hover my cards or the opponent's cards. The image and the text do not updateTo be precise, it works only when I'm not chaining a response, but I still cannot see the cards. When I hover over the cards on my opponent's board, the monsters on my opponent's board do not work; it works for their graveyard. Also, when I hover over my face-down cards—technically face-down cards that are known information to me, such as targeted monsters special summoned from the graveyard by my opponent—I know which monster was special summoned face-down. So when I hover, my cursor should show the correct identity of the card in the preview. Also, when a card is face down, no need to add the text "hidden card".

2. For all the zones on your side of the field, remove your keyword and remove the opponent keyword. Instead, just shorten everything. Main Monster Zone becomes Monster Zone, and Spell and Trap becomes Spell/Trap Zone. Your field becomes Field Zone, and opponent field becomes Field Zone as well.

3. The cards in the opponent’s banished zone, graveyard, deck, and extra deck should be vertically inverted. They should point in the same direction as the monster on the field and the card in the player’s hand, so from the player’s standpoint they appear inverted.

4. In the Windows dialog that allows you to view a list of cards in the deck, graveyard, or banished zone, the close button should become an X icon, colored red (danger color), and be justified to the right. It stays on the same roof. Try to scroll with my mouse on the preview. If it’s scrollable horizontally, it should allow me to scroll when my mouse cursor is hovering over the list of cards of the scrollbar. And when I click outside of the dialog window, it should close as if I clicked the close button.

5. The action menu that appears when you hover a card you can activate or play should be at the forefront in the HTML, because the hand should never be hidden by other interface or game objects, and the menu above it should never be hidden by anything.

6. Remove the dual field zone from your hand; just show the cards from your hand directly. I like the open hand. I should not be able to visualize here the zone dedicated for my hand.

7. I have more than 10 cards in my hand. Instead of adding more cards, limit the zone size to contain only 10 cards and add left and right arrows to navigate through the cards like a list. Also, add a scroll bar like the one used for the list menu dialog for decks, graveyard, and banished cards.

8. Next to the life points, add the name or role of the player. So you say you are here for this demo, indicating whether it’s you or your opponent.

9. Add padding or margin below the dual field and the card preview. Design the entire dual‑field view with the preview and the header to exactly fit 100 % of the viewport height and width. By default, I should not have a scrollbar at the top.

10. Don't ask to confirm the selection once you click on the target of the attack; it should be done.

11. When the dialogue—your decision battle command—appears asking whether you go to Main Phase 2 or end the Battle Phase, don’t show the dialogue. Instead, stay in the current state, and the user will manually click the phase himself on the existing phase buttons of the dual field.

12. A Burning Abyss deck from Duelist Alliance, a Necroz deck at its first extension release, a Shaddoll deck of Duelist Alliance, and a Spellbook deck played around the Duelist Alliance metagame. Import a decklist for each, and before starting a duel add a selection menu where I can select my deck and the opponent’s deck.

13. Bande de Duelfield. The width of the hand zone should be the same size, starting from your first spell and trap zone and ending at your last spell and trap zone, the fifth one. It should match the width of the five monster, spell, and trap zones.

14. Move the extra tech zone to be just under the field zone. For both players.

15. Reduce the width of the hand zone, attach the zone that contains the graveyard, banished, and deck zones to the Main Monster 5 zone and the Spell & Trap 5 zone, and give them the same margin as between two Main Monster zones or two Spell & Trap zones.

16. For all field zones, add a bit of margin vertically and reduce the margin horizontally.

17. Hover over a card in your hand. When you hover over any card on your hand or anywhere on the field, add an animation and zoom to make the card bigger, clearly indicating the currently hovered card, and ensure that the halo follows the card’s size.

18. I should be able to take a card from my hand, and when I drag it, the card must float above everything on the field and follow the mouse cursor to show visually that we are dragging the card around and dropping it anywhere. When I hover a valid zone with the draggable card, the zone should change its halo with a fade animation to green, indicating that we are selecting that zone to play the card.

19. Also, when you drag the card, add some animation effects to show a bit of inertia, a bit of 3D animation. But first, before integrating that into the application, tell me how feasible it is to do it, and I want a grill‑me session about it. Because I don't want to import an expensive and heavy animation library just to do that.

20. On the dual field, there is a lot of remaining empty space on the left. If the space is not used for anything because there is not enough height to fit everything, just give the space to the preview panel.

21. There's not enough space to show the preview panel on the same row as the dual field. Put it at the bottom instead of at the top, and rearrange the layout so that the card preview is on the left, fits within the borders of the preview panel, and the text is on the right.

22. The battle phase badge for the phase should be moved to the left side of the shared extra monster zone.

23. When a duel launches, detect if there are any Link monsters that could go to the shared Extra Monster Zone. If none of the players have any linked monster, remove those zones from the duel field and use the free space to rapprocher the phase badges, so that it’s continuous. You have Draw, Standby, Main 1, Battle, and directly Main 2, End. Everything is centered vertically and horizontally.

24. Remove the end turn badge and instead just replace it with the yellow end turn button, and move the yellow end turn button to the place of the current end turn badge. Also reduce the size of that enter button.

25. I want to change the color of the halos, and this takes precedence over my previous claims. All valid targets—either a card you can activate from your hand or a valid target for a spell or ability—should have a green halo, and the orange halo should appear only when a target is already confirmed and selected and you need to confirm an action. For example, when you tribute‑summon something, the target is first green; then, when you click it and need to confirm the action, the target turns orange to indicate it is selected.

26. At the same position as the opponent's hand, there is a badge that shows the current action or phase. Remove it.

27. The height of the preview of the card for the graveyard, banished, or deck dialog list zone is way too big. Ensure the maximum height is 50 % of the available viewport for the preview image.

28. When you play a card that can target a specific list of cards, you reuse the same dialog as for the graveyard, banished, and extra deck list of cards, and when you resolve the card, only show the list of available cards. For example, Monster Reborn has a specific list of targets it can affect. When you activate the card and it’s resolving, use the same components to show the list of available cards as the graveyard, deck, etc. List only the targetable cards to apply the effect. Under each card, indicate the zone with a short name: GY for graveyard, Deck for the deck, BAN for banished, and Extra for the extra deck. extrapolate for missings

29. When you resolve a card that can target a specific card from a graveyard or other zones besides the field itself, you show the card as a list. All the cards in the list should have a green halo, and when you hover over a card, the halo should change to orange. If you have only one card, click on it; a dialog will appear to confirm the selection, which you can validate or cancel. If you have multiple cards, clicking a card updates its halo to orange to indicate selection. A counter below shows the number of cards selected and the total number required, and a button confirms the selection. If a specific number of cards is required and the count does not match, the button remains disabled. Otherwise, if any number of cards may be selected, the button stays enabled as long as the effect’s validation condition is met. Also, currently I cannot confirm the selection when I play Monster Hunter Bound, for example, so make sure to fix that for the UI. I cannot execute the action in the UI as a human.

30. Move the confirm selection section to be dialog-like and pop directly onto the dual field. Make it a floating window that can be dragged and moved, and save its last position so that it reappears at the same spot. Ensure the window cannot overflow the dual field.
