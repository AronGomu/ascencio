# PROTOTYPE_SPEC: deck_select_layout

Approved 2026-09-02. Variant E · Twin Columns. Fixed prototype:
`docs/feature/PROTOTYPE_deck_select_layout.html`. PDDR:
`docs/feature/PDDR-deck_select_layout.md` (Decisions 1–12).

## 1. Scope + out of scope

- IN: duel-start mode of `src/deck-select/DeckSelectScreen.svelte` — layout of
  title bar, deck grid, footer, right seat pane, hover preview behaviour;
  `DecklistPanel` copies chip; responsive compaction of header/footer.
- OUT: library mode dock (unchanged), phone (<40rem) layout, opponent picker
  dialog, deck management dialogs, story-locked variants' business rules,
  duel field, actual Create-deck flow implementation (button + callback only).

## 2. Question + verdict

Where do mode title, screen title, filter+sort and Start Duel live around the
fixed elements? VERDICT: one-line title bar top-left; full-height right pane
with twin seat columns (you left, opponent right), each avatar-over-decklist;
Start pinned pane-bottom; sticky footer with red Return left and colored
manage cluster + green Create right; hover preview docks into the pane
(float removed).

## 3. Branch + target tech

UI branch. Target: Svelte 5 components under `src/deck-select/`, tokens in
`src/styles/tokens.css`, boundary rules per ADR-022/ADR-045. All rendered
elements carry `data-cy` per the HTML element contract.

## 4. Screen hierarchy (duel-start, wide)

```
.screen (grid: [minmax(0,1fr) 38rem] / [auto minmax(0,1fr) auto], gap 0.75rem, padding 0.75rem)
├─ .titlebar        (col 1, row 1)  eyebrow · h1 · sep · sort select · filter input(flex:1)
├─ .grid            (col 1, row 2)  scrollable deck tiles
├─ footer.actions   (col 1, row 3)  sticky; Return | →(spacer)→ manage + Create
└─ aside.pane       (col 2, rows 1/-1) full height
   ├─ .seats (grid: 1fr 1fr, gap 0.75rem)
   │  ├─ seat-section PLAYER (left):   avatar → seat chip → decklist(scroll)
   │  └─ seat-section OPPONENT (right): avatar → seat chip → decklist(scroll)
   └─ button.start  (pinned bottom, full pane width)
```

## 5. Fixed parameters (approved)

| Param | Value |
|---|---|
| Pane width | 38rem |
| Tile min size | 12rem |
| Grid gap | 0.5rem |
| Tile art opacity | 0.8 |
| Avatar height | 8rem |
| Chamfer | 12px (`--chamfer` — note: token default is 10px; this screen uses 12px) |

## 6. Element specs

### Title bar
- One flex row, gap `--space-3`: eyebrow (mode, e.g. "Free Play", Forum caps
  0.22em tracking, `--muted`) · h1 (Forum 1.3rem, 0.12em tracking, uppercase)
  · gold `·` separator · sort `<select>` (Last modified / Name) · filter
  `<input type=search>` with `flex: 1 1 auto; min-width: 6rem` stretching to
  the pane edge. Controls: 2.4rem min-height, `--surface-chain` bg,
  `--border` border, `--radius-sm`.

### Deck grid
- `repeat(auto-fill, minmax(min(12rem,100%),1fr))`, `gap: 0.5rem`,
  `overflow-y: auto; scrollbar-gutter: stable; padding-right: --space-2`.
- Tile: unchanged square (aspect 1/1), cover art `opacity: 0.8`, name overlay
  top-left, counts overlay bottom-left, gold halo picked (player seat), red
  halo while filling opponent seat, ✓ badge on player pick.

### Footer
- `position: sticky; bottom: 0`, top hairline `--line-soft`, bg `--bg`,
  flex row gap `--space-2`.
- Return button LEFT: Forum caps, 3.1rem min-height, text `← Return to {origin}`
  ({origin} = host screen name, free play → "Menu"), `--danger` text on
  `--danger-surface` with `--danger-border`; hover = white on `--danger-strong`.
- Manage cluster `margin-left: auto`, order: Delete (red: `--danger` text,
  `--danger-border`, 12% danger tint bg; hover solid `--danger-strong`),
  Rename (yellow: `--selected`, same tint pattern; hover solid `--selected`
  with `--ink-on-accent`), Duplicate (blue: `--seat-you`, same pattern),
  Open (neutral secondary), Create (LAST: solid `--legal` bg, dark ink
  `#06170d`, weight 650, label "+ Create").

