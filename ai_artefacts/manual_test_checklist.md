## T1 pixel-geometry-model

- [ ] Confirm existing duel field renderer looks unchanged at supported viewport sizes.
- [ ] Confirm keyboard field navigation behaves identically at small and large viewport sizes.
- [ ] Confirm Link-free duel omits both shared Extra Monster Zones from render-layout data.

## T2 conditional-chromium-acceptance-harness

- [ ] Open an unknown or missing acceptance scenario and confirm a visible error appears with no fallback board.
- [ ] Open the normal app and confirm its startup and duel experience remain unchanged.
- [ ] Open the deterministic EMZ, no-EMZ, and Defense harness scenarios and confirm each field renders visually as expected.

## T3 pixel-board-rendering

- [ ] Open real duel; confirm square zone outlines plus concentric card slots stay aligned.
- [ ] Resize duel boundary; confirm board recomputes without oscillation or clipped floating windows.
- [ ] Hover face-up Defense plus face-down Set cards; confirm art rotates while outer card centre plus hover scale stay fixed.
- [ ] Use keyboard focus, card actions, stack preview, hand drag; confirm controls remain actionable.

## T4 full-hands-overlay-scrollbar

- [ ] Use wheel/trackpad to reach offscreen cards in a 20-card hand.
- [ ] Use Arrow navigation to reach offscreen hand cards; confirm focus scrolls them into view.
- [ ] Drag an actionable hand card after scrolling; confirm drag still starts and completes.
- [ ] Drag the overlay thumb; confirm the hand viewport scrolls without changing card height.

## T5 geometry-anchored-phases

- [ ] Confirm EMZ phase groups flank both shared zones without overlap.
- [ ] Confirm no-EMZ phases form one centered Draw→Standby→Main 1→Battle→Main 2 run.
- [ ] Confirm End turn aligns board inner-right edge in both profiles.
- [ ] Use keyboard to reach each legal phase control plus End turn; confirm each activates same offered choice.

## T6 right-rail-replaces-header

- [ ] Confirm right-rail Options opens menu/settings during active duel.
- [ ] Confirm rail status stays additive; active prompt remains sole decision UI.
- [ ] Confirm reduced-motion mode keeps three waiting dots visible and static.

## T7 full-height-shell

- [ ] Confirm preview, field, rail fill one viewport-height row with no page scrollbar.
- [ ] Resize among 1366×768, 1920×1080, 2560×1440; confirm field stays centered between preview and rail.
- [ ] Drag floating field windows to each edge, resize narrower; confirm windows reclamp inside field.

## T8 preview-overlay-scrollbar

- [ ] Focus effect text; confirm PageDown and End scroll it, focus ring stays visible, and overlay thumb is absent from Tab order.
- [ ] Compare short and long effect text; confirm paragraph width stays fixed and overlay thumb appears only for long text.
- [ ] Drag overlay thumb; confirm effect text scrolls while panel remains inside one viewport-height row.

## T9 persisted-display-settings-v2

- [ ] Toggle zone outlines and counts off; confirm zone names, focus, legality, selection, and drop halos remain intact.
- [ ] Reload; confirm both display choices remain off.
- [ ] Reset settings; reload; confirm both display choices return on.
- [ ] Clear site data; confirm display settings, decks, and floating-window positions return to defaults.

## T10 approved-browse-dialog-shell

- [ ] Confirm browse actions remain usable through approved shell.
- [ ] Confirm alphabetical sorting never requests or reveals hidden card art or identity.
- [ ] Confirm browse dismisses through outside press, Escape, header ×, and footer Cancel.
- [ ] Confirm 6-card row centers; overflow row retains 8px edges at field widths.

## T11 card-tiles-projected-choice-menu

- [ ] Confirm duplicate menu reaches every choice with Tab, Arrow keys, Home, and End; Escape returns focus to tile trigger.
- [ ] Confirm Details previews card without emitting an engine response.
- [ ] Confirm hidden cards reveal no identity in art alt text, labels, or menus.
- [ ] Confirm first and last zoomed card menus remain clickable inside dialog.

## T12 target-chrome-collapse

- [ ] Confirm target draft survives outside press, Escape, collapse, and expansion.
- [ ] Confirm target collapse stays anchored and expansion remains inside resized field boundary.
- [ ] Confirm target shows no ×, conditional Cancel, dynamic source notice, and privacy-safe sorting.
- [ ] Confirm browse still dismisses through outside press, Escape, ×, and Cancel.

## T14 selection-ui-integration

- [ ] Confirm off-field exact-single clicks draft only, then Validate submits; mounted-field exact-single still submits immediately.
- [ ] Confirm range Validate enables inclusively, while maximum lock disables only unselected opaque choices.
- [ ] Confirm selected duplicate choices remain removable one opaque ID at a time; final tile unselect suppresses zoom until pointerleave.
- [ ] Confirm sorting, collapse, outside press, and Escape preserve target draft without answering prompt.
- [ ] Confirm hidden opponent targets expose no identity or art while unavailable/selected state remains perceivable without color alone.

## T15 card-list-chromium-acceptance

- [x] Confirm attached wide browse, mixed target, max-locked target, and 320px responsive screenshots are readable.
- [x] Confirm keyboard route focus remains visible and no hidden card identity appears.
- [x] Confirm startup, duel actions, browse, target Validate, and reload settings remain functional.

## T1 merge-duel-field-branch

