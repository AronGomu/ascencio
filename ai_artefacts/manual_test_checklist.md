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
- [ ] Open `http://localhost:4300/#/decks` — the Deck Editor library renders and the duel does not start. (Route renamed from `#/prototype/deck-builder` by T2; the surface was renamed from "deck-builder prototype" to "Deck Editor" by T8.)
- [ ] Open `http://localhost:4300/#/story` — the visual-novel title screen renders. (Corrected by T7: this was `prototype.html`, which no longer exists.)
- [ ] Run `npm run build` and confirm it exits 0 — this proves the repaired `vite.config.ts` still emits the `app` (`index.html`) bundle. (Corrected by T7: the `prototype` input was removed, so only one bundle is expected now.)
- [ ] Confirm `dist/index.html` exists after that build and `dist/prototype.html` does NOT. (Corrected by T7.)

## T2 shell-routes-and-mount

- [ ] Run `npm run dev` (default `DEV_PORT=4300`). Open `http://localhost:4300/#/` — the duel starts directly, exactly as before, with no "Application could not start" alert.
- [ ] Open `http://localhost:4300/#/duel` — the duel starts here too.
- [ ] Confirm the duel still fills exactly one viewport height with no page scrollbar (the `100svh` grid moved from `#app[data-app-entry="duel"]` to `.shell-region--duel`).
- [ ] Open `http://localhost:4300/#/decks` — the Deck Editor library renders and no duel starts. (Corrected by T8: this used to say "deck-builder prototype".)
- [ ] Open `http://localhost:4300/#/story` — the visual-novel title screen renders. (Corrected by T7: this used to be the `Not available yet` placeholder.)
- [ ] Open `http://localhost:4300/#/admin` — the page shows only the text `Not available yet`.
- [ ] Open `http://localhost:4300/#/nope` — it falls back to home, which currently renders the duel.
- [ ] Open `http://localhost:4300/#/prototype/deck-builder` — this old route is gone; it must now fall back to the duel, NOT the deck builder.
- [ ] From the duel, edit the address-bar hash to `#/decks` and press Enter without reloading — the shell swaps to the deck builder in place (hashchange routing).
- [ ] Then edit the hash back to `#/duel` without reloading — the shell swaps back to the duel.
- [ ] Play a few actions in the duel (draw/summon/end turn) and confirm it is fully usable with an empty browser console (no errors).
- [ ] Create and edit a deck in the deck builder, reload, and confirm the edit persisted and the console is empty.
- [ ] Open `http://localhost:4300/#/story` — the visual novel is served from `index.html` like every other domain. (Corrected by T7: this line used to point at `prototype.html`, which T7 deleted.)
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

## T4 responsive-stage

T4 gives the whole product one layout law: above 1024px CSS width the app is a
centred 16:9 "stage" with `--bg` letterbox bars filling the leftover space;
below 1024px the shell publishes a mobile mode instead. The duel now measures
the stage, not the viewport. The portrait duel rotation and the deck portrait
layout are NOT in this ticket — below 1024px you should only see the mode
change and the stage scale down, not a re-laid-out duel.

Note for the T3 checks above: on a window whose aspect ratio is not 16:9 the
app is now bordered by black bars. Colours inside the stage are unchanged; the
bars themselves are expected and are not a T3 regression.

Run `npm run dev` and open `http://localhost:4300/#/duel` for every item.

