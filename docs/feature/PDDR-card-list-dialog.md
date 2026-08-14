# PDDR: card-list-dialog

## Decision 1: Prototype scope

- CHOSEN: Card-list dialog only. HTML simulates selector, drag, scroll, hover, selection, actions, close.
- WHY: `feedback.md` requests dialog iteration before app integration.
- NOT CHOSEN: Full duel field or production Svelte changes; outside requested artifact scope.
- PARAMS: Standalone HTML; mocked actions; current-project visual tokens.
- DATE: 2026-08-13

## Decision 2: Search-result contents

> Duplicate-count representation below is superseded by Decisions 8 + 31. Retained scope decision: filtered legal/visible cards at full width.

- CHOSEN (historical): Show only legal matching cards, face-up, full card width. Put duplicate count on each card.
- WHY: Searcher must identify valid card without opening whole Deck or parsing overlapped copies.
- NOT CHOSEN: Full Deck face-down; overlapping duplicate cards; one tile per physical copy.
- PARAMS: Default scenario `Deck search`; 8 result tiles; quantity badge on; scenarios `Deck search`, `Graveyard browse`, `Extra Deck browse`.
- DATE: 2026-08-13

## Decision 3: Dialog layout

- CHOSEN: Large movable window, single horizontal card run, reserved zoom clearance, contained scrollbar.
- WHY: Hover zoom needs room above card while header stays clear. Full-width tiles need no base overlap.
- NOT CHOSEN: Small current window; wrapped grid; fan/stack overlap; zoom clipped by scroll viewport.
- PARAMS: Width 1080 px (720–1320); height 640 px (440–780); top clearance 72 px (40–120); card width 132 px (96–180); gap 24 px (8–48).
- DATE: 2026-08-13

## Decision 4: Card interaction

- CHOSEN: Hover/focus zooms card; click pins same zoom plus orange halo; second card click or outside click clears. Action click executes mock then clears.
- WHY: Matches requested persistent selection while keeping actions reachable.
- NOT CHOSEN: Hover-only action; click immediately executes; selection survives action completion.
- PARAMS: Zoom 1.32× (1.00–1.60); 120 ms ease-out; selected count 0 or 1; Escape clears selection before closing dialog.
- DATE: 2026-08-13

## Decision 5: Action menu placement

- CHOSEN: Default menu below card, raised above every dialog layer. Keep pointer bridge via card selected/hover/focus state.
- WHY: Menu cannot collide with header or get clipped. Buttons remain clickable.
- NOT CHOSEN: Header-overlapping menu; clipped overflow; permanent actions on every tile.
- PARAMS: Placement `below` default; `above` evaluation option; z-index 510 effective; 34 px action height.
- DATE: 2026-08-13

## Decision 6: Evaluation controls

- CHOSEN: Draggable, collapsible toolbar controlling every visual evaluation variable. Copy exports names, values, units, ranges, states.
- WHY: User can tune prototype without code edits.
- NOT CHOSEN: Hidden dev controls; fixed uninspectable constants.
- PARAMS: Dialog width/height; card width/gap; hover zoom; top clearance; result copies; scenario; action placement; quantity badge.
- DATE: 2026-08-13

## Decision 7: Mode split

- CHOSEN: Two contextual modes: `Target selection` and `Browse + activate`.
- WHY: Effect/cost resolution needs selection plus validation; zone browsing needs legal effect actions. Mixing both creates invalid card-action controls during resolution.
- NOT CHOSEN: One list mode showing selection and action controls together; scenario-only visual variants.
- PARAMS: `Target selection` default; max 1 selected; validation shown only in target mode. `Browse + activate`; legal effect action shown only in browse mode; no validation.
- DATE: 2026-08-13

## Decision 8: Duplicate representation

- CHOSEN: Render every physical card copy as full-width tile.
- WHY: User rejected quantity badges. Copies must remain directly inspectable.
- NOT CHOSEN: Quantity numbers; stacked or overlapped duplicates.
- PARAMS: 12 physical cards default (3–12); 0 px list edge padding; 8 px gap.
- DATE: 2026-08-13

## Decision 9: Zoom cleanup

- CHOSEN: Second click unselects and removes retained pointer focus; card unzooms after pointer leaves. Hide name while zoomed.
- WHY: Focus retention caused stale zoom after unselect. Name under enlarged art adds clutter.
- NOT CHOSEN: Persistent focus zoom after pointer unselect; name visible below zoomed card.
- PARAMS: Hover zoom 1.60×; 120 ms ease-out; name opacity 0 during hover, focus, or pinned selection.
- DATE: 2026-08-13

## Decision 10: Collapsed dialog

- CHOSEN: Header control collapses dialog to 58 px title bar. Expand restores prior size and contents.
- WHY: Player needs field visibility without dismissing current list context.
- NOT CHOSEN: Close-only flow; minimize to unrelated screen corner; translucent full dialog.
- PARAMS: Expanded 1320 × 600 px; collapsed height 58 px; position preserved.
- DATE: 2026-08-13

