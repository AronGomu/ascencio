# Prototype Spec: Card List Dialog

Status: **Approved**  
Approval phrase: `prototype approved`  
Approval date: 2026-08-13

References:

- Working prototype: `ai-artifacts/PROTOTYPE_card-list-dialog.html`
- Fixed prototype: `docs/feature/PROTOTYPE_card-list-dialog.html`
- Decision log: `docs/feature/PDDR-card-list-dialog.md`
- Product component: `src/app/components/duel-field/ZoneListDialog.svelte`
- Card tile: `src/app/components/duel-field/ZoneListEntryTile.svelte`
- Window shell: `src/app/components/duel-field/FloatingFieldWindow.svelte`
- Action controls: `src/app/components/duel-field/CardActionChips.svelte`
- Product styles: `src/styles/app.css`

## 1. Scope

Implement card-list dialog used for:

1. Browsing one public/legal zone and activating available card effects.
2. Selecting exactly one legal target.
3. Selecting multiple legal targets up to exact required count.
4. Selecting legal targets combined from Extra Deck, Graveyard, Banished, and Deck.

Included:

- Full-width, nonoverlapping physical card copies.
- Source stack order plus optional alphabetical display order.
- Hover zoom, legal/unavailable/selected halos, action menus.
- Exact-count validation.
- Conditional Cancel, close, and collapse controls.
- Horizontal overflow and short-row centering.
- Mixed-zone source labels.

Out of scope:

- Duel legality calculation.
- Engine response encoding.
- Real card-effect execution.
- Card-preview panel redesign.
- Duel-field or app-chrome redesign.
- Backend, Worker, or WASM changes except data already required to describe legal choices.

## 2. Target tech mapping

| Prototype concern | Production target |
| --- | --- |
| Dialog composition and modes | `ZoneListDialog.svelte` |
| Individual card tile | `ZoneListEntryTile.svelte` |
| Floating position and active layer | `FloatingFieldWindow.svelte` |
| Browse action buttons | `CardActionChips.svelte` |
| Legal target data | `OffFieldTargetEntry`, `InteractionChoice` |
| Browse stack data/order | `ZoneListEntry[]`, `BoardStackView` |
| Image loading/fallback | `CardImageLibrary.lease`, `cardBackUrl`, `placeholderUrl` |
| Styling and layers | `src/styles/app.css` |
| Selection state | `DuelField.svelte` interaction session and `selectedChoiceIds` |
| Validation | `validatePromptSelection` and prompt min/max contract |
| Effect execution | Existing `onchoose` / `ontargetchoice` callbacks |

Implementation remains Svelte DOM. Main thread must not infer legality. Worker-projected choices determine:

- Cards included in filtered lists.
- Whether each rendered card is selectable.
- Whether each browse card exposes actions.
- Required minimum/maximum count.
- Whether prompt can be canceled.

All new Svelte-rendered elements require unique `data-cy` values per project HTML-element contract.

### 2.1 Production compatibility decisions

ADR-021 resolves current engine-facing cases outside the 4 prototype scenarios without changing frozen visual values:

- Field-local `FloatingFieldWindow` boundary/clamp wins over prototype viewport positioning; 1320×600 is cap when boundary permits.
- Variable min/max off-field card-selection prompts use redesigned dialog; existing validator controls valid range.
- Mixed-source notices/badges support Hand, then Extra Deck, Graveyard, Banished, Deck in fixed order with full names.
- One physical tile renders per card address. Multiple projected `ChoiceId`s open keyboard-reachable choice menu; every ID stays answerable.
- Sum/order/counter prompt families remain on existing surfaces.

## 3. Screens, components, hierarchy

```text
CardListDialog (nonmodal field window)
├─ Header — 58 px
│  ├─ Zone/effect title
│  ├─ Shown-card count badge
│  ├─ Conditional filter notice
│  └─ Mode control
│     ├─ Browse: close ×
│     └─ Target: collapse − / expand +
├─ Card viewport — remaining height
│  └─ Horizontal scroller
│     └─ One-row card list
│        └─ Card tile × N
│           ├─ Full card image
│           ├─ Selected checkmark when selected
│           ├─ Mixed-zone badge above card when applicable
│           ├─ Card name, hidden while zoomed
│           └─ Browse action menu when legal
└─ Footer — 64 px
   ├─ Target count: X / Y selected
   ├─ Alphabetical checkbox
   ├─ Conditional Validate selection
   └─ Conditional red Cancel
```

Fixed prototype freezes approved **Zone Browse** state. Working prototype retains evaluator controls for all four scenarios.