- [ ] Resize the window to roughly 1920x1080 (or any 16:9 shape): there are NO bars — the app fills the window edge to edge.
- [ ] Resize to a tall/square window (e.g. 1920x1200, or just drag the bottom edge down): horizontal bars appear above and below the app, equal height, background matches the page background.
- [ ] Resize to a short/wide window (e.g. 1280x600): vertical bars appear left and right, equal width, and the duel shrinks to stay inside them.
- [ ] At every desktop size above: no scrollbar ever appears on the page itself, on either axis. Spin the mouse wheel over the field and over the bars — the page must not move.
- [ ] Inspect the stage element (`[data-cy="app-stage"]` in devtools) at each desktop size: `data-stage-mode` reads `stage`.
- [ ] Narrow the window below 1024px while keeping it wider than it is tall (e.g. 900x500): `data-stage-mode` reads `mobile-landscape` and the app is still a 16:9 box, just smaller, with bars top and bottom.
- [ ] Narrow to a portrait shape (e.g. 500x900): `data-stage-mode` reads `mobile-portrait`, ALL bars vanish, and the app fills the whole window. The duel is expected to look cramped here — its portrait layout is a later ticket.
- [ ] Rotate a phone/tablet (or use devtools device emulation) from portrait to landscape and back: the mode attribute flips between `mobile-portrait` and `mobile-landscape` without needing a page reload.
- [ ] Start a duel from the deck picker at 1920x1200: the picker, the field, the status rail and the card preview all sit INSIDE the stage — nothing is drawn over the bars.
- [ ] Play a full turn (summon, set, attack, end turn) at 1280x600: every control is reachable and clickable, and the field never spills outside the bars.
- [ ] Open the card-list dialog by clicking a zone with a pile at 1920x1200: the dialog stays inside the stage and can still be dragged/collapsed/closed.
- [ ] Open `http://localhost:4300/#/decks` and resize between the sizes above: the deck editor scrolls INSIDE the stage (its own scrollbar), and the page itself still never scrolls.
- [ ] Drag the window edge slowly across the 1024px boundary: the mode switches once, cleanly, with no flicker or stuck bars.

## T5 home-hub-and-settings

Run `npm run dev` and open `http://localhost:4300/` (no hash) for every item.

- [ ] The first screen is the hub: a "YGO Story Duel Simulator" title with four buttons — Story, Decks, Duel, Settings. NO deck picker and NO duel appear here.
- [ ] Click Duel: the URL becomes `#/duel` and the deck picker loads; start a duel and play a turn — the duel behaves exactly as before.
- [ ] Press the browser Back button from the duel: you return to the hub and the duel is gone.
- [ ] Click Decks: the URL becomes `#/decks` and the deck editor loads.
- [ ] Click Story: the URL becomes `#/story` and the "Not available yet" placeholder shows (the visual novel moves here in a later ticket).
- [ ] Type `http://localhost:4300/#/nonsense` in the address bar: you land back on the hub, not on an error.
- [ ] Click Settings on the hub: a settings dialog opens with a Fullscreen switch reading "Off" and a Close button.
- [ ] Click the Fullscreen switch: it reads "On". Close the dialog, reopen it — it still reads "On" (the choice is remembered).
- [ ] Reload the page: the browser does NOT jump to fullscreen on its own, and a tip appears on the hub explaining that fullscreen needs one click.
- [ ] Click "Go fullscreen" in the tip: the browser enters fullscreen.
- [ ] Leave fullscreen (Esc) and reload: the tip does NOT come back. Any first click or keypress in the app now re-applies fullscreen.
- [ ] Turn the Fullscreen switch back to "Off" in Settings and reload: no tip, and clicking around never forces fullscreen.
- [ ] With fullscreen preferred and the tip showing, click "Not now" instead: the tip disappears and does not return after a reload.
- [ ] In devtools Application → Local Storage, confirm a `ygo.ui.v3` entry exists after changing a setting.
- [ ] Zone outlines/counts you set previously inside the duel settings are still what you left them (the v2 display settings carry forward).

## T6 admin-console

Run `npm run dev`. The console is a developer surface: it is never linked from the game, so it is reached only by typing the URL.