## Decision 11: Revised geometry defaults

- CHOSEN: Apply user-supplied max-width, max-zoom, tight-spacing values as new defaults.
- WHY: User identified these values for optimization.
- NOT CHOSEN: Initial 1080 × 640 px dialog, 132 px cards, 24 px gap, 1.32× zoom, 72 px clearance.
- PARAMS: Dialog 1320 × 600 px; card 144 px; gap 8 px; zoom 1.60×; top clearance 40 px; action below; dialog edge padding 0 px.
- DATE: 2026-08-13

## Decision 12: Minimal list edge margin

- CHOSEN: Restore one minimal card-gap-sized inset at both scroll limits.
- WHY: Cards should not touch dialog border, but large empty end bands waste width.
- NOT CHOSEN: 0 px contact; prior large centering padding.
- PARAMS: Edge margin 8 px default (4–24 px); card gap 8 px.
- DATE: 2026-08-13

## Decision 13: Browse action pointer bridge

- CHOSEN: Attach action menu directly to card-art edge with 2 px seam overlap.
- WHY: Pointer can travel from hover-zoomed card into action without crossing hover-breaking gap.
- NOT CHOSEN: 8 px menu margin; menu below card-name row; click-to-pin prerequisite.
- PARAMS: Visual gap 0 px; seam overlap 2 px; first/last menus align inward; default placement below.
- DATE: 2026-08-13

## Decision 14: Browse interaction revision

- CHOSEN: Browse mode has no card selection or pin state. Hover/focus exposes legal effects. Cancel and header `×` dismiss dialog.
- WHY: Zone browsing is optional inspection/action, not target resolution.
- NOT CHOSEN: Click-to-pin browse cards; validation button; collapse control.
- PARAMS: Collapse hidden; `×` visible at top right; red Cancel always visible; legal-effect cards only show action menu.
- DATE: 2026-08-13

## Decision 15: Target dialog exit rules

- CHOSEN: Target mode has collapse control at top right, no header `×`. Red Cancel appears only when prompt is cancelable. Validate requires one selected card.
- WHY: Mandatory target prompts cannot be dismissed without valid response. Cancelable prompts need explicit escape.
- NOT CHOSEN: Universal header exit; universal Cancel; browse collapse.
- PARAMS: `Selection cancelable` off default; target max 1 selected; collapsed height 58 px.
- DATE: 2026-08-13

## Decision 16: Stable collapse anchor

- CHOSEN: Freeze expanded dialog viewport coordinates before height collapse. Keep header and plus/minus control at same coordinates.
- WHY: Center-based transform otherwise shifts header when height changes.
- NOT CHOSEN: Recenter 58 px collapsed window; move plus to separate launcher.
- PARAMS: Header height 58 px; x/y delta across collapse 0 px.
- DATE: 2026-08-13

## Decision 17: Four dialog scenarios

- CHOSEN: `Zone browse` default, `Single target`, `Multiple targets`, `Mixed-zone targets`.
- WHY: Browse, exact-one resolution, batch selection, cross-zone effects need distinct controls and metadata.
- NOT CHOSEN: One overloaded target mode; quantity-only scenario switch.
- PARAMS: Required selections 0, 1, 3, 2 respectively. Mixed zones: Extra Deck, GY, Banished, Deck.
- DATE: 2026-08-13

## Decision 18: Stack and alphabetical order

- CHOSEN: Default source stack order with top card first. Footer checkbox toggles alphabetical order and restores exact source order when unchecked.
- WHY: Zone inspection must preserve gameplay order; alpha sort helps find known cards without mutating source order.
- NOT CHOSEN: Alphabetical default; irreversible client-side reorder; grouped duplicates.
- PARAMS: `Alphabetical` off default; locale name sort; physical duplicate order stable; selected cards preserved across sort.
- DATE: 2026-08-13

## Decision 19: Conditional filter notice

- CHOSEN: Header notice appears directly after shown-card count only when list excludes nonmatching zone cards.
- WHY: Full-zone browse needs no redundant legal-match message. Filtered target lists need scope disclosure.
- NOT CHOSEN: Permanent body criteria row; permanent `legal matches only` text.
- PARAMS: Browse notice hidden; target notice `Filtered: legal targets only`; mixed notice names 4-zone scope.
- DATE: 2026-08-13

## Decision 20: Selection count and validation

- CHOSEN: Footer uses `X / Y selected`. Validation button uses success green and enables only at exact target count.
- WHY: Exact progress and completion state must be visible for single and multi-select prompts.
- NOT CHOSEN: `X selected`; prose-only count; enabled incomplete validation.
- PARAMS: Success color `#7ee2a8`; exact counts 1, 3, or 2 by scenario.
- DATE: 2026-08-13

## Decision 21: Immediate unselect suppression