## 4. Exact layout and visual tokens

### 4.1 Approved parameters

| Parameter | Approved value | Evaluation range/state |
| --- | ---: | --- |
| Dialog width | 1320 px | 720–1320 px |
| Dialog height | 600 px | 440–780 px |
| Card width | 144 px | 96–180 px |
| Card gap | 8 px | 8–48 px |
| List edge margin | 8 px | 4–24 px |
| Hover zoom | 1.60× | 1.00–1.60× |
| Top clearance | 40 px | 40–120 px |
| Physical cards in approved state | 6 | 3–12 evaluator range |
| Scenario | Zone Browse | Browse / single / multiple / mixed |
| Action placement | Below | Below / above |
| Alphabetical order | Off | Off / on |
| Selection cancelable | No | No / yes |
| Dialog state | Expanded | Expanded / collapsed where allowed |

No variable remains unresolved.

### 4.2 Dialog

- Prototype-only positioning: fixed + viewport centered.
- Production positioning: absolute inside visible `.duel-field`; initial/restored top-left + clamping follow ADR-017.
- Production width: cap at 1320px with 8px field-boundary inset; shrink to available field boundary.
- Production height: cap at 600px with 8px field-boundary inset; shrink to available field boundary.
- Prototype desktop minimum remains 680×430 where viewport permits; production field boundary may require smaller responsive size.
- Grid rows: `58px minmax(0, 1fr) 64px`.
- Border: 1 px `#697895`.
- Radius: 14 px.
- Background: `#18243b` shell, `#101a2d` body.
- Shadow: `0 28px 80px rgb(0 0 0 / 0.58)`.
- Content overflow: body clips; horizontal scroller owns list overflow.
- Browse dialog remains nonmodal to field architecture: `role="dialog"`, `aria-modal="false"`.
- Product header is drag surface. Drag updates viewport x/y without relayout and clamps dialog at least 8 px inside viewport bounds.

### 4.3 Header

- Height: 58 px.
- Layout: horizontal flex, vertically centered, 10 px gap.
- Padding: 6 px 8 px 6 px 18 px.
- Bottom border: 1 px `#697895`.
- Background: 90% mix of `#111b2f` and transparent.
- Title: 0.96 rem, weight 800, one line, ellipsis.
- Browse title: zone name only, e.g. `Graveyard`; never `Graveyard contents`.
- Count badge: minimum 28 × 28 px, 8 px inline padding, pill radius, 1 px `#486078` border, `#0c1728` fill.
- Filter notice: after count, 0.7 rem, weight 750, `#7ee2a8`, ellipsis.
- Full-zone browse: filter notice hidden.
- Single/multiple filtered list: `Filtered: legal targets only`.
- Mixed list: `Filtered: legal targets from Extra Deck, Graveyard, Banished, and Deck`.
- Header controls: minimum 44 × 44 px.

### 4.4 Card viewport and row

- Card list: one horizontal flex row; no wrapping.
- Card width: 144 px.
- Card image aspect ratio: 421 / 614.
- Computed unzoomed image height: about 210.01 px at 144 px width.
- Card gap: 8 px.
- Left/right scroll-edge margin: 8 px.
- Top row padding: `52px + 40px = 92px`; this reserves enlarged-card clearance.
- Bottom row padding: 42 px, including scrollbar room.
- No card overlap in base layout.
- Every physical duplicate gets its own tile. No quantity badge.
- If content width is less than or equal to viewport width: row horizontally centered; no scrollbar.
- If content width exceeds viewport width: row begins/ends with exact 8 px margins and horizontal scrollbar appears.
- Vertical wheel over consumable horizontal overflow changes `scrollLeft`; prevent default only when list consumes movement.
- Scrollbar: thin; WebKit height 12 px; `#73829d` thumb on `#0b1424` track.

### 4.5 Card presentation

- Art border: 2 px, 6 px radius.
- Card tile shadow: `0 7px 18px rgb(0 0 0 / 0.34)`.
- Name: 0.72 rem, weight 750, centered, one-line ellipsis, 8 px top margin.
- Name opacity becomes 0 during hover zoom, focus zoom, or selected/pinned zoom.
- First card transform origin: left 42%.
- Last card transform origin: right 42%.
- Other cards transform origin: center 42%.
- Hover/focus/selected scale: 1.60×.
- Transition: 120 ms ease-out.
- Reduced motion: transition disabled.

### 4.6 Halos

