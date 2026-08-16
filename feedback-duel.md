# Feeback - Duel Field

1. The cards in the end must be centered horizontally on the horizontal axis. They should naturally be at the middle of the duel field.

2. When you hover a card and it zooms from the hand, make sure that the image can overflow, appear on top, and extend beyond the duel field or any other interface. Place the buttons just above the card itself when it is zoomed.

3. For the extra deck zone, do not show the last card on the stack; instead, show a face‑down card, just like the opponent’s extra deck. This is not an exception: your extra deck zone is still a private zone, only you can access it and look through it. All public zones that both players can see have the cards face‑up, including the last card on the stack. Private zones have a card face‑down, even yours. So update your extra deck to show the last card face‑down like the Deck, not face‑up.

4. At the bottom right of the duel field, there is a checkbox with the small text “Full Control.” When it is checked, any time you play a spell or activate an ability, the game will ask you to respond to anything it can. Basically, every input from the OCG core that requires a decision will pop up a dialog to confirm the action. If it is not checked, activating an ability will, by default, not ask the player to chain a response; the decision is assumed to be to pass and let the effect resolve. Apply this only to your own effects. Also, bind the hotkey Control so that whenever you hold the Control key, it automatically checks the checkbox and enables the full control. If the full control is already enabled, nothing happens. When the player releases the full control key, it automatically unchecks the full control toggle, unless it was already manually checked by the player.

5. If the mouse pointer is over a face-down card that is not revealed to the player or known information, do not zoom that card.

6. If a card is face down but is known information to the player, keep it. Make sure that it has the name at the bottom.

7. After activating the ground spellbook tower, the dual field became unavailable, and now I have a decision dialog to perform all actions. It seems the game UI crashed after activating a field spell. Find the reason for that and create a ticket to fix it.

8. After a few actions in each duel I try to play, the connection is interrupted and a technical failure stops the duel. This is when I launch the dueler through the visual novel story menu.

```web console
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
[object Object]
VM7:5 [object Object]
error @ VM7:5
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'initialize', eventTypes: Array(1)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'startDuel', eventTypes: Array(11)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(3)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(4)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(2)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(3)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(4)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(2)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(3)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(4)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(2)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(8)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(7)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(2)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(3)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(6)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(5)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(4)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(2)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(5)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(3)}
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(6)}
worker-log.ts:5 {event: 'duel.worker.command.failed', commandType: 'respond', code: 'unsupported_message', runtimeId: 'ef74482b-7021-4aab-afea-d30700c753ce', traceMetadata: {…}, …}
error @ :4300/src/battle/worker/diagnostics/worker-log.ts:5
error @ :4300/src/battle/worker/duel.worker-browser.ts?worker_file&type=module:12
(anonymous) @ :4300/src/battle/worker/diagnostics/worker-log.ts:10
(anonymous) @ :4300/src/battle/worker/diagnostics/worker-log.ts:10
(anonymous) @ :4300/src/battle/worker/duel.worker.ts:48
#reportFailure @ :4300/src/battle/worker/DuelWorkerRuntime.ts:346
#handleCommand @ :4300/src/battle/worker/DuelWorkerRuntime.ts:145
(anonymous) @ :4300/src/battle/worker/DuelWorkerRuntime.ts:70
Promise.then
handle @ :4300/src/battle/worker/DuelWorkerRuntime.ts:66
handler @ :4300/src/battle/worker/duel.worker.ts:47
Worker.postMessage
(anonymous) @ DuelWorkerClient.ts:437
(anonymous) @ DuelWorkerClient.ts:221
(anonymous) @ duel-store.ts:386
(anonymous) @ duel-store.ts:545
dispatch @ FieldActionBar.svelte:35
click_4 @ FieldActionBar.svelte:171
handle_event_propagation @ events-B1HfWqIJ.js?v=8959a3ef:153
worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'respond', eventTypes: Array(1)}
:4300/src/battle/worker/diagnostics/worker-log.ts:3 {event: 'duel.worker.detached', ownedHandler: true}
:4300/src/battle/worker/diagnostics/worker-log.ts:3 {event: 'duel.worker.command.completed', commandType: 'dispose'}
```

## Decision Dialog

1. Remove the Inspect option.

## Right Side Panel

1. Instead of using face down card placeholder, try to use real avatar place holder instead

2. The life points should be inside a border. Look references to YGO game for design aesthetics. Also make it bigger center it horizontally on panel.

3. At the top of the panel, add a line separation between the row with turn and phase + settings options and the avatar image. Make it distinct, like a header.

4. Make the avatar picture take whole Width of panel

5. Avatar picture must have fat border around them all around.

6. Make sure that Action prompt stay aligned with middle of duel field

## List Dialog

1. When i my searching for a card in my deck, i am not able to see the cards even tho i should.
   Cards can have 3 state.
   It's PUBLIC (both player know about identity).
   Its PRIVATE (only 1 player know).
   Its HIDDEN (no players know identity).
   When searching my deck, all cards in my deck become PRIVATE FROM HIDDEN to me the time to search.
   Shuffle makes the information about identity disappear.

2. When looking at opponent zones, the cards are inverted. Make sure that in list dialog, they are in the correct position. Title at the top and text at the bottom.

3. When hovering over cards that does not have anything to interact (no activation). Do not show any halo. Neutral cards do not have halo.

4. Remove text : "Select between 1 and 1 choices" at bottom right.

5. When the list dialog is collapsed, clicking on the zone targeted by the effect for searching or targeting a card— the activity halo— does not remove the list dialog. While resolving the effect you can only collapse. Clicking on the zone toggles the collapsed state of the list dialog: it either collapses into a single button or expands to its normal state.

## Left Side Panel

1. When hovering a hidden card, keep the previous image shown as the preview. Only update the card preview when the mouse pointer is over a visible card with information.

## Halo

Replace halo colors :
Green = all effects that can triggers or card that can be targeted.
Orange = selected
Red = Not valid target (when hovering or selecting a card in a zone to activate/target that also show invalid cards)