- CHOSEN: Unselect adds temporary hover suppression until pointer leaves card.
- WHY: Pointer remains geometrically over card after click; plain `:hover` would keep stale zoom.
- NOT CHOSEN: Require pointer leave before unzoom; retain focus zoom; move pointer programmatically.
- PARAMS: Immediate transform reset; suppression removed on `pointerleave`.
- DATE: 2026-08-13

## Decision 22: Plus-only collapsed state

- CHOSEN: Collapse shrinks window to 58 × 58 px and hides title, count, filter notice, body, footer. Plus stays at exact prior minus coordinates.
- WHY: Collapsed prompt should expose field and retain one obvious restore control.
- NOT CHOSEN: Empty full-width header; title/count retained; relocated launcher.
- PARAMS: One visible child; 44 × 44 px plus; viewport x/y delta 0 px.
- DATE: 2026-08-13

## Decision 23: Mixed-zone labels

- CHOSEN: Put full zone badge directly above each card. Use `Extra Deck`, `Graveyard`, `Banished`, `Deck` labels.
- WHY: Badge must identify source without covering card art. Full names remove ambiguous abbreviations.
- NOT CHOSEN: Badge over card image; `GY`/`BAN` abbreviations; footer legend.
- PARAMS: 5 px visual gap above card; one badge per mixed-zone card.
- DATE: 2026-08-13

## Decision 24: Browse text reduction

- CHOSEN: Browse title contains zone name only. Hide bottom-left order text; keep alphabetical checkbox.
- WHY: Zone context and checkbox communicate enough without redundant prose.
- NOT CHOSEN: `{zone} contents`; `Stack order · top card first`; `Alphabetical order` footer status.
- PARAMS: Default title `Graveyard`; alphabetical checkbox stays off by default.
- DATE: 2026-08-13

## Decision 25: Explicit mixed filter scope

- CHOSEN: Mixed-zone filter notice names all source zones.
- WHY: Player must know which hidden or off-field locations contributed legal targets.
- NOT CHOSEN: Generic `across 4 zones` count.
- PARAMS: `Filtered: legal targets from Extra Deck, Graveyard, Banished, and Deck`.
- DATE: 2026-08-13

## Decision 26: Hard selection maximum

- CHOSEN: Disable every unselected card when exact maximum is reached. Keep selected cards enabled only for explicit second-click unselection.
- WHY: Selection count must never exceed effect constraint. Disabled controls block pointer and keyboard activation.
- NOT CHOSEN: Accept extra cards then trim; allow extra selection with disabled validation; silently replace oldest selection.
- PARAMS: Maximum from scenario requirement; mixed max 2; multi max 3; `aria-disabled` plus native `disabled`.
- DATE: 2026-08-13

## Decision 27: Unavailable-card state

- CHOSEN: Red halo marks cards unavailable due intrinsic effect legality or temporary max-count lock. Red persists through hover. Pointer leave removes zoom.
- WHY: Green means selectable; red must clearly mean blocked. Hover must not imply legality or pin focus.
- NOT CHOSEN: Green halo after max; orange hover overriding blocked state; checkmark on unavailable card.
- PARAMS: Red `#ff455d`; 3 px halo; no checkmark; disabled button opacity 1.
- DATE: 2026-08-13

## Decision 28: Selection persistence

- CHOSEN: Outside click and Escape preserve selected cards. Only clicking selected card again unselects before submission.
- WHY: Accidental field/dialog clicks must not destroy multi-card selection progress.
- NOT CHOSEN: Outside-click clear; Escape clear; single global clear action.
- PARAMS: Second click unselects one card; immediate hover suppression until pointer leaves.
- DATE: 2026-08-13

## Decision 29: Validation safety invariant

- CHOSEN: Enable validation only when selected count exactly equals required count and every selected id still maps to effect-selectable rendered card.
- WHY: Defensive state drift must fail closed, including impossible over-maximum state.
- NOT CHOSEN: Enable on `count >= required`; trust UI click guard alone.
- PARAMS: `count === required`; explicit `count > required` rejection; all selected ids revalidated.
- DATE: 2026-08-13

## Decision 30: Short-row alignment

- CHOSEN: Center cards horizontally when row width fits dialog without horizontal overflow.
- WHY: Sparse card lists should use available space symmetrically.
- NOT CHOSEN: Left-align short rows; add fake spacer cards.
- PARAMS: Flex `justify-content: center`; overflow rows retain 8 px scroll-edge margins.
- DATE: 2026-08-13

## Decision 31: Approved parameter freeze

- CHOSEN: Freeze user-approved Zone Browse state and listed parameter values.
- WHY: User sent exact `prototype approved` phrase after fixing every evaluation variable.
- NOT CHOSEN: Prior 12-card default; unresolved or approximate values.
- PARAMS: Dialog 1320 × 600 px; card width 144 px; gap 8 px; edge margin 8 px; hover zoom 1.60×; top clearance 40 px; 6 physical cards; Zone Browse; actions below; alphabetical off; selection cancelable no; expanded.
- DATE: 2026-08-13