- [ ] From the hub at `http://localhost:4300/`, look over the whole screen and open Settings: there is NO Admin/Console/Developer button anywhere.
- [ ] Press Tab repeatedly through the hub and the settings dialog: focus never lands on an admin control.
- [ ] Do the same sweep inside `#/duel` and `#/decks`: no admin control appears there either.
- [ ] Type `http://localhost:4300/#/admin` in the address bar: a "Developer console" screen loads with a warning line and three sections — Routes, State jumps, Resets.
- [ ] The console stays inside the 16:9 stage (letterbox bars are untouched) and scrolls with its own scrollbar if the window is short; the page itself never scrolls.
- [ ] In Routes, click `#/` → the hub loads. Type `#/admin` again, click `#/duel` → the deck picker loads. Type `#/admin` again, click `#/decks` → the deck editor loads. Type `#/admin` again, click `#/story` → the "Not available yet" placeholder shows.
- [ ] Back on `#/admin`, click "Seed test deck & open decks": the deck editor opens and the library lists a deck named "Admin test deck".
- [ ] Open that deck: it holds 40 Main-deck cards.
- [ ] Return to `#/admin` and click "Launch preset duel": the duel route opens with the normal deck picker, and no extra deck was written to the library.
- [ ] Return to `#/admin` and click "Open story": the visual-novel title screen shows. (Corrected by T7: this used to land on the placeholder.)
- [ ] Click "Reset…" next to "Deck library": nothing is deleted yet — a "Delete for good" button and a "Cancel" button appear in its place.
- [ ] Click "Cancel": the row returns to a single "Reset…" button. Visit `#/decks` — "Admin test deck" is STILL there. A single stray click must never delete data.
- [ ] Back on `#/admin`, click "Reset…" on "Deck library", then click "Reset…" on "Shell settings": only ONE row is armed at a time — the deck-library confirm disappears.
- [ ] Press Cancel, then arm "Deck library" again and click "Delete for good": the status line reads "Cleared Deck library." Visit `#/decks` — the library shows "No local decks".
- [ ] Repeat the arm-then-confirm flow for each remaining row (Duel snapshots, Shell settings, Story progress): each one asks for a separate confirmation and reports "Cleared …" when done. (Corrected by T7: the row is now labelled "Story progress" and clears `ygo.story.v1`.)
- [ ] After clearing "Shell settings", check devtools Application → Local Storage: the `ygo.ui.v3` entry is gone, and reloading the hub shows default settings.
- [ ] After clearing "Duel snapshots", start a duel from `#/duel` and play a turn: the duel still works (the snapshot store rebuilds itself).
- [ ] Reload `#/admin` after every reset: the console still loads and normal play from the hub is unaffected.

## T7 story-domain-migration

Reach the story

- [ ] Run `npm run dev` (default `DEV_PORT=4300`) and open `http://localhost:4300/#/` — the home hub appears; click its Visual novel entry and the URL becomes `#/story`.
- [ ] Open `http://localhost:4300/#/story` directly — the title screen "Echoes of the Draw" renders with New Game / Load / Settings, and focus starts on New Game.
- [ ] Confirm there is NO "Start full flow" screen, no "Jump to screen or state" button, and no "Reviewer tools" drawer anywhere in the story.
- [ ] Open `http://localhost:4300/prototype.html` — it must NOT serve the visual novel any more (the second entry document is deleted).
- [ ] With DevTools Network open, load `#/story` and confirm no `.wasm` request and no `runtime/` request fires, and no Worker appears under Application → Workers. The story must not boot the duel engine.

Walk the prologue

- [ ] Click New Game — the first narrative beat ("Rain turned …") renders with the utility bar (History, Save, Load, Settings, Pause).
- [ ] Press Enter repeatedly (about 13 times) until "Choose your response" appears, and confirm the first choice button takes focus on its own.
- [ ] Pick "I trust you" — the acknowledgment about earning trust appears.
- [ ] Press Enter until the "City signal map" heading appears, and confirm the earlier-choice line mentions your trust.
- [ ] Select Old Arena from the location list — the "Rin's Echo" briefing appears. Go back and select it again from the map hotspots — the same briefing appears.
- [ ] Click Start Duel — the mock "Existing duel experience placeholder" appears. This is expected: the real duel handoff is a later ticket.
- [ ] Click Simulate Player Win → "Signal broken" → Continue story → "Signal Cipher" reward, with an "Autosave complete" status.
- [ ] Click Continue to updated map — the map now says "Archive available".
- [ ] Click Save progress → Confirm overwrite — "Save complete" appears; close the dialog.
- [ ] Reload the page — the title screen offers Continue; click it and you land back on the updated map.
- [ ] Click End prototype — the end screen appears; confirm its buttons read "Replay from the title" and "Return to the updated map" (there is no launcher any more), and that Replay returns you to the title screen.

Overlays and layout

- [ ] From a narrative beat, open History, Settings, Save and Load in turn: each opens a dialog, focus lands on its Close button, Escape closes it, and focus returns to the button you opened it from.
- [ ] Confirm the Settings dialog no longer shows a "Reviewer state: …" line.
- [ ] Open the pause menu, press Shift+Tab then Tab — focus cycles inside the dialog and never escapes to the page behind it.
- [ ] Open Load, click "Delete manual slot 1" — the confirmation is the only modal on screen; Escape dismisses it and leaves the Load dialog open.
- [ ] Resize the window to a tall/narrow shape (about 375×667) on the map screen — no horizontal scrollbar, and every location button is at least 44×44 px.
- [ ] Resize to a wide window that is NOT 16:9 (for example 1920×1200) — the story stays inside the letterboxed stage; the "Open pause menu" button and any overlay must not spill into the black bars above or below the stage.