### Right pane
- Full height (grid rows 1/-1), `--glass` bg, `--line-soft` border,
  `--gold-line` left edge, padding `--space-3`.
- Internal grid rows `minmax(0,1fr) max-content`: seats scroll region + Start.
- Seat section rows `max-content max-content minmax(0,1fr)`: avatar and chip
  never scroll; only the decklist scrolls (`scrollbar-gutter: stable`).
- Avatar: 8rem tall, `--surface-panel`, SVG placeholder figure tinted
  `--seat-you` 26% (player) / `--seat-opponent` 26% (opponent), name overlay
  bottom-left (Forum caps, shadow chip). Player label "You"; opponent label =
  opponent name.
- Seat chip: deck NAME ONLY (single row, ellipsis), `--glass-strong` bg,
  3px seat-color left edge, 12px chamfer clip. Acts as seat toggle
  (aria-pressed): pressing opponent chip fills opponent seat from the grid;
  pressing again (or player chip) returns to player. Active chip:
  2px `--selected` outline offset 2px.
- Decklist: production `DecklistPanel` rendering — Main/Extra/Side headings
  `Label (total)`, 30px rows, 5px `CARD_FRAME_COLORS[frame]` left border,
  cropped art bg 0.6 opacity + left fade, copies chip 24px tabular. CHANGE:
  chip always shows the count — "1" for singles (keep dimmer `#0006` bg).
- Start: full pane width, 3.1rem, Forum caps 0.16em, gold gradient
  (`--accent`→`--accent-strong`), `--ink-on-accent`, 12px chamfer clip,
  pinned under the seats — bottom-right of the overall screen.

### Hover preview (replaces float)
- Pointer enters a grid tile → that deck's full list renders in the decklist
  slot of the seat currently being filled, with `1px dashed --selected`
  outline offset 3px. No text label. Pointer leaves → picked deck's list
  returns. Coarse pointers: no hover preview (production rule stands).
- The fixed-position `.float` hover window is REMOVED in duel-start.

## 7. Responsive compaction (probe-measured)

- No fixed breakpoints. On resize (and layout-affecting changes), measure a
  hidden `width: max-content` probe of the FULL bar content against the live
  bar's clientWidth; overflow → compact class.
- Header compact: eyebrow + separator hidden; title text becomes
  "Select Deck".
- Footer compact: Return shrinks to 2.5rem / `--text-sm`; manage cluster
  hides; a ⋯ kebab button (2.75rem square) appears right, opening an
  upward menu (`--surface-raised`, `--gold-line` border, shadow) holding all
  five actions with their colors.
- Phone (<40rem) layout out of scope; existing behavior stands.

## 8. Mocked vs production

| Prototype mock | Production |
|---|---|
| Inline DATA blob of parsed .ydk lists | Worker-backed `decklistFor(key)` resolver |
| `../generated/card-images/...` paths | `cardImageFor(code)` / `artUrl` on `DecklistRow` |
| alert() on Start/Return/Create | `onstart` / `onback` / new `oncreate` callback |
| 36 cloned decks | real repository tiles |
| SVG avatar placeholder | stays (no portrait art shipped) |
| innerHTML re-render | Svelte reactivity |

## 9. States

- Empty filter result: grid renders zero tiles (footer + pane unaffected).
- No legal pick / cannot start: Start disabled (production `canStart` rule +
  `blockNotice` in footer — unchanged logic, restyled position kept).
- Locked opponent (story): chip inert div, no seat toggle (production rule
  stands; prototype did not model it).
- Deck with no art rows: rows render without art/fade, frame color only.

## 10. Accessibility

- Seat chips are buttons with `aria-pressed`; kebab has `aria-label`.
- `:focus-visible` ring `--focus-ring` 2px offset 2px everywhere.
- Keyboard shortcuts of production screen (`/`, arrows, Enter, `f`) must
  survive the restructure.
- Decklist row names ellipsize; full name via `title` attr (add in prod).

## 11. Impl acceptance checks

1. Chromium E2E: duel-start shows pane 38rem, player column left, opponent
   right, Start visible at 900px height with both lists overflowing.
2. Hover a tile → active seat column list swaps + dashed outline; leave →
   restores. No `.float` element in duel-start DOM.
3. Footer: Return leftmost with danger styling; Create last with legal bg;
   manage cluster right-justified.
4. Narrow viewport (~950px): title = "Select Deck", no eyebrow; kebab menu
   opens with 5 actions.
5. Copies chip shows "1" on singles in every decklist rendering.
6. `data-cy` coverage test green; boundary tests green; no raw color
   literals outside tokens.css (guard test).
