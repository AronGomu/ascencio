# Duel Field Implementation Feedbacks

0. In AGENT.md, add rule => "all html element must have data-cy that acts as variable name."

1. When mouse cursor hover "duel-field", it denies page scroll. Fix to always allow scroll.

2. remove "app-header"

3. remove "status-panel"

4. remove "lifecycle-panel"

5. Create header menubar :
   1. within add "Settings" button justified right.
   2. Settings button open menu dialog
   3. Menu dialog contains :
      1. Gray Neutral Settings Button -> On click, open Settings dialog
      2. Red Danger Surrender buttons

6. Remove : "Duel field" h2, "Field updates" paragraph, "Duel state updates" paragraph.

7. Update "duel-field-board" to take whole width.

8. "duel-hud" and "workspace-grid" must be hidden by default. Add to settings checkbox to show them. They are not checked by default.

9. Remove "selection-dock"

10. Move "End turn" button to bottom right of "Duel Field". Make it orange Warning colors.

11. About available actions for cards :
12. Only use 1 word for each : "Set X" => "Set", "Activate X" => "Activate"
13. Remove "inspect" and "close actions" options
14. Make them way smaller, fixed height & width, float above card
15. Make actions appear on hover of card

16. Show orange halo for activable cards any time you have priority, only those card have action appear on hover

17. Implement Drag and drop for activable cards in hands. When dragging, highlight in orange halo available space on field to play the card. Dropping into available space send activate/set action and selected zone at once for ocgcore.

18. At the top right of duel-field, add "prio-pill" indicating if you have priority or waiting for opponent action + "phase-pill" indicating current phase.:

- For prio-pill - Orange pill : "Waiting Opponent" OR Green pill "Choose Action".
  Format both like that : (prio-pill) - (phase pill)

15. Opponent card are in wrong direction. Make them vertical (like player cards), not horizontal.

16. Remove border and different background color for "p1:hand"

17. Add preview panel to show card image and card text. Must be same height and on same row than duel field. Top contain card image, Bottom contains scrollable car effect section.

18. When hovering or keeping click, show card preview and card text in dedicated panel