- [ ] Run `npm run dev` (default `DEV_PORT=4300`) and open `http://localhost:4300/#/` — the duel starts directly, no blank screen and no "Application could not start" alert.
- [ ] On that duel, confirm the field uses the merged pixel geometry: square zone outlines with concentric card slots, aligned rows, no clipped board edge.
- [ ] Confirm the right status rail is present and the old duel header bar is gone.
- [ ] Confirm the whole duel fits exactly one viewport (no page scrollbar) at your normal window size, then resize taller/shorter and confirm it still fits.
- [ ] Open a stack zone (Deck / Graveyard / Banished) to raise the card-list dialog; confirm cards render as tiles, sorting/browse chrome appears, and Escape closes it.
- [ ] Open Settings, toggle a field-display option, reload the page, and confirm the toggle survived (persisted display settings v2).
- [ ] Open `http://localhost:4300/#/decks` — the deck-builder prototype renders and the duel does not start. (Route renamed from `#/prototype/deck-builder` by T2.)
- [ ] Open `http://localhost:4300/prototype.html` — the visual-novel prototype title screen renders.
- [ ] Run `npm run build` and confirm it exits 0 — this proves the repaired `vite.config.ts` still emits BOTH the `app` (`index.html`) and `prototype` (`prototype.html`) bundles.
- [ ] Confirm `dist/prototype.html` exists after that build.

## T2 shell-routes-and-mount

- [ ] Run `npm run dev` (default `DEV_PORT=4300`). Open `http://localhost:4300/#/` — the duel starts directly, exactly as before, with no "Application could not start" alert.
- [ ] Open `http://localhost:4300/#/duel` — the duel starts here too.
- [ ] Confirm the duel still fills exactly one viewport height with no page scrollbar (the `100svh` grid moved from `#app[data-app-entry="duel"]` to `.shell-region--duel`).
- [ ] Open `http://localhost:4300/#/decks` — the deck-builder prototype renders and no duel starts.
- [ ] Open `http://localhost:4300/#/story` — the page shows only the text `Not available yet`.
- [ ] Open `http://localhost:4300/#/admin` — the page shows only the text `Not available yet`.
- [ ] Open `http://localhost:4300/#/nope` — it falls back to home, which currently renders the duel.
- [ ] Open `http://localhost:4300/#/prototype/deck-builder` — this old route is gone; it must now fall back to the duel, NOT the deck builder.
- [ ] From the duel, edit the address-bar hash to `#/decks` and press Enter without reloading — the shell swaps to the deck builder in place (hashchange routing).
- [ ] Then edit the hash back to `#/duel` without reloading — the shell swaps back to the duel.
- [ ] Play a few actions in the duel (draw/summon/end turn) and confirm it is fully usable with an empty browser console (no errors).
- [ ] Create and edit a deck in the deck builder, reload, and confirm the edit persisted and the console is empty.
- [ ] Open `http://localhost:4300/prototype.html` — the visual-novel prototype title screen still renders (story has not moved into the shell yet).
- [ ] In DevTools, confirm `document.querySelector("#app").dataset.appShell === "ready"`.
- [ ] Run `npm run build` and confirm it exits 0.

## T3 design-tokens

T3 is a pure indirection refactor: every colour, radius and font-size in
`src/styles/app.css` now resolves from `src/styles/tokens.css`. Nothing may
look different. Every item below is a "did it stay the same" check — take a
screenshot before checking out this branch if you want a strict A/B.

- [ ] Run `npm run dev` and open `http://localhost:4300/#/duel`. The page background is still the dark navy with the blue radial glow in the top-left corner.
- [ ] The duel field board is still the dark green felt with its diagonal gradient and centre radial sheen — not flat, not a different hue.
- [ ] Empty zones still show their dashed pale-green outlines; zone count badges still read in off-white.
- [ ] Hover a card in your hand: the halo/zoom behaves as before and the card art border is still the pale near-white hairline.
- [ ] Trigger a legal action (e.g. summon): actionable zones and cards still show the GREEN halo, not orange.
- [ ] Select a card in a prompt: the selected halo is still ORANGE and overrides the green.
- [ ] Tab to a field control and confirm the keyboard focus ring is still the warm amber outline (`--focus-ring`), visually distinct from both green and orange.
- [ ] Drag a card over a legal drop zone: the drop-candidate fill is still translucent green and darkens on hover.
- [ ] Open the card-list dialog (click a zone with a pile): header, body, footer, scrollbar thumb/track colours and the tile borders are all unchanged.
- [ ] In the card-list dialog, hover a tile (orange border) and confirm an unavailable target tile still shows RED through hover and focus.
- [ ] Open the card preview panel: panel background, art frame and effect-text colours are unchanged; art is still bounded by viewport height.
- [ ] Check the status rail and the phase strip / End turn button: chip fills, text colours and the amber "warning" button hover are unchanged.
- [ ] Force an error (or view a known error/result panel): the error panel is still red-bordered on dark maroon, the recoverable variant still amber-bordered, the result panel still teal-bordered.
- [ ] Confirm no element has visibly different CORNER ROUNDING — `border-radius` values of 0.35/0.6/0.9rem were swapped for `--radius-sm/md/lg`.
- [ ] Confirm no label or badge changed SIZE — font sizes of 0.72/0.85/1.25rem were swapped for `--text-xs/sm/lg`.
- [ ] Play one full turn and confirm the browser console stays empty (no missing-variable or CSS parse warnings).