| State | Color | Treatment |
| --- | --- | --- |
| Selectable/legal | `#7ee2a8` | 2 px green halo |
| Selected or normal hover | `#ffd580` | 3 px orange halo plus elevated shadow |
| Unselectable | `#ff455d` | 3 px red halo plus shadow |

Priority:

1. Unselectable red overrides hover/focus.
2. Selected orange applies only to selected card.
3. Legal green applies to currently selectable cards.
4. Browse cards without legal actions receive no green action halo.

### 4.7 Mixed-zone badge

- Position: outside card image, directly above card.
- Visual gap from badge bottom to image top: 5 px in approved Chromium geometry.
- Left aligned to card.
- Padding: 3 px 6 px.
- Border: 1 px `#8ba0bf`.
- Radius: 4 px.
- Background: `rgb(8 16 31 / 0.9)`.
- Font: 0.58 rem, weight 850, 0.04 em tracking.
- Labels: `EXTRA DECK`, `GRAVEYARD`, `BANISHED`, `DECK`.
- Never use `GY`, `JY`, or `BAN`.

### 4.8 Action menu

- Browse mode only.
- Render only when card has one or more projected legal actions.
- Default placement: below card.
- Menu overlaps card-art edge by 2 CSS px before scale; approved 1.60× geometry measures about 3.2 px overlap.
- No positive pointer gap may exist between art and menu.
- Hovering card exposes menu; pointer can travel to menu without losing zoom or clickability.
- Position: absolute; card raises to z-index 500; menu z-index 10 inside raised card.
- First/last card menus align inward to avoid clipping.
- Menu background: `rgb(8 16 31 / 0.96)`; 1 px `#53627e` border; 6 px radius.
- Action controls: minimum 34 px height, warning fill `#ffd580`, 0.65 rem, weight 850.
- Approved labels: `Activate effect`, `Details`.

### 4.9 Footer

- Height: 64 px.
- Flex row, vertically centered, 12 px gap.
- Padding: 10 px 16 px.
- Top border: 1 px `#697895`.
- Browse mode: hide bottom-left stack/alphabetical prose; checkbox alone communicates sorting.
- Target modes: bottom-left count format exactly `X / Y selected`.
- Alphabetical control: 18 × 18 px checkbox, label `Alphabetical`, default off.
- Validate: success green `#7ee2a8`; dark text `#062015`; enabled only for exact valid count.
- Cancel: danger red `#ff8c9b`.

## 5. Interaction and state transitions

### 5.1 Zone Browse — approved default

- Header title is zone name only: `Graveyard` in fixed prototype.
- Show all public cards in current source stack order.
- First rendered card is top of stack.
- Last rendered card is bottom of stack.
- Card click never selects, pins, or persists zoom.
- Hover/focus may zoom card.
- Legal effect actions appear on hover/focus.
- Header shows close `×`; collapse is absent.
- Red Cancel is always present.
- Validate is absent.
- Fixed approved state shows 6 physical cards, centered because row does not overflow.

### 5.2 Single-target selection

- Show only legal matching targets.
- Required exact count: 1.
- Initial footer: `0 / 1 selected`.
- Clicking selectable card selects it, shows orange halo and checkmark, keeps zoom.
- Clicking selected card again unselects only that card and immediately unzooms it even while pointer remains over it.
- Validate enables at `1 / 1 selected` only.

### 5.3 Multiple-target selection

- Show only legal matching targets.
- Prototype required exact count: 3.
- Select cards independently until maximum reached.
- Maximum reached: every unselected card becomes red and natively disabled.
- Selected cards remain enabled solely to allow second-click unselection.
- Clicking outside cards does not clear selection.
- Escape does not clear selection.
- Validate enables only at `3 / 3 selected`.

### 5.4 Mixed-zone target selection

- Combine legal targets from Extra Deck, Graveyard, Banished, and Deck.
- Prototype required exact count: 2.
- Every card displays full source-zone badge above art.
- Header filter notice lists all four zones.
- Same hard maximum, red unavailable state, and exact validation rules as multiple selection.

### 5.5 Selection invariant

Validation is enabled iff all conditions hold:

1. Current mode is target selection.
2. `selectedCount === requiredCount`.
3. `selectedCount <= requiredCount`.
4. Every selected stable id still maps to a rendered effect-selectable card.

Any impossible over-maximum or stale-id state disables validation. Never trim, replace, or submit extra selections.

### 5.6 Unselect and hover suppression

- Second click on selected card removes only that selection.
- Same click adds temporary hover suppression to that tile.
- Transform resets immediately to unzoomed state.
- Suppression clears on `pointerleave`; later hover can zoom normally.
- Clicking unavailable card cannot select it, cannot show checkmark, and cannot retain focus zoom.
- Unavailable card may zoom on pointer hover; pointer leave always returns it to base scale.