Nothing else regressed

- [ ] Open `#/duel` and play a few actions — the duel looks and behaves exactly as before; story styling has not leaked into its buttons or background.
- [ ] Open `#/decks`, create and edit a deck — the deck editor looks and behaves exactly as before.
- [ ] Open `#/admin` — the storage list shows a "Story progress" row; arm and confirm its reset, then check DevTools Application → Local Storage: `ygo.story.v1` is gone and `#/story` starts from a fresh title screen with no Continue.
- [ ] Confirm the browser console is empty across all of the above.

## T8 deck-editor-domain-migration

Reach the Deck Editor

- [ ] Run `npm run dev` (default `DEV_PORT=4300`) and open `http://localhost:4300/#/` — the home hub appears; click its "Decks" entry and the URL becomes `#/decks`.
- [ ] Open `http://localhost:4300/#/decks` directly — the "Deck Library" heading renders (an empty library says "No local decks"). The browser tab title reads "Deck Editor · YGO Story Duel Simulator", not "Deck Builder Prototype".
- [ ] Confirm there is NO "Prototype review states" panel in the bottom-right corner and no "State fixture" dropdown anywhere in the deck editor.
- [ ] Confirm the deck editor still looks exactly as it did before this ticket — this was a move, not a restyle.

Build and save a deck

- [ ] Click "Create deck", name it `Manual T8`, confirm — the editor opens with Catalog / Build deck / Select a card panels.
- [ ] Check the address bar: the URL is now `#/decks/<some-id>`, NOT `#/decks`.
- [ ] Type `Blue-Eyes` into the catalog Name search, drag "Blue-Eyes White Dragon" onto the Main Deck drop area — Deck counts shows `Main 1` and the Autosave chip reads "Saved locally".
- [ ] Press Undo then Redo — the count goes 0 then back to 1, and the deck stays "Saved locally".
- [ ] Focus the Main Deck card, press Space, then click "Drop picked card in Side Deck" — the card moves and the counts follow.
- [ ] Edit the "Deck name" field to `Manual T8 Renamed` and click elsewhere to blur — the name sticks.

Deep link, reload and Back

- [ ] Copy the `#/decks/<id>` URL, reload the page — the same deck reopens directly, without bouncing through the library.
- [ ] Press the browser Back button — you land on the library at `#/decks` and the editor is gone.
- [ ] Press Forward — the same deck reopens.
- [ ] Open `http://localhost:4300/#/decks/no-such-deck` — a "Deck not found" page appears with a "Back to Deck Library" link; click it and the library at `#/decks` renders with your decks intact.

Import and export

- [ ] From the library, click "Import YDK", set the deck name to `Manual T8 Import`, paste `#main` / `99999999` / `#extra` / `!side` (one per line) into "Or paste YDK text", click "Preview import" then "Replace deck cards" — the editor opens on the imported deck and shows a "Missing card 99999999" tile.
- [ ] Confirm the URL moved to that imported deck's `#/decks/<id>`, then reload — the missing-card tile is still there.
- [ ] Click "Export" in the editor — the dialog warns the deck is invalid; copy to clipboard, then Close.
- [ ] Back in the library, use the per-row "Export" action on another deck — the YDK text dialog opens for that deck and Close returns focus to the row.

Library CRUD

- [ ] From the library, "Duplicate" a deck — the copy opens in the editor and the URL points at the copy, not the original.
- [ ] Return to the library, "Rename" a deck — the renamed deck opens and the URL points at it.
- [ ] Return to the library, "Delete" a deck, confirm in the dialog — the row disappears; reload and confirm it stays gone.

Admin console jump

- [ ] Open `http://localhost:4300/#/admin`, click "Seed test deck & open it" — the editor opens directly on the seeded deck (name "Admin test deck") and the URL is `#/decks/admin-test-deck`.
- [ ] Back on `#/admin`, arm and confirm the "Deck library" reset, then click the `#/decks` route button — the library shows "No local decks".

Nothing else regressed

- [ ] Open `#/duel` and play a few actions — the duel looks and behaves exactly as before.
- [ ] Open `#/story` and click through a couple of beats — unchanged.
- [ ] Confirm the browser console is empty across all of the above.
