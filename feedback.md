# Duel Field Implementation Feedbacks

1. The cards in the end must be centered horizontally on the horizontal axis. They should naturally be at the middle of the duel field.

2. When you hover a card and it zooms from the hand, make sure that the image can overflow, appear on top, and extend beyond the duel field or any other interface. Place the buttons just above the card itself when it is zoomed.

3. For the extra deck zone, do not show the last card on the stack; instead, show a face‑down card, just like the opponent’s extra deck. This is not an exception: your extra deck zone is still a private zone, only you can access it and look through it. All public zones that both players can see have the cards face‑up, including the last card on the stack. Private zones have a card face‑down, even yours. So update your extra deck to show the last card face‑down, not face‑up.

## Right Side Panel

1. Instead of using face down card placeholder, try to use real avatar palce holder instead

2. The life points should be inside a border. Look references to YGO game tor design. Also make it bigger center it horizontally on panel.

3. Add a line separation between the row with turn and phase + settings options and the avatar image. Goal is to make the

4. Make the avatar picture take whole Width of panel

5. Avatar picture must have fat border around them all around.

6. Make sure that Action prompt stay aligned with middle of duel field

## List Dialog

1. When i my searching for a card in my deck, i am not able to see the cards even tho i should. Cards have 3 state. It's PUBLIC (both player know about identity), its PRIVATE (only 1 player know), its HIDDEN (no players know identity). When searching my deck, all cards in my deck become PRIVATE to me the time to search. Shuffle makes the information about identity disappear.

2. When looking at opponent zones, the cards are inverted. Make sure that in list dialog, they are in the correct position. Title at the top and text at the bottom.

3. When hovering over cards that does not have anything to interact (no activation). Do not show any halo. Neutral cards do not have halo.

4. Remove text : "Select between 1 and 1 choices" at bottom right.

## Halo

Replace halo colors :
Green = all effects that can triggers or card that can be targeted.
Orange = selected
Red = Not valid target (when hovering or selecting a card in a zone to activate/target that also show invalid cards)