### 5.7 Sorting

- Alphabetical off: preserve exact source array order.
- Alphabetical on: stable locale comparison by card name; original stack index breaks equal-name ties.
- Toggling off restores exact source stack order.
- Sorting changes display order only; it never mutates Worker/domain stack order.
- Selected stable ids survive sort.

### 5.8 Close, Cancel, collapse

Browse:

- Show header `×` and red Cancel.
- Both dismiss list without selection response.
- No collapse control.

Target selection:

- No header `×`.
- Show Cancel only when prompt contract is cancelable.
- Mandatory noncancelable prompt shows no Cancel.
- Collapse control is available instead of `×`.
- Expanded control is `−`.
- Collapsed state is exactly 58 × 58 px and shows only 44 × 44 px `+` at exact prior minus coordinates.
- Collapsed state hides title, count, filter notice, body, and footer.
- Expand restores prior window position and size.

## 6. Fixed parameter table

| Name | Value | Unit/state |
| --- | ---: | --- |
| `dialogWidth` | 1320 | px |
| `dialogHeight` | 600 | px |
| `cardWidth` | 144 | px |
| `cardGap` | 8 | px |
| `edgeMargin` | 8 | px |
| `hoverScale` | 1.60 | multiplier |
| `topClearance` | 40 | px |
| `physicalCardCount` | 6 | cards |
| `scenario` | Zone Browse | state |
| `actionPlacement` | below | state |
| `alphabetical` | off | state |
| `cancelable` | no | state |
| `dialogState` | expanded | state |
| header row | 58 | px |
| footer row | 64 | px |
| action/card seam | −2 | unscaled CSS px overlap |
| card transition | 120 | ms |
| collapsed target size | 58 × 58 | px |

## 7. Mocked vs production behavior

Mocked in HTML:

- Six embedded JPEG card images and physical-copy quantities.
- Zone contents and legal-action distribution.
- Effect activation and Details actions; toast confirms mock action.
- Validation submission.
- Filtered target sets and source-zone distribution.
- Dialog close behavior.

Production:

- Use projected card identities, stack order, stable ids, zones, and legal choices.
- Use `CardImageLibrary` leases and existing placeholder fallback.
- Dispatch existing typed `InteractionChoice` callbacks.
- Use prompt min/max/cancelable constraints.
- Worker remains sole authority for legality and hidden information.
- Never reveal opponent-hidden identity to build or sort list.

## 8. Responsive/adaptive behavior

- At viewport width above 780 px, dialog uses approved caps and 24 px viewport clearance.
- At `max-width: 780px`:
  - Stage padding: 12 px.
  - Dialog width: `calc(100vw - 24px)`.
  - Dialog height: `min(600px, calc(100svh - 24px))`.
  - Dialog minimum width: 0.
  - Dialog minimum height: 380 px.
- Card width remains 144 px unless production adds an explicit approved adaptive rule; overflow scroll handles narrow screens.
- One-row list never wraps.
- Short rows stay centered at every width.
- Overflow rows preserve 8 px leading/trailing margins.
- First/last transform origins prevent enlarged edge cards from being cut off horizontally.
- Dialog body reserves zoom clearance; action menu must remain inside usable body/footer geometry.

## 9. Accessibility

- Dialog has accessible title association.
- All interactive targets meet 44 × 44 px minimum except compact action chips, which must remain keyboard reachable and retain existing product semantics.
- Visible focus: 3 px `#f6c177`, 3 px offset.
- Every card image has identity alt text only when identity is visible.
- Hidden identities keep empty alt and appropriate `aria-hidden` behavior from product component.
- Target card controls expose `aria-pressed`.
- Unavailable cards expose `aria-disabled="true"` and native `disabled`.
- Mixed-zone badge has full accessible zone name.
- Alphabetical checkbox has visible semantic label.
- Count and validation state remain perceivable without color.
- Red/green/orange halos supplement, never replace, disabled/pressed state.
- Keyboard sorting and selection preserve focus where possible.
- Reduced-motion media query removes zoom transition.

## 10. Edge, error, empty, loading states

### Empty

- Render header and footer normally.
- Count badge: `0`.
- Body shows explicit `No cards available` message; do not render blank unexplained space.
- Validate disabled.
- Alphabetical checkbox disabled when fewer than 2 cards.

### One card

- Center horizontally.
- No scrollbar.
- Preserve 8 px minimum boundary safety.

### Overflow

