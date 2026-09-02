# Duel Field

1. A selected card in the hand image cannot overflow when selected. Make it like when hovered. It should be over the actual zone of the field.
2. If a zone is empty (extra/graveyard/banished zone at the start of the game). Do not show card cover or purple zone. Just show empty zone. Keep name and card number.
3. Repalce the card back placeholder by actual YGO card back. Fetch asset online if needed.
4. Card back placeholder on the field for Deck, extra, graveyard and banish do not have the same width as width of card in hand or in play. Identify if its because reduced width zone (zone where cards cannot be in defense position / horizontal). In any case, it should be same width and height as card image in hand and field.
5. Reduce width of the right pane (life points, player avatar, etc...)
6. Move phases bar to be above the duel field, horizontally. Opponent at the right, you at the left, splitted by the vertical middle of duel field.
7. with freed-up width space, make duel field bigger to fill the given space
8. Card Fanning is not correct. Card are rotated but are all on the same y position and does not create a proper arc. Fix it for your hand and opponent hand
9. Normal Summoned monster on my side of the field keep orange halo. Once summon resolve, card should lose selected status and lose all halo.
10. Probably because card on the field keep selection, this bug action selection of card in my hand. Monster that have an activated ability in my hand does not have the action button appear. For spell, action button for setting appear but not activating the card. Drag and dropping works. Passing the turn solve the issue. After more investigation, it seems that activing ability of monsters in the hand is just not proposed in action buttons.
11. After sending scarm to the graveyard, no action proposed me to activate its effect even though it was valid activation. Must be global bug for all triggered abilities in the graveyard.
12. When activating an ability that ask you to detach a material, always show dialog for card selection with all valid target to detach.
13. Move the full control checkbox to the bottom left of the duel field.
14. Add in the settings of a duel, a button that downloads the log of everything that happened in the game. This is aimed to help solve for bugs.

# Right Pane

# Deck Selection Screen