- Horizontal scrollbar appears only when `scrollWidth > clientWidth`.
- Wheel conversion occurs only while horizontal travel remains.
- At both limits, visible edge margin is 8 px.

### Image loading/error

- Retain existing lease and placeholder behavior.
- Layout dimensions never change when image resolves or fails.

### Stale selection

- If selected id disappears after state projection, preserve draft + mark validation invalid before response.
- Never trim, replace, or submit stale ids. Validation fails closed until projection/prompt replacement resolves them.

### Not enough targets

- Show all effect-legal targets.
- Keep validation disabled when available target count is below required count.
- Surface existing prompt validation message; never fabricate selectable cards.

### Maximum reached

- All unselected target cards become red and disabled.
- Unselecting one selected card restores legal remaining cards to green/selectable.

### Hidden info

- Never alphabetize or label by hidden card identity.
- Browse/filter list receives only viewer-authorized identities.

## 11. PDDR references

- Scope: Decisions 1, 17.
- Filtered visible/full-width scope: Decisions 2, 19. Decision 2 duplicate-count detail is historical.
- Physical duplicate representation: Decisions 8, 31.
- Geometry: Decisions 3, 11, 12, 30, 31.
- Selection and zoom: Decisions 4, 9, 20, 21, 26–29.
- Action placement: Decisions 5, 13.
- Evaluator controls: Decision 6.
- Mode split and chrome: Decisions 7, 10, 14–16, 22.
- Stack order and sorting: Decision 18.
- Mixed-zone labels and notice: Decisions 23, 25.
- Browse text reduction: Decision 24.

Fixed prototype is acceptance authority only for frozen visual values + 4 approved fixtures. ADR-021, Worker privacy/legality contracts, field-boundary rules, accessibility requirements govern production compatibility cases + override prototype behavior.

## 12. Implementation acceptance checks

Run in Chromium at 1440 × 900 unless check names responsive viewport.

### Approved fixed-state checks

1. Fixed prototype opens standalone with zero network requirements and zero JS errors.
2. Dialog measures 1320 × 600 px.
3. Header title equals `Graveyard`.
4. Count badge equals `6`.
5. Six physical card tiles render, no quantity badge.
6. Six-card row has `scrollWidth === clientWidth` and is centered within 1 px.
7. Card width measures 144 px before zoom; base gap measures 8 px.
8. Hover scale computes to 1.60× after transition.
9. Zoomed card name opacity equals 0.
10. Browse card click produces zero selected tiles and no retained zoom after pointer leave.
11. Legal action menu is visible on hover and overlaps art edge by 0–4 rendered px; no positive gap.
12. `Activate effect` can be clicked without preselecting card.
13. Alphabetical on sorts names; off restores byte-for-byte stable source order.
14. Browse header has `×`; no collapse control.
15. Browse footer has alphabetical checkbox and red Cancel; no order prose or Validate.
16. Fixed file contains no evaluator toolbar, evaluator drag/collapse/copy controls, fallback textarea, or debug reopen control. Product dialog-header drag remains functional.

### Target-mode checks against working prototype/product implementation

17. Single target begins `0 / 1 selected`; one selection enables Validate.
18. Multiple target begins `0 / 3 selected`; exactly three selections enable Validate.
19. Mixed target begins `0 / 2 selected`; exactly two selections enable Validate.
20. Mixed cards show full labels `EXTRA DECK`, `GRAVEYARD`, `BANISHED`, `DECK` about 5 px above art.
21. Mixed header notice exactly names Extra Deck, Graveyard, Banished, and Deck.
22. At maximum, every unselected target is red, disabled, unchecked, and cannot be selected.
23. Red halo remains red during hover/focus.
24. Pointer leave returns unavailable card transform to `none`.
25. Outside click and Escape preserve all current selections.
26. Second click on selected card removes only that card and immediately resets transform.
27. Falling below maximum restores other effect-legal cards to green/selectable.
28. Validation disables for under-count, over-count, stale id, or intrinsically illegal selected id.
29. Noncancelable target has no `×` and no Cancel.
30. Cancelable target has red Cancel and no `×`.
31. Collapse keeps plus/minus viewport x/y coordinates equal within 0.5 px.
32. Collapsed target header shows exactly one visible child: `+`.

### Responsive checks

33. At 780 px and 320 px widths, dialog remains inside viewport with no page-level horizontal overflow.
34. Card row remains one line and horizontally scrollable when needed.
35. First/last zoom and action menu remain visible/clickable at scroll limits.
36. Keyboard can focus checkbox, cards, actions, Validate, Cancel, and close controls in logical order.
