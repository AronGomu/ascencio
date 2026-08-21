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

## T12 list-dialog-upright-no-count-text

- [ ] Run `npm run dev`, open a duel, browse an opponent's Graveyard: confirm all cards render upright (title at top, art below).
- [ ] In a duel with a search/select-1-of-1 prompt, confirm the footer shows "0 / 1 selected" counter but NO "Select between 1 and 1 choices" text.

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
- [ ] Repeat the arm-then-confirm flow for each remaining row (Duel snapshots, Shell settings, Story saves): each one asks for a separate confirmation and reports "Cleared …" when done. (Corrected by T7: the story row exists. Corrected by T13: it is now labelled "Story saves" and deletes the `ygo-story-saves` database, not a local-storage key.)
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
- [ ] Open `#/admin` — the storage list shows a "Story saves" row; arm and confirm its reset, then check DevTools Application → IndexedDB: `ygo-story-saves` is gone and `#/story` starts from a fresh title screen with no Continue. (Corrected by T13: story progress moved out of local storage into IndexedDB, so this row and this DevTools panel replaced the old `ygo.story.v1` key.)
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
- [ ] Type `Blue-Eyes` into the catalog Name search, drag "Blue-Eyes White Dragon" onto the Main Deck drop area — the Main Deck collapse bar reads `1/40`. (Corrected 2026-08-20: the "Deck counts" panel became a per-zone count in each collapse bar, and the "Saved locally" autosave chip went with the rest of the header chrome. Autosave is now checked through **Load → Autosaves**, which gains an entry per edit.)
- [ ] Press Undo then Redo — the count goes `0/40` then back to `1/40`, and **Load → Autosaves** keeps gaining entries.
- [ ] Right-click the Main Deck card, then choose **Move to Side Deck** from the tap menu (portrait) or confirm the move via the context menu (desktop) — the card moves and the counts follow.
- [ ] Edit the "Deck name" field to `Manual T8 Renamed` and click elsewhere to blur — the name sticks.

Deep link, reload and Back

- [ ] Copy the `#/decks/<id>` URL, reload the page — the same deck reopens directly, without bouncing through the library.
- [ ] Press the browser Back button — you land on the library at `#/decks` and the editor is gone.
- [ ] Press Forward — the same deck reopens.
- [ ] Open `http://localhost:4300/#/decks/no-such-deck` — a "Deck not found" page appears with a "Back to Deck Library" link; click it and the library at `#/decks` renders with your decks intact.

Import and export

- [ ] From the library, click "Import Deck", set the deck name to `Manual T8 Import`, paste `#main` / `99999999` / `#extra` / `!side` (one per line) into "Or paste YDK text", click "Preview import" then "Replace deck cards" — the editor opens on the imported deck and shows a "Missing card 99999999" tile.
- [ ] Confirm the URL moved to that imported deck's `#/decks/<id>`, then reload — the missing-card tile is still there.
- [ ] With the imported deck open in the editor, click **Export** in the deck header — the dialog warns the deck is invalid; copy to clipboard, then Close.
- [ ] Open another deck and click **Export** — the YDK text dialog opens for that deck and Close returns focus to the Export button.

Library CRUD

- [ ] Open a deck and click **Duplicate** in the deck header — the copy opens in the editor and the URL points at the copy, not the original.
- [ ] Edit the deck-name input to rename the deck and blur — the new name is saved.
- [ ] Click **Delete** in the deck header, confirm in the dialog — you land on the library and the row is gone; reload and confirm it stays gone.

Admin console jump

- [ ] Open `http://localhost:4300/#/admin`, click "Seed test deck & open it" — the editor opens directly on the seeded deck (name "Admin test deck") and the URL is `#/decks/admin-test-deck`.
- [ ] Back on `#/admin`, arm and confirm the "Deck library" reset, then click the `#/decks` route button — the library shows "No local decks".

Nothing else regressed

- [ ] Open `#/duel` and play a few actions — the duel looks and behaves exactly as before.
- [ ] Open `#/story` and click through a couple of beats — unchanged.
- [ ] Confirm the browser console is empty across all of the above.

## T9 battle-facade

The duel now mounts through `src/battle/index.ts` instead of being imported
directly by the shell. Nothing about the duel itself changed, so every check
below is a "did the indirection cost anything?" check.

Reach the duel through the facade

- [ ] Run `npm run dev` (default `DEV_PORT=4300`) and open `http://localhost:4300/#/duel` — the deck picker appears exactly as before.
- [ ] Open DevTools → Elements and confirm `[data-cy="shell-region-duel"]` contains `[data-cy="battle-root"]`, which contains `[data-cy="app-main"]`.
- [ ] Confirm the duel field, right rail and card preview column sit in exactly the same places as before this ticket — the facade must not have moved a single pixel.
- [ ] Navigate from the home hub's "Duel" entry instead of the URL — same result.

Play a full duel unchanged

- [ ] Pick a non-default pair (e.g. Burning Abyss vs Shaddoll), click "Start duel" — the duel loads and the first prompt arrives.
- [ ] Play several actions, including a placement and an End turn — responses are accepted, one per prompt, with no double-submits.
- [ ] Open the right rail's options → Settings, toggle "Show duel HUD" and "Show workspace" on and off — both still work and the layout returns to normal.

End-of-duel paths still work

- [ ] Finish or force a duel to a result — the result dialog appears; click "Restart" and a fresh duel starts with the same decks.
- [ ] Start another duel, open options → Menu → Surrender and confirm — the duel ends and the result dialog appears.
- [ ] From the result dialog click "Change decks" — the deck picker returns.
- [ ] From the result dialog click "Download diagnostics" — a diagnostics file downloads and the "Diagnostics downloaded" message appears.

No leaked or duplicated Worker

- [ ] With a duel running, open DevTools → Sources → Threads (or the Performance panel's thread list) and note exactly ONE duel worker.
- [ ] Navigate away to `#/` (home), then back to `#/duel` — still exactly one duel worker, not two; the previous one is gone.
- [ ] Repeat the leave/return cycle three times — the worker count stays at one and memory does not climb with each cycle.
- [ ] Confirm the browser console is empty across all of the above.

Story-handoff placeholder

- [ ] Open `http://localhost:4300/#/duel/session/anything` — the standalone duel (deck picker) renders, and DevTools shows a visually hidden `[data-cy="battle-session-pending"]` marker inside the duel region. This is the placeholder T19 replaces with a real handoff; it is expected to look identical to `#/duel`.

## T10 domain-boundary-enforcement

This ticket adds no UI. It makes the ADR-022 domain boundaries machine-enforced,
so the only thing to confirm by hand is that the rules actually bite.

Confirm the rule fails on a real violation

- [ ] Create `src/deck-editor/__probe.ts` containing a single line:
      `import TitleScreen from "../story/screens/TitleScreen.svelte";`
- [ ] Run `npm run lint` — it exits non-zero and names the file with
      "Reach the visual novel through `src/story/index.ts` (ADR-022 domain boundary)".
- [ ] Run `npx vitest run tests/unit/domain-boundaries.test.ts` — `no deep cross-domain imports`
      fails and lists `src/deck-editor/__probe.ts -> src/story/screens/TitleScreen.svelte`.
- [ ] Delete `src/deck-editor/__probe.ts`, re-run both commands — both exit 0.
- [ ] In your editor, confirm the ESLint error also appears inline on the import line
      while the probe file exists.

Confirm a public API cannot widen silently

- [ ] Add `export const scratch = 1;` to `src/story/index.ts`.
- [ ] Run `npx vitest run tests/unit/domain-boundaries.test.ts` — `story public API is exact`
      fails, showing `scratch` as an unexpected export.
- [ ] Remove the line and re-run — 9 tests pass.

Nothing else regressed

- [ ] Open `#/duel`, `#/decks` and `#/story` in turn — all three still mount and behave
      exactly as in T7–T9; the browser console stays empty.

## T11 data-cy-contract-extension

Machine-verified: `tests/unit/data-cy-coverage.test.ts` now scans `src/battle/`, `src/shell/`,
`src/deck-editor/` and `src/story/` for presence, kebab-case and uniqueness.

Confirm the uniqueness check bites

- [ ] Change one `data-cy` in `src/story/screens/TitleScreen.svelte` to duplicate another in
      the same file (e.g. `story-title-tagline` → `story-title-heading`).
- [ ] Run `npx vitest run tests/unit/data-cy-coverage.test.ts` — `static data-cy values are
      unique across the contract roots` fails with
      `story-title-heading: src/story/screens/TitleScreen.svelte, src/story/screens/TitleScreen.svelte`.
- [ ] Revert the change and re-run — 32 tests pass.

Nothing else regressed

- [ ] Open `#/`, `#/decks`, `#/story` and `#/admin` — layout, styling and behaviour are
      unchanged; `data-cy` is a test hook only.

## T12 deck-production-database

The deck store moved from `ygo-story-duel-deck-builder-prototype` to
`ygo-story-decks`. On the first load after this ticket, any decks a player
already built are copied across, verified, and only then is the old database
deleted. That copy only ever runs against data that already exists, so it
cannot be exercised by opening a clean browser profile — every check below
needs a seeded prototype database.

Machine-verified: `tests/unit/decks/deck-database-migration.test.ts` covers the
absent / already-migrated / interrupted / diverged / empty / copy-failure /
verify-failure / delete-failure states, and
`e2e/deck-editor.spec.ts` → `a prototype deck database is migrated on first
load` runs the happy path in real Chromium. What follows is the human pass over
a real profile with real DevTools.

Seed a prototype deck database (pick ONE path)

- [ ] Path A — faithful. In a scratch worktree at the pre-ticket commit
      (`git worktree add /tmp/pre-t12 5ab14b8 && cd /tmp/pre-t12 && npm ci`),
      run `npm run dev` on the SAME port this branch uses (default
      `DEV_PORT=4300`, so same origin), open `http://localhost:4300/#/decks`,
      create a deck named `Survivor`, drag one Blue-Eyes White Dragon into the
      Main Deck, and wait for the autosave to land (**Load → Autosaves** lists
      it). Stop that dev server.
- [ ] Path B — fast. Run `npm run dev` on this branch, open
      `http://localhost:4300/#/decks`, and paste this into the DevTools console
      (it writes the OLD database with the OLD schema directly):

      ```js
      await (async () => {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open("ygo-story-duel-deck-builder-prototype", 1);
          r.onupgradeneeded = () => {
            const d = r.result.createObjectStore("decks", { keyPath: "id" });
            d.createIndex("updatedAt", "updatedAt");
            d.createIndex("name", "name");
            r.result.createObjectStore("histories", { keyPath: "deckId" });
            r.result.createObjectStore("preferences", { keyPath: "key" });
          };
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        const t = db.transaction(["decks", "histories", "preferences"], "readwrite");
        t.objectStore("decks").put({
          schemaVersion: 1, id: "survivor", revision: 1, name: "Survivor",
          main: [89631139], extra: [], side: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          validation: { status: "errors", issues: [], rulesetRevision: "prototype-2026-01" },
          importedNeedsReview: false,
        });
        t.objectStore("histories").put({
          deckId: "survivor", history: { undo: [], redo: [], nextSequence: 1 },
        });
        t.objectStore("preferences").put({ key: "last-opened-deck", value: "survivor" });
        await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
        db.close();
      })();
      ```

- [ ] Before reloading, open DevTools → Application → IndexedDB and confirm you
      can see `ygo-story-duel-deck-builder-prototype`. If `ygo-story-decks` is
      also listed with decks in it, right-click → Delete database first: a
      populated target is the "already migrated" case, not the one under test.

Confirm the decks survived the rename

- [ ] Run `npm run dev` on THIS branch and open `http://localhost:4300/#/decks`
      (a reload is enough if the server was already running).
- [ ] The Deck Library lists `Survivor`. It must NOT say "No local decks" —
      that would mean the decks were stranded in the old database.
- [ ] Click `Survivor` — the editor opens, "Deck name" reads `Survivor` and
      the Main Deck collapse bar reads `1/40`. Opening the deck reads its
      history record, so
      this also proves the migration copied more than the deck row.
- [ ] Press Undo — it is disabled or a no-op (the seeded history is empty) and
      nothing errors.
- [ ] DevTools → Application → IndexedDB: `ygo-story-decks` is present and
      `ygo-story-duel-deck-builder-prototype` is GONE. Use the refresh button on
      the IndexedDB node if the tree looks stale.
- [ ] In the console, `(await indexedDB.databases()).map((d) => d.name)` lists
      `ygo-story-decks` and does not list the prototype name.

Confirm it does not run twice

- [ ] Reload the page — `Survivor` is still listed exactly once. A second
      `Survivor` row would mean the migration re-ran and duplicated.
- [ ] Create a second deck named `After Migration`, reload — both decks are
      listed once each, and the prototype database has not reappeared.

Confirm a failed migration blocks instead of losing decks (optional, ~2 min)

- [ ] Re-seed the prototype database with Path B above, and this time also
      delete `ygo-story-decks` in DevTools.
- [ ] In a SECOND tab on the same origin, paste this and leave the tab open —
      it holds the old database open, which is what blocks its deletion:

      ```js
      window.hold = await new Promise((res, rej) => {
        const r = indexedDB.open("ygo-story-duel-deck-builder-prototype", 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      ```

- [ ] Back in the first tab, load `#/decks`. Instead of the library you get a
      blocking panel headed "Your decks were not moved", explaining the
      prototype database could not be deleted, reassuring you nothing was
      deleted, and offering a "Retry" button.
- [ ] DevTools: BOTH databases exist, and `ygo-story-decks` already contains
      `Survivor`. Nothing was lost.
- [ ] Close the second tab, click "Retry" in the first — the library renders
      with `Survivor`, and the prototype database is now gone.

Admin console follows the rename

- [ ] Open `http://localhost:4300/#/admin`, click "Seed test deck & open it" —
      the editor opens on "Admin test deck". DevTools shows that deck inside
      `ygo-story-decks`, and no prototype database was created.
- [ ] Back on `#/admin`, arm and confirm the "Deck library" reset, then open
      `#/decks` — the library says "No local decks", and DevTools shows
      `ygo-story-decks` is gone. Before this ticket this button cleared the
      prototype database, so a reset that leaves your decks in place is the
      failure to watch for.

Nothing else regressed

- [ ] Deck create / rename / duplicate / delete / import YDK / export YDK all
      behave exactly as in T8.
- [ ] Open `#/duel` and `#/story` — unchanged; neither reads the deck database.
- [ ] The browser console stays empty across all of the above.

## T13 story-saves-repository

Story progress moved out of the single `ygo.story.v1` local-storage record into
an IndexedDB database, `ygo-story-saves`, holding one versioned record per
slot. Prototype progress under the old key is deliberately **not** migrated: a
player who used the story before this ticket starts from a fresh title screen,
and a leftover `ygo.story.v1` entry is expected and harmless.

The save/load overlays are unchanged, so they still drive the single manual
slot — which is now stored as `manual:1`. The store also carries `manual:2`,
`manual:3` and `checkpoint:pre-duel`; nothing writes those three yet (the duel
handoff is T19), so an empty `manual:2` in DevTools is correct.

Machine-verified: `tests/unit/story/story-save-repository.test.ts` covers the
round trip, revision increments, stale-write refusal, unknown schema version,
corrupt records, a quota failure, a write that aborts mid-transaction, and an
unusable IndexedDB. `e2e/story.spec.ts` covers save → reload → load and
corrupt-slot recovery in Chromium. The checks below are the ones a machine
cannot make: that the DevTools panel shows what you expect and that the app
still feels right.

Run `npm run dev` and use `http://localhost:5173` (or the port Vite prints).

Where to look in DevTools

- [ ] Open DevTools → Application → Storage → IndexedDB. Before touching the
      story there is no `ygo-story-saves` database (delete it first if a
      previous run left one).
- [ ] Open `#/story` and let the title screen render. Refresh the IndexedDB
      panel — `ygo-story-saves` now exists with one object store, `saves`,
      and no records. Opening the story must never create a save on its own.

A save survives a reload

- [ ] Click "New Game", advance a few beats with Enter, and note the line of
      dialogue currently on screen.
- [ ] Click "Save", then "Confirm overwrite" — the overlay reports "Save
      complete. Manual slot 1 updated."
- [ ] In DevTools → IndexedDB → `ygo-story-saves` → `saves`, refresh: there is
      exactly one record, keyed `manual:1`. Expand it — it has
      `schemaVersion: 1`, `slot: "manual:1"`, `revision: 1`, a `savedAt`
      timestamp, and a `state` object whose `narrativeIndex` matches how far
      you advanced.
- [ ] Reload the page (F5). The title screen now offers "Continue".
- [ ] Click "Load", then "Load manual slot 1" — you land on the same beat you
      noted above, not back at the start.
- [ ] Save again from the same spot and re-check the record: still exactly one
      `manual:1` record, now `revision: 2`. A second record, or a record list
      that keeps growing, is the failure to watch for.

The autosave slot is separate

- [ ] Play through to a duel (map → Old Arena → Start Duel → Simulate Player
      Win → Continue story). The reward screen reports "Autosave complete at
      stable story boundary."
- [ ] In DevTools there are now two records: `manual:1` and `autosave`. Neither
      `manual:2`, `manual:3` nor `checkpoint:pre-duel` exists.
- [ ] Reload and click "Continue" — you resume from the autosave (the updated
      map), because it was written more recently than the manual save.

A corrupt save costs you the slot, not the app

- [ ] With the story open, paste this into the DevTools console:
      `indexedDB.open("ygo-story-saves",1).onsuccess=e=>{const d=e.target.result;d.transaction("saves","readwrite").objectStore("saves").put("garbage","manual:1");}`
- [ ] Reload the page. A red banner appears naming `manual:1` and the reason;
      the title screen still renders and "New Game" still plays. A blank screen
      or a thrown error in the console is the failure to watch for.
- [ ] Click "Reset prototype storage" in that banner — the banner clears and
      DevTools shows the `saves` store is empty again.

Admin console clears it

- [ ] Open `#/admin`. The storage list has a "Story saves" row (there is no
      longer a "Story progress" row).
- [ ] Save some story progress first, then arm and confirm the "Story saves"
      reset. The console reports it cleared.
- [ ] In DevTools → Application → IndexedDB, `ygo-story-saves` is gone — not
      merely empty. Open `#/story`: the title screen has no "Continue".
- [ ] Do the same reset **while `#/story` is open in a second tab**, then
      switch to that tab and reload — it comes up on a fresh title screen
      rather than hanging. A tab that holds the database open must not block
      the reset indefinitely.

Nothing else regressed

- [ ] Play the prologue end to end once: title → narrative → choice → map →
      Old Arena → duel mock → outcome → reward → updated map → End prototype.
- [ ] Open the pause menu, History, Settings, Save and Load overlays — each
      opens, traps focus, closes on Escape, and returns focus to the button
      that opened it.
- [ ] Open Load and delete manual slot 1 — the confirmation closes, the slot
      reads "Manual slot 1 · Empty", and the `manual:1` record is gone from
      DevTools while `autosave` is untouched.
- [ ] Open `#/duel` and play a few actions, and `#/decks` and edit a deck —
      both behave exactly as before; neither reads or writes `ygo-story-saves`.
- [ ] The browser console stays empty across all of the above.

## T14 deck-editor-portrait-layout

Below 1024px CSS width the deck editor is no longer a dead end: it drops the
three-column desktop grid for a single tabbed pane (Catalog / Deck / Details)
with a persistent header, and adds a touch model — tap a catalog card to add
it, tap a deck card to open a move/remove menu. At and above 1024px absolutely
nothing changes; that is the main thing to confirm.

Use a real browser window resize or DevTools device toolbar. The breakpoint is
CSS width, so a landscape phone under 1024px also gets tabs.

Tabs and the persistent header (390x844)

- [ ] Open `#/decks`, create a deck named "Portrait Manual", and shrink the
      window to 390x844. The editor opens on the **Deck** tab; the "Desktop
      viewport required" screen is gone for good.
- [ ] The header above the tabs shows deck name, Main/Extra/Side counts, the
      deck status and the autosave status. Switch to Catalog and then Details —
      the header stays put and keeps showing the same counts on every tab.
- [ ] Exactly one pane is on screen at a time: on Catalog the deck grid is
      absent, not merely scrolled away.
- [ ] Tab the keyboard focus into the tab strip and press Left/Right arrows —
      the selection follows focus through Catalog, Deck, Details and wraps.

Tap to add (390x844)

- [ ] On the Catalog tab, filter by "Blue-Eyes" and tap the card. The Main
      count goes to `1/40`, **Load → Autosaves** gains an entry, and you are
      still on the Catalog tab so the next card is one tap away.
- [ ] Tap the same card twice more (Main 3), then tap it a fourth time. Nothing
      is added; the app announces "Copy limit 3 reached" and shows you the card
      on the Details tab.
- [ ] Filter for "Gate Guardians Combined" (a Fusion monster) and tap it — it
      lands in the **Extra** Deck, not the Main Deck.

Tap to move and remove (390x844)

- [ ] On the Deck tab, tap a card sitting in the Main Deck. A menu opens naming
      the card. It offers Side Deck (enabled), Extra Deck (disabled, with a
      reason) and Remove; it does **not** offer Main Deck.
- [ ] Choose Side Deck — Main drops by one, Side rises by one.
- [ ] Tap the card in the Side Deck: this time Main Deck is enabled (its home
      zone) and Extra is not. Press Escape instead of choosing — the menu closes
      and nothing moved.
- [ ] Tap it again and choose Remove — the count drops. Press Undo in the
      header: it comes back. Press Redo: it goes again. Autosave keeps running
      throughout — **Load → Autosaves** gains an entry per edit.

Layout at the sizes that matter

- [ ] At 360x640, 390x844 and 768x1024 in turn: no horizontal scrollbar and no
      content clipped at the right edge, on all three tabs. The header wraps
      onto more rows rather than pushing the page sideways.
- [ ] Rotate to landscape under 1024px wide (e.g. 844x390) — still tabs, still
      no sideways scroll.
- [ ] Tap targets are comfortable: tabs, menu items and card tiles are all
      easily hit with a thumb (44px floor).
- [ ] Navigate back to the library at 390x844 — "Import Deck" and the per-row "Export" action are accessible from the library and still work. (Import/Export moved to the library menu in T4 — no Import/Export buttons exist in the editor header.)

Desktop is untouched (1440x900)

- [ ] Widen to 1440x900. All three panels are back side by side, with no tab
      strip anywhere.
- [ ] Click a catalog card — it only **selects** (details fill the right panel).
      No card is added and no tap menu appears. Adding is still drag or the
      keyboard pick-and-drop path.
- [ ] Drag a card from the catalog into the Main Deck drop area — works as
      before. Right-click a Main Deck card — the context menu removes it;
      right-click a catalog card — the card is added to its canonical zone.
- [ ] Undo/redo, rename and the Deck Library round trip all behave exactly as they did before this ticket; import and export remain accessible from the library menu (moved in T4).
- [ ] Resize from 1440 wide down past 1024 and back up without reloading — the
      editor swaps between panels and tabs each way, keeping the open deck and
      its edits.

## T15 duel-portrait-rotation

Below 1024px CSS width, a **portrait** viewport now plays the duel on a stage
turned a quarter turn clockwise. Landscape below the breakpoint, and every
desktop size, are deliberately unchanged.

Setup

- [ ] Use a real phone if you have one (or Chrome DevTools device toolbar,
      iPhone 12 Pro / 390x844). Hold it **upright**.
- [ ] Clear site data first, so the one-time rotation notice is still pending.
- [ ] Open `#/duel`.

Portrait: the turn itself (390x844)

- [ ] The deck picker is reachable: scroll the duel area if needed and press
      Start. Nothing is clipped out of reach.
- [ ] Once the duel loads, the board runs **down** the long axis of the phone —
      the player's side is on one long edge, the opponent's on the other. To
      read it you tilt your head (or the phone), not squint at a shrunken board.
- [ ] The board is centred: neither end of the field is cropped by the screen
      edge, and there are equal bars above and below it.
- [ ] The page itself never scrolls in any direction — no page scrollbar, and
      dragging a finger on the background does not move the page.

Portrait: taps land where you look (this is the row that matters)

- [ ] Tap a monster zone. The zone **you touched** reacts — not the one that
      would be there if the board were unturned (that would be a zone roughly a
      quarter turn away).
- [ ] Tap several cards in your hand, one at a time. Each time, the card under
      your finger is the one that previews/selects. Work along the whole hand,
      including the cards nearest each screen edge.
- [ ] Tap a graveyard/deck pile. The pile under your finger opens.
- [ ] Tap an action chip on a card. The chip under your finger fires, and not a
      neighbouring one.

Portrait: dragging, hands, dialogs and overlays

- [ ] Drag a card from your hand onto a highlighted zone. Two things must both
      be true: the ghost card **stays under your finger** the whole way (it must
      not shoot off at right angles to your movement), and the card is played
      into the zone you dropped it on.
- [ ] Drag a card and release it over nothing. The ghost settles back onto the
      card it came from, not onto some other part of the board.
- [ ] Swipe the hand band sideways (along the hand's own direction, as drawn).
      It scrolls, and the overlay scrollbar thumb tracks your finger rather than
      running the opposite way.
- [ ] Drag the overlay scrollbar thumb itself. The band scrolls the way you
      drag it.
- [ ] Open the zone-list / decision window and drag it by its handle. It follows
      your finger; it does not travel at right angles to the drag, and it stays
      clamped inside the board.
- [ ] Open a dialog/backdrop (e.g. a duel result or prompt dialog). It covers
      the board and reads the same way up as the board, not the phone.
- [ ] Trigger a target/attack line (attack or target something). The line is
      drawn between the two cards involved, not across the board at a right
      angle.

Portrait: the rotation notice

- [ ] The one-time notice explaining the turn is visible when you first arrive.
- [ ] It does not block play: tap the board *through* the notice's background —
      the card/zone underneath still responds. Only its "Got it" button
      intercepts a tap.
- [ ] Press "Got it". The notice disappears.
- [ ] Reload the page in portrait. The notice does not come back.

Keyboard (portrait, with a bluetooth keyboard or in DevTools)

- [ ] Tab through the duel controls. The order is the same as on desktop — the
      turn changed nothing about the sequence.
- [ ] Arrow-key navigation across the field still moves between controls, and
      the focus ring is visible on the control that has focus.

Reduced motion

- [ ] Enable "reduce motion" in the OS/browser. Reload in portrait. Nothing
      animates the turn, and the rotation notice appears without a fade.

Unchanged: small landscape (844x390)

- [ ] Turn the phone sideways (or set 844x390). The board is **not** turned — it
      is the ordinary 16:9 stage, scaled down, exactly as before this ticket.
- [ ] No rotation notice appears in landscape.
- [ ] (Known, pre-existing and out of scope: at this size the deck picker screen
      is taller than the stage, so Start can sit below the visible area. This is
      unchanged by this ticket — only portrait gained a scrollable duel region.)

Unchanged: desktop (1440x900 and 1920x1080)

- [ ] The duel looks and behaves exactly as before: same field size, same
      spacing, same preview panel and right rail.
- [ ] Drag a card onto a zone — ghost, drop and settle behave exactly as before.
- [ ] Drag the decision window by its handle — it follows the pointer exactly
      as before.
- [ ] Target/attack lines are drawn exactly as before.

## T16 unified-visual-restyle

### `#/` Home screen — desktop (1920×1080)
- [ ] Home screen background and typography match the duel dark-blue-teal palette; no white or light-mode remnants.
- [ ] Buttons use the consistent token-driven style (teal primary, transparent secondary).
- [ ] Focus ring is amber (`--focus-ring: #f6c177`) when tabbing through navigation links.

### `#/` Home screen — portrait (390×844)
- [ ] Layout remains readable; colours and typography unchanged from desktop palette.

### `#/story` Visual novel — desktop
- [ ] Background gradients derive from the duel palette (dark navy blues and teals); no bright alien colours.
- [ ] Dialogue box uses `var(--bg)` with ~91% opacity — dark background, legible white text.
- [ ] Speaker name tag has dark `var(--surface-chain)` background and `var(--accent)` teal text.
- [ ] Thought-bubble left border is purple (`var(--stack-accent): #9f8deb`).
- [ ] Story buttons match global style: teal fill, dark text, amber focus ring.
- [ ] Pause/overlay backdrop is near-black with slight transparency.
- [ ] Overlay panel uses `var(--surface-raised)` — same dark-navy as duel side panels.

### `#/story` Visual novel — portrait (390×844)
- [ ] Dialogue box fills width correctly; text remains legible on dark background.
- [ ] Choice buttons stack and are fully tappable (≥44px targets).

### `#/decks` Deck editor — desktop
- [ ] Card tiles: normal state uses dark navy (`var(--surface-raised)`), hover/selected uses slightly lighter `var(--surface-highlight)` with teal border.
- [ ] Card limit badges: 0-limit is burgundy (`var(--danger-border)`), 1-limit is pink (`var(--danger)`), 2-limit is gold (`var(--selected)`), 3-limit is teal (`var(--accent)`).
- [ ] Filter/search inputs have dark navy background (`var(--surface-chain)`) with legible white text.
- [ ] Validation warning panel uses `var(--warning-surface)` background with `var(--warning-border)` border (amber tones).
- [ ] Error states (missing card, import error) use `var(--danger-surface)` background.
- [ ] Dialog panels use `var(--surface)` background with dark shadow.

### `#/decks` Deck editor — portrait (390×844)
- [ ] Tab mode (card catalog / workspace / zones) switches work; pane heights correct.
- [ ] No colour regressions in portrait tab layout.

### `#/duel` Duel field — desktop
- [ ] Field geometry (card sizes, zone sizes, spacing, gaps) unchanged from pre-T16 baseline.
- [ ] Legal zones are green (`var(--legal): #7ee2a8` border + glow).
- [ ] Selected zones/cards are amber-gold (`var(--selected): #ffd580` border + glow).
- [ ] Keyboard nav focus ring is white (`var(--ink)`), distinct from legal/selected.
- [ ] Feedback halos are teal (`var(--accent)`).
- [ ] Attack lines are red (`var(--danger)`), default lines are teal (`var(--accent)`).
- [ ] Card limit badge colours on field cards look right (green/pink/gold/teal).

### `#/duel` Duel field — portrait (390×844)
- [ ] Field rotates 90° clockwise (T15 behaviour preserved).
- [ ] Field geometry in rotated mode unchanged; zone targets remain tappable.
- [ ] Semantic colours (legal/selected) unchanged in rotated mode.

### `#/admin` Admin console — desktop
- [ ] Panel renders with dark-blue token-driven background; no visual regressions.
- [ ] Inputs and buttons consistent with the rest of the product.

### Cross-domain coherence check
- [ ] Navigating `#/ → #/story → #/decks → #/duel → #/admin` feels like one product — consistent dark palette, button style, focus ring, typography throughout.
- [ ] No jarring colour shifts between domain transitions.

## T17 worker-card-list-start-contract

The Worker now starts a duel from an explicit validated card list as well as
from a bundled preset. No UI produces a card list yet (the deck picker is a
later slice), so the checks below are: the preset path must be indistinguishable
from before, and a forged illegal list must fail visibly instead of starting a
broken duel.

### `#/duel` Preset duel unchanged
- [ ] Pick any deck pair in the picker and press Start — the duel initializes and the first prompt appears exactly as before.
- [ ] Play a few prompts, then Restart — the duel restarts and reaches a first prompt again.
- [ ] Surrender — the duel ends with the usual surrender result, no error banner.
- [ ] Reload the page with a pair already chosen — the duel auto-starts as before.

### Invalid card list fails visibly
No UI can build a card list yet, and the app exposes no console handle on the
duel Worker, so this check needs one temporary edit. In
`src/battle/app/stores/duel-store.ts`, inside `startCurrentDuel`, replace the player
argument passed to `client.startDuel` with a forged list whose last code is not
in the packaged snapshot, run `npm run dev`, open `#/duel`, and press Start:

```ts
// TEMPORARY — revert after this check
{
  kind: "cards",
  main: [...Array.from({ length: 39 }, (_, i) => 46986414 + (i % 3)), 909090],
  extra: [],
  side: [],
}
```
- [ ] The duel does **not** start: no field appears and no prompt arrives.
- [ ] A visible error is shown (not a silent no-op, not a blank screen, not a stuck loading state).
- [ ] The error text names the offending code `909090` and says the card is outside the active snapshot.
- [ ] After the refusal, revert the edit, reload, choose a normal preset pair and press Start — it still works, and the Worker was not left wedged.

### Hidden information
- [ ] With a duel running, nothing in the DevTools console, network tab, or Worker message log shows the opponent's deck list — only counts (deck size, extra-deck size) and cards the opponent has actually revealed on the field.

## T18 deck-picker-local-decks

The pre-duel picker now offers bundled decks **plus every local deck this build
can actually play**, and starting a local deck dispatches its card list to the
Worker instead of a preset id.

Corrected 2026-08-16 by T22: this section originally said no local deck could
ever qualify on this build, because the deck editor built from a 24-card
hand-written catalog while the packaged art covered the six bundled decks
(120 codes) — only 8 cards in both, capped below the 40-card Main minimum. The
editor now derives its catalog from the packaged set itself, so a deck you can
build is a deck this build can draw. Widened again 2026-08-20 by T12 and T13 of
decks-feedback-round-2: T12 made the **editor's** catalog the whole card database
(14,794 codes), fetched from the runtime assets rather than compiled into the
bundle, and T13 made the **picker** read that same catalog. Between the two the
claim above was briefly false — the editor offered 14,794 cards while the picker
still filtered against ~120 packaged codes — so use T13's section for the current
behaviour. Narrowed again by R1: the editor offers 14,551 of those codes, the
243 Tokens excluded (`## R1 round-2-review-fixes`); the picker still reads all
14,794. **Every step below that expected a local deck to be hidden has been
rewritten accordingly**; see `## T22 local-deck-playability` for the full flow.

### `#/duel` Bundled flow unchanged
- [ ] Open `#/duel`. The picker appears with a **Bundled decks** group holding all six decks in both columns, and no empty "Your decks" heading anywhere.
- [ ] The picker is never briefly empty and Start is never briefly disabled while the page settles.
- [ ] Pick a pair, press Start — the duel initializes and reaches the first prompt exactly as before.
- [ ] Reload with a pair already chosen — the same pair is still selected.
- [ ] Surrender, then Change decks — the picker returns with the same pair selected and does not auto-start.

### Build a deck and duel with it
- [ ] Go to `#/decks`, create or import a deck, and fill the Main Deck to 40 legal cards so the editor reports no errors.
- [ ] Go to `#/duel`. The deck appears under **Your decks**, can be picked for either or both seats, and Start runs a duel whose opening hand is drawn from those cards.

### A deck the ruleset refuses is never offered
- [ ] In `#/decks`, build a deck with only 39 Main cards (or 4 copies of one card).
- [ ] Go to `#/duel` — the deck is absent from the picker. It is not shown greyed out, and there is no message about it.
- [ ] Return to `#/decks` — the deck is exactly as you left it. Nothing was renamed, repaired, re-saved, or deleted to make it playable.

### No local decks at all
- [ ] Open `#/admin`, click **Reset Deck library** and confirm, so no local deck exists.
- [ ] Go to `#/duel` — only the Bundled decks group renders. There is no "Your decks" heading, no empty list, and Start still works.

### A chosen deck that disappears
- [ ] With a local deck selected in the picker (or seed the same effect by editing `ygo.ui.v2` in localStorage and setting `decks.playerKey` to `local:no-such-deck:1`), reload `#/duel`.
- [ ] The picker falls back to the default bundled pair, and a single notice explains that a deck you had chosen is no longer available.
- [ ] The notice appears **once** — clicking any deck clears it, and it does not come back on the next click.
- [ ] Start then runs the bundled pair normally.

### Persistence shape
- [ ] After choosing a pair, `localStorage["ygo.ui.v2"]` holds `decks: { playerKey: "preset:…", opponentKey: "preset:…" }` — keys, not bare deck ids, and never a copy of any card list.
- [ ] A payload written by an older build (`decks: { player: "nekroz", opponent: "shaddoll" }`) still loads with that pair selected.
- [ ] Display settings survive: toggle zone outlines off in `#/duel`, reload, and confirm they are still off (the payload version stays `2` precisely so the shell's settings migration keeps working).

## T19 story-duel-handoff

The visual novel stops mocking battles. Starting an encounter writes a
verified pre-duel checkpoint, hands the duel to the shell on a route of its
own (`#/duel/session/{handoffId}`), and takes exactly one result back.

### Start an encounter and play it
- [ ] Open `#/story`, play (or load) through to the **City signal map**, and click **Old Arena**.
- [ ] The briefing reads "Your progress is saved before the duel starts." There are no reviewer or "Simulate …" buttons anywhere in the story.
- [ ] Click **Start Duel**. The address bar changes to `#/duel/session/<id>` and the story screen is replaced by the duel.
- [ ] The **deck picker** appears, with the pair you last used already selected (bundled `mvp-player` / `mvp-opponent` on a fresh profile).
- [ ] Press **Start** — the duel loads and reaches the first prompt exactly as `#/duel` does.

### Each outcome branch
- [ ] **Surrender** (right rail → Options → Surrender → confirm). The story comes back on "Duel paused", the address bar returns to `#/story`, and no reward is granted. **Return to map** puts you back on the map with your progress intact.
- [ ] **Win** the duel. The story shows "Signal broken", then **Continue story** reveals the Signal Cipher reward, and **Continue to updated map** opens the Archive route.
- [ ] **Lose** the duel. The story shows "Signal endures" — a different scene from the win — and still continues to the reward.
- [ ] **Technical failure:** with a duel running, open DevTools → Application → Service/Workers (or the Sources ▸ Threads panel) and terminate the duel Worker. The story shows "Connection interrupted" and says this is not an authored loss. It must **never** show "Signal endures". **Retry duel** starts a fresh duel from the picker.

### Reload mid-duel (the crash-safety check)
- [ ] Start a story encounter and press Start so a duel is actually running.
- [ ] Reload the page (F5) while the duel is on screen.
- [ ] The address bar still holds the same `#/duel/session/<id>`, and the same encounter restarts — the deck picker comes back, not a blank screen and not the title screen.
- [ ] Finish or surrender that duel: the story resumes with the progress you had before the duel, not from the beginning.

### A checkpoint that cannot be trusted
- [ ] Paste `#/duel/session/does-not-exist` into the address bar. You land on `#/story` with the story's last stable state — never a blank screen and never half a duel.
- [ ] In DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`, replace the `checkpoint:pre-duel` value with the string `not a checkpoint`, then open a session route. You land on `#/story`; the other slots (`manual:1`, `autosave`) are untouched and still load.
- [ ] Edit `checkpoint:pre-duel`'s `state.pendingHandoffId` to a different id and open the original session route. You land on `#/story` rather than resuming someone else's duel.

### Checkpoint write failure
- [ ] In DevTools → Application → Storage, set a tiny quota (or use a private window with storage blocked), then start an encounter.
- [ ] **No duel starts.** The story shows "The duel did not start" with the reason and a **Try again** button. **Try again** re-runs the whole handoff; **Return to map** goes back safely.

### The other two domains are untouched
- [ ] `#/duel` still opens the standalone duel, and finishing or surrendering there does **not** navigate anywhere.
- [ ] `#/decks` is unchanged.
- [ ] Opening `#/duel` on a fresh profile does not download the story chunk (DevTools → Network, filter `story`).

## T20 duel-source-relocation

Pure file move: the duel's source now lives under `src/battle/` (`app/`, `duel/`,
`field/`, `worker/`, `storage/`). No behavior changed, so this is a short
"nothing fell off the shelf" pass. Run `npm run dev` first.

- [ ] `#/duel` loads, the deck picker appears, **Start** reaches the first prompt,
      and a card can be played. That proves the Worker entry still resolves after
      the move — it is the one thing a wrong path would break silently.
- [ ] Rotate to portrait (DevTools device toolbar, 375×667). The duel still shows
      the rotated stage and the rotation notice, and taps land on the card you
      aimed at rather than an offset one.
- [ ] `#/story` → start an encounter → **Start Duel**. The duel opens and the
      story resumes after you surrender.
- [ ] `#/decks` opens and a deck can be edited and saved.
- [ ] Acceptance harness: `npx playwright test --config=playwright.acceptance.config.ts`
      is green, or open `acceptance.html?scenario=field-emz` from a preview build
      and confirm the deterministic field renders.
- [ ] DevTools → Network on a fresh load of `#/`: the duel chunk is **not**
      downloaded until you open `#/duel`.

## T21 restore-build-budgets

Build-gate change only; nothing in the app moved. The whole check is one command.

- [ ] `npm run build` finishes green and its last block prints the four
      measurements, e.g. `"chunkBytes": { "shell": 78142, "battle": 405950,
      "deck-editor": 101881, "story": 60195 }`. `npm run build:verify` alone
      re-checks an existing `dist/` without rebuilding.
- [ ] A breach fails the build with the offending budget named and both numbers
      shown, e.g.
      `Error: battle domain closure exceeds its production budget: 501234 > 488750 bytes`.
      A domain chunk missing from the build fails the same way rather than
      counting as zero: `Browser build did not emit the story domain chunk`.
- [ ] The ceilings live in `scripts/lib/domain-chunk-closure.ts` (per domain)
      and `scripts/verify-browser-build.ts` (shell). Raising one means
      re-measuring from a clean build, not nudging the number until it passes.

## T22 local-deck-playability

A deck you build in `#/decks` can now be played at `#/duel`. Nothing about the
picker's filter changed — it still shows a local deck only when `resolveDeck`
calls it `ready` and every code in it is one this build can draw. What changed
is the editor's catalog: it used to be a 27-card hand-written fixture that
barely overlapped the packaged art, and it is now derived at build time from
the packaged card set itself. The editor offers **120 cards — 85 Main-deck and
35 Extra-deck** — and every one of them has packaged art and text, so a legal
deck is by construction a drawable one.

Sanity numbers to expect while testing: 85 Main-deck cards at up to three
copies each is 252 possible Main cards against a 40-card minimum, and the
catalog's search/filter panel now lists real Attributes, Races and subtypes
rather than the fixture's handful.

Corrected 2026-08-20 by T12 and T13 of decks-feedback-round-2: the two
paragraphs above are superseded. Both surfaces now read the whole packaged
database — **14,794 cards**, not 120 — fetched from the runtime assets. The
picker's filter still has the shape described (`resolveDeck` says `ready` **and**
every code is one this build can draw), but "can draw" now means the whole
database rather than the art-backed subset, so art coverage no longer decides
what is playable. The steps below still pass; only the numbers moved.

### Build a deck from scratch and duel with it
- [ ] Open `#/decks`. Press **Create deck**, name it (e.g. `Manual T22`), confirm with **Create**.
- [ ] The catalog panel lists real cards — search `Nekroz`, `Shaddoll`, `Spellbook` or `Burning Abyss` and each returns several distinct cards with names and effect text.
- [ ] Add cards until the Main Deck collapse bar reads `40/40`. Fastest route: search a card name, then right-click the catalog tile to add it directly; repeat, or drag tiles onto the Main Deck drop area.
- [ ] The validation panel shows no **errors**. Warnings such as "Extra Deck is empty" and "Side Deck is empty" are expected and do not block anything. (Corrected 2026-08-20 by T12 of decks-feedback-round-2: the "uses placeholder art" warning was deleted, because art coverage describes the build's images rather than a defect in your deck. If you still see one, the slice regressed.)
- [ ] Confirm the autosave landed: **Load → Autosaves** lists a fresh entry.
- [ ] Go to `#/duel`. The deck list holds a **Your decks** group below **Bundled decks**, with `Manual T22` in it. (Superseded by T15: one list for the player seat only, and the opponent is a fixed line rather than a column.)
- [ ] Pick `Manual T22` in the deck list. It becomes the selected row, and no start error appears.
- [ ] Press **Start**. The duel initializes and reaches the first prompt — the field renders, both life-point totals are up, and your hand is drawn from the cards you picked, not from a bundled deck.
- [ ] Hover a card in your hand: the preview panel shows that card's real name and effect text.
- [ ] Surrender, then **Change decks** — `Manual T22` is still selected and the picker does not auto-start.

### Import a YDK and duel with it
- [ ] From `#/decks`, press **Import deck** in the library, give it a name, and paste a `#main` list of 40 codes taken from the editor's own catalog.
- [ ] **Preview import** reports no unknown codes.
- [ ] **Commit** — the deck opens in the editor and saves.
- [ ] `#/duel` offers it under **Your decks**, and Start duels with it.

### The filter still refuses what it should
- [ ] In `#/decks`, build a deck with only 39 Main cards (or four copies of one card).
- [ ] `#/duel` does not list it. It is absent, not greyed out, and there is no message about it.
- [ ] Return to `#/decks` — the deck is exactly as you left it. Nothing was renamed, repaired, re-saved or deleted to make it playable.
- [ ] Import a YDK holding a code the editor does not know (e.g. `99999999`). Preview flags it as unknown, and a deck saved with it is never offered at `#/duel`.

### Bundled decks are unaffected
- [ ] With no local deck at all (use `#/admin` → **Reset Deck library**), `#/duel` renders only the **Bundled decks** group — no empty "Your decks" heading — and Start works. (Superseded by T15: opening `#/duel` now seeds a "Starter Deck", so a **Your decks** group holding exactly that one deck is the expected state here.)
- [ ] Pick a bundled deck and duel: unchanged from before this slice.

### Build gate
- [ ] `npm run build` finishes green. Its last block prints roughly
      `"chunkBytes": { "shell": 78321, "battle": 365853, "deck-editor": 150849, "story": 60195 }`.
- [ ] The deck-editor domain grew because it now ships the packaged card set
      (~58 kB of masks plus names and effect text, in a chunk it shares with the
      duel); its budget was raised deliberately from 143,750 to 201,250 bytes in
      `scripts/lib/domain-chunk-closure.ts`. The battle domain *shrank* from
      405,950 to 365,853 because the same change ended a three-way duplication
      of the card-text manifest inside its closure; its ceiling was not touched.

## T1 catalog-real-card-art

- [ ] Run `npm run dev`, open `http://localhost:5173/#/decks`.
Corrected 2026-08-20 by T12 of decks-feedback-round-2: the catalog is the whole
card database now, and only the cards this build packaged art for have an image.
A glyph placeholder is therefore the **majority** case in a production build, not
a defect. `npm run dev` still serves ~14.5k local images, so run this section
against `npm run dev` to see real art.

- [ ] Open a saved deck in the editor; confirm card tiles display real card art (jpg images, not glyph placeholders).
- [ ] Search the catalog for a known card (e.g. "Blue-Eyes White Dragon"); confirm the result tile shows the card image.
- [ ] Click a card to open the detail/preview panel; confirm the art renders at full preview size. (Since T6 of decks-feedback-round-2, a desktop click also edits the deck — hover to preview without editing, or press Undo afterwards.)
- [ ] Confirm cards this build packaged no art for show the glyph placeholder rather than a broken image.

## T2 shared-card-preview-panel

- [ ] `npm run dev`, open `http://localhost:5173/#/duel`, start a duel.
- [ ] Hover a card in hand and on the field: the preview panel shows art, name and effect text exactly as before this slice.
- [ ] Hover a face-down card: the panel shows "Face-down card" with no art request.
- [ ] Long effect text: the panel's custom overlay scrollbar appears, drags with the mouse, and `Home` / `End` / `PageUp` / `PageDown` scroll the focused text region.
- [ ] Rotate to a portrait phone viewport (device toolbar, e.g. 390x844) so the duel stage takes its quarter turn: dragging the preview scrollbar thumb and the hand-band scrollbar thumb still follows the finger along the visible axis, not a quarter turn away from it.
- [ ] Hand band scrolls with a full hand and its overlay scrollbar behaves as before.
- [ ] Switch to `#/decks` and back to `#/duel`: no console error about a missing module or a duplicate component.

## T3 editor-preview-pane

- [ ] `npm run dev`, open `http://localhost:5173/#/decks`, open any saved deck.
- [ ] The left pane shows the shared card preview panel (not "Pinned card details"). Initially it shows "Hover a card to see its details."
- [ ] Hover a catalog tile (right pane): the preview panel updates with the card's name, effect text, and art.
- [ ] Click a catalog tile to select/pin it; hover another tile: preview shows the hovered card. (Since T6 of decks-feedback-round-2, that click also adds a copy — press Undo after checking the preview.)
- [ ] Move the cursor off the catalog grid: preview reverts to the previously selected (clicked) card.
- [ ] Hover a deck workspace card (middle pane): preview shows that card.
- [ ] Move the cursor off the deck workspace grid: preview reverts to the selected card.
- [ ] With no card selected and not hovering: preview shows "Hover a card to see its details."
- [ ] On portrait / tabs layout: the "Details" tab is now labelled "Preview" and shows the same preview panel.
- [ ] T1 regression: card art still appears in the preview panel when a tile with packaged art is hovered or selected.

## T4 editor-layout-cleanup

Run `npm run dev` and open an existing deck at `#/decks/<id>` (or create one).

Header chrome removed

- [ ] The editor header shows only four controls: a "← Library" link, the deck name input, Undo, and Redo. No card-count display, no validation-status chip, no autosave-status chip, no Import button, no Export button.
- [ ] The deck name input is noticeably narrower than before (≈ 11 rem wide).

Viewport stretch

- [ ] The editor fills the full browser width with only a tiny margin on each side (≈ 0.25 rem per side, not the previous 1.5 rem).
- [ ] The workspace pane and catalog pane each extend to near the bottom of the viewport — only the header row sits above them. Scroll the page; there should be no large gap between the panes and the window bottom.
- [ ] The card-catalog results list is taller than before; you can see more cards before hitting the internal scroll boundary.

Decorative headings removed

- [ ] No "Deck workspace" or "Build deck" heading appears above the deck zone area.
- [ ] No "Card catalog" or "Find cards" heading appears above the search bar / results area.
- [ ] Both sections remain semantically labelled (screen-reader accessible) even though the visible headings are gone.

Import and Export accessible from library

- [ ] Navigate back to the library (`#/decks`). "Import Deck" and the per-row "Export" action are present and functional. (They no longer live in the editor header.)

## T5 undo-redo-keybinds

Run `npm run dev` and open a deck at `#/decks/<id>`.

- [ ] Add a card to the Main Deck, then press Ctrl+Z with focus anywhere outside a text field — the card is removed and the header Undo button greys out when no edits remain.
- [ ] Press Ctrl+Y — the card comes back. Press Ctrl+Shift+Z after another undo — it also redoes.
- [ ] Press Ctrl+Z repeatedly past the start of history — nothing breaks and no error appears; the Undo button stays disabled.
- [ ] Click into the deck name input, type text, press Ctrl+Z — the browser undoes the *typing* in the input; the deck itself is unchanged (no card is removed).
- [ ] Click into the catalog search field, type, press Ctrl+Z — same: text-level undo only, deck untouched.
- [ ] On macOS, Cmd+Z and Cmd+Y behave the same as Ctrl+Z / Ctrl+Y.
- [ ] Screen reader / inspector: the Undo button announces shortcut `Control+Z`, the Redo button announces `Control+Y Control+Shift+Z`.

## T6 manual-order-model

Model-only slice: there is no reorder/sort UI yet (that arrives in a later
slice). These steps check the ordering the existing editor now produces.

Run `npm run dev` and open a deck at `#/decks/<id>` (or create one).

- [ ] Add four different cards to the Main Deck one at a time, in a deliberate order (e.g. a Trap, then a Spell, then two Monsters). Each card appears at the END of the Main Deck, after the cards already there — the deck is NOT regrouped into monsters/spells/traps and NOT re-sorted by name.
- [ ] Reload the page and reopen the same deck: the cards are still in the order you added them.
- [ ] Add a second and third copy of a card already in the deck: each copy lands at the end, not next to its siblings.
- [ ] Remove a card from the middle of the Main Deck: the remaining cards keep their relative order and do not shuffle up into a sorted arrangement.
- [ ] Add an Extra Deck card (Fusion/Synchro/Xyz/Link): it lands at the end of the Extra Deck, not in Fusion→Synchro→Xyz→Link order.
- [ ] Move a card between the Main/Extra Deck and the Side Deck: it lands at the END of the target zone, and the source zone keeps its remaining order.
- [ ] Press Ctrl+Z after several adds: undo steps back one card at a time as before, and the deck it restores holds the right cards (order may snap back to the order recorded at that step — undo tracks which cards are in the deck, not where they sit).
- [ ] Press Ctrl+Y to redo back up to the latest state: no error appears and the card count matches.
- [ ] Open a deck that was saved BEFORE this change (an older deck in the library): it loads normally, its cards are unchanged, and adding/removing a card still saves without a "deck storage" error.
- [ ] Import a `.ydk` from the library: the imported deck keeps the file's own card order rather than being re-sorted on import.
- [ ] Watch the browser console through all of the above: no `DeckStorageError` and no "deck history is inconsistent" message.

## T7 stacked-collapsible-zones

Run `npm run dev` and open a deck at `#/decks/<id>` (or create one).

Zone layout

- [ ] Confirm that the Main Deck, Extra Deck, and Side Deck zones stack vertically in that order — there is no two-column Extra+Side grid.
- [ ] Confirm that neither Extra Deck nor Side Deck appears to the right of Main Deck at any viewport width.

Collapse / expand controls

- [ ] Confirm the Side Deck zone starts **expanded** on first open (card grid visible; toggle button shows "▾"). *(updated by T5)*
- [ ] Click the Side Deck toggle — the card grid and drop area collapse; the toggle arrow changes to "▸".
- [ ] Click the toggle again — the zone expands; toggle arrow returns to "▾".
- [ ] Confirm the same expand/collapse works for Main Deck and Extra Deck.
- [ ] Confirm each toggle button reports its state to assistive technology (`aria-expanded` flips between "true" and "false").
- [ ] Tab to a zone toggle with the keyboard — a visible focus ring surrounds the toggle, and Enter/Space collapses or expands the zone.

Growing main grid

- [ ] With 40 or fewer cards in Main Deck, the count label reads `X/40` (e.g. `3/40`).
- [ ] Add cards until the Main Deck reaches 41 cards — a new row of ten empty slots appears, the count label switches to `41/40-60`.
- [ ] Continue to 51 cards — a sixth row appears, the count still shows `X/40-60`.
- [ ] Confirm all main-grid columns stay at 10 (not 12) at every size.

## T8 reorder-and-sort-ui

Drag reordering

- [ ] Open a deck with at least 3 cards in the Main Deck.
- [ ] Drag the first card (slot 0) and drop it onto the third card (slot 2) — the two cards swap positions.
- [ ] Drag a card and drop it onto an empty slot in the same zone — the card moves to the end of that zone.
- [ ] After a drag-reorder, confirm the Undo button remains disabled (reorder does not enter history).
- [ ] Drag a Main Deck card to the Side Deck zone — it moves there (cross-zone move still works).
- [ ] Drag a catalog card to its canonical zone — it is added (catalog add still works).

Sort buttons

- [ ] Confirm two buttons appear in the deck workspace header: "Sort A–Z" and "Sort by type".
- [ ] Click "Sort A–Z" — all three zones are sorted alphabetically by card name.
- [ ] Click "Sort by type" — main/side zones order monsters → spells → traps; extra zone follows Fusion → Synchro → Xyz → Link.
- [ ] After a sort, confirm the Undo button remains disabled (sort does not enter history).

## T9 drop-removal-semantics

Outside-drop removal

- [ ] Open a deck with at least one card in Main Deck.
- [ ] Drag a Main Deck card and release it over the page background (outside all zone drop areas) — the card is removed from the deck, and a removal announcement appears in the status region.
- [ ] Confirm the Undo button becomes enabled after this removal (it entered history).

Illegal-zone halo

- [ ] Drag a Main Deck card (e.g. a normal monster) — the Main Deck and Side Deck drop areas turn green (allowed), the Extra Deck drop area turns red (blocked).
- [ ] Drag an Extra Deck card — the Extra Deck and Side Deck drop areas turn green, the Main Deck drop area turns red.
- [ ] Drag a catalog card whose canonical zone is Main — the Main Deck **and** Side Deck drop areas turn green, Extra turns red. (Side became a legal catalog target in T6 of decks-feedback-round-2.)
- [ ] Release the drag without dropping — no removal occurs for a catalog card.

Illegal-zone drop → removal

- [ ] Drag a Main Deck card and drop it onto the Extra Deck zone (red) — the card is removed from Main Deck (not moved to Extra).
- [ ] Drag a catalog card onto the wrong zone (the Extra Deck, for a Main-canonical card — Side is legal since T6 of decks-feedback-round-2) — no card is added, no error panel appears.

Buttons gone

- [ ] Drag any Main Deck card and confirm no "Remove picked card" button appears in the workspace header.
- [ ] Confirm no per-zone "Drop picked card in …" keyboard buttons appear during the drag.

## T10 context-menu-and-maxed-highlight

### Setup
- [ ] Run `npm run dev` and open `http://localhost:4300/#/decks`. Create or open a deck.

### Right-click remove from deck zone
- [ ] Open the Main Deck zone. Right-click any card in the zone — the card is removed from the deck immediately, counts update, and an accessible announcement plays.
- [ ] Press Undo — the removed card returns.
- [ ] Repeat for a card in the Extra Deck zone and a card in the Side Deck zone.

### Right-click add from catalog
- [ ] Right-click a catalog card whose canonical zone is **Main** — the card is added to Main Deck; the announcement reads "… added to main."
- [ ] Right-click the same card again until Main Deck has **60** cards.
- [ ] Right-click a different catalog monster — Main is full, so the card is added to **Side Deck** instead; the announcement says "… added to side."
- [ ] Fill Side Deck to **15** cards (by right-clicking more catalog cards or dragging). Right-click another catalog monster — no card is added and an announcement reads "…: No space left." (wording changed in T6 of decks-feedback-round-2).

### Maxed (copy-limit) highlight
- [ ] Find a card that already has **3** copies in the deck (check the copy badge). Its catalog tile should show a **red border** instead of the normal accent border.
- [ ] Hover that tile — the background also tints red (danger-surface), border stays red.
- [ ] Remove one copy (right-click in the deck zone). The catalog tile border returns to normal once copies drop below the limit.
- [ ] A forbidden card (limit-badge shows **0**) always has a red border in the catalog, regardless of how many copies are in the deck.

### No native context menu
- [ ] Right-click any card tile — the browser's native context menu does **not** appear.

## T11 library-halo-polish

### Setup
- [ ] Run `npm run dev` and open `http://localhost:4300/#/decks`.

### Import button label
- [ ] The library header shows an "Import Deck" button (not "Import YDK"). Click it — the import dialog opens normally.

### Titles removed
- [ ] The "Local decks" eyebrow text is gone.
- [ ] The "Visual Novel chooses a deck ID…" subtitle text is gone.
- [ ] The "Deck Library" h1 is not visible, but the page landmark is still labelled (screen reader / accessibility tree shows the landmark).

### Validation halo
- [ ] A deck with errors (e.g. fewer than 40 main cards) — its row button shows a red/danger glow.
- [ ] A deck with warnings (e.g. empty side) — its row button shows a yellow/warning glow.
- [ ] A fully valid deck — its row button shows a green (`var(--success)`) glow, visibly distinct from the yellow-orange warning glow and the red error glow.
- [ ] Hover a warning or error deck row — a native tooltip appears listing each issue message (one per line).
- [ ] Hover a valid deck row — no tooltip appears.

### Status text gone
- [ ] No raw status word ("valid", "warnings", "errors") appears as text in any deck row.

## T12 autosave-log-storage

### Version-1 → version-2 upgrade (do this first, on a database that already has decks)
- [ ] On the **previous** build (before this commit: `git stash` your worktree or check out `8a60f54`), run `npm run dev`, open `http://localhost:4300/#/decks`, and create a deck named "Upgrade Survivor" with at least 5 cards in Main. Confirm DevTools → Application → IndexedDB shows `ygo-story-decks` at **version 1** with stores `decks`, `histories`, `preferences`.
- [ ] Stop the dev server, return to this build, run `npm run dev` again, and **reload** `http://localhost:4300/#/decks`.
- [ ] "Upgrade Survivor" is still in the Deck Library, opens, and still holds the same 5 cards. **Nothing was lost.**
- [ ] DevTools → Application → IndexedDB now shows `ygo-story-decks` at **version 2**, with the original three stores plus a new empty `autosaves` store.

### Prototype (legacy) database is never upgraded
- [ ] With DevTools → Application → IndexedDB, delete `ygo-story-decks` entirely, then hand-create a database named `ygo-story-duel-deck-builder-prototype` at **version 1** holding one deck row (or reuse a real prototype database if you still have one).
- [ ] Reload the deck editor. The prototype deck appears in the Deck Library, and `ygo-story-duel-deck-builder-prototype` is gone — migrated, not wiped.
- [ ] At no point did the prototype database's version change to 2 before its decks arrived.

### Autosave log records membership edits
- [ ] Open a deck and add two cards. In DevTools → Application → IndexedDB → `ygo-story-decks` → `autosaves`, two rows appear, each with `deckName` set to the deck's current name, an ISO `createdAt`, and the `main`/`extra`/`side` lists as they were right after that edit.
- [ ] Remove a card, then press Undo, then Redo. Each of those three actions adds one more row.
- [ ] Rename the deck, then add a card. The new row carries the **new** name; the earlier rows still carry the old one.

### Positional changes are not logged
- [ ] Note the current row count in `autosaves`. Drag a card to a different position inside Main Deck, then use the Sort action.
- [ ] The `autosaves` row count is **unchanged** — reordering and sorting append nothing.

### 100-entry cap
- [ ] Add and remove a card repeatedly (roughly 55 add/remove pairs) so the log passes 100 entries.
- [ ] `autosaves` never holds more than **100** rows, and the rows that remain are the most recent ones (oldest `createdAt` values have been dropped).

### Failed log never blocks a save
- [ ] In DevTools → Application → IndexedDB, delete the `autosaves` store's contents and, while the editor is open, keep a second tab on the same page. Edit the deck.
- [ ] The deck still saves ("Saved" state, edit persists across reload) even if an autosave row fails to appear. A broken log must never surface an error to the player.

### Known risk to watch for (not fixed by this ticket)
- [ ] Open the deck editor in **two** browser tabs at once on the old (version-1) database, then reload only one of them onto this build. If the upgrading tab appears to hang on load, that is the IndexedDB `blocked` event with no handler — close the other tab and reload. Report it if you hit it.

## T13 load-deck-dialog

### Load dialog opens from editor header

- [ ] Open a deck in the editor. A "Load" button is visible in the header next to Redo.
- [ ] Click "Load". A modal dialog appears with two tabs: "Your decks" and "Autosaves".
- [ ] Press Escape. The dialog closes.
- [ ] Tab to the "Load" button and press Enter — the dialog opens with focus already inside it, Escape closes it without tabbing first, and focus returns to the "Load" button.
- [ ] The backdrop (dim overlay) covers the page while the dialog is open.

### Your decks tab

- [ ] The dialog opens on the "Your decks" tab by default.
- [ ] All saved decks are listed, each showing the deck name and "Main N" card count.
- [ ] Clicking a deck row closes the dialog and navigates to that deck.

### Autosaves tab

- [ ] Click the "Autosaves" tab. Entries are listed newest first, each showing a human-readable timestamp and the deck name.
- [ ] If no autosaves exist, the message "No autosaves yet." appears.
- [ ] Click an autosave entry. The dialog closes and the open deck's card list is replaced by the autosave's lists. The change is undoable (Ctrl+Z returns the previous lists).

### Restoring an autosave of a deleted deck

- [ ] Create a deck, add a card, then delete the deck from the library. Open the Load dialog, switch to Autosaves, and click the entry for the deleted deck.
- [ ] A new deck is created with the same name and the autosave's card lists.

## T14 default-deck

### Starter deck on a fresh install

- [ ] Wipe site data for the app (DevTools → Application → Storage → "Clear site data"), then reload and open `#/decks`. Exactly one deck named "Starter Deck" is listed, and its row shows the "Default" badge.
- [ ] Reload the page again. Still exactly one "Starter Deck" row — the seeding did not add a second one.
- [ ] Open "Starter Deck". Its card list is the bundled player deck, and no "imported, needs review" banner is shown.

### Setting the default

- [ ] Create a second deck and open it. Its deck page header has a **Set default** button; open the Starter Deck and confirm its **Set default** button is disabled (it is already the default).
- [ ] Open the second deck, click **Set default**. The **Default** badge appears on that row in the library; open the Starter Deck — its **Set default** button is now enabled.
- [ ] Reload the page. The badge is still on the second deck.

### Deleting the default

- [ ] Open the deck that currently holds the **Default** badge and click **Delete** from the deck page header, confirming the dialog. No remaining row in the library shows a **Default** badge.
- [ ] Reload the page. Because no deck is default any more, seeding runs again: it adopts the existing "Starter Deck" rather than creating a second one, so that row now carries the badge and the deck count is unchanged.
- [ ] Open each remaining deck and delete it from the deck page (including "Starter Deck"), then reload. A single fresh "Starter Deck" is seeded and marked default.

## T15 duel-menu-default-selection

### An existing profile still carrying the old opponent

- [ ] Before reloading anything, open DevTools → Application → Local Storage and set `ygo.ui.v2` to a record whose `decks` reads `{"playerKey":"preset:nekroz","opponentKey":"preset:mvp-opponent"}` (keep `version: 2`, `windows` and `settings` as they are).
- [ ] Reload and open `#/duel`. Read `ygo.ui.v2` again: `opponentKey` is now `preset:shaddoll`, and the picker's opponent line reads "Opponent deck: Shaddoll (auto-assigned)".
- [ ] `playerKey` is still `preset:nekroz` and that deck is the selected row — a choice the player made is not overwritten by the default deck.
- [ ] No "a deck you had chosen is no longer available" notice is shown.

### A fresh profile

- [ ] Wipe site data for the app (DevTools → Application → Storage → "Clear site data"), then reload and open `#/duel` directly, without visiting `#/decks` first.
- [ ] Once the picker appears, the selected row is **Starter Deck** under **Your decks** — the deck seeded on this first run, not a bundled one.
- [ ] No fallback notice is shown anywhere on the picker. A first run has lost nothing and must not be told it has.
- [ ] The opponent line reads "Opponent deck: Shaddoll (auto-assigned)", and there is no opponent column, list or button.
- [ ] Press **Start**. The duel initializes against a Shaddoll deck.

### A default deck the player set themselves

- [ ] Open `#/decks`, create or import a second legal 40-card deck, open it in the editor, and press **Set default** in the deck header.
- [ ] Wipe only `ygo.ui.v2` from Local Storage (leave IndexedDB alone), reload, and open `#/duel`. The selected row is that second deck.
- [ ] Pick a different deck in the list, reload, and open `#/duel` again. Your pick is still selected — the stored default only fills an empty seat, it does not reclaim one.

### The filter

- [ ] Type `shad` into **Filter decks**. Only decks whose name contains "shad" remain listed, plus the deck currently selected.
- [ ] Type something no deck matches (e.g. `zzz`). The message "No deck matches that filter." appears, and the selected deck is still listed and still selected.
- [ ] Clear the filter. Every deck is listed again.
- [ ] With a filter typed that hides the selected deck's name, press **Start** anyway. The duel runs with the selected deck, not with whatever is visible.

### A deck that vanished

- [ ] Select a local deck at `#/duel`, then go to `#/decks` and delete that deck.
- [ ] Return to `#/duel`. The fallback notice is shown, and the seat has fallen back to the stored default deck (or the bundled starter if there is none).

## T1 field-spell-zone-address

Automated proof already exists (`tests/unit/duel-field.test.ts`,
`tests/integration/field-spell-activation.test.ts` — the latter drives a real
`ygopro-core` WASM duel and asserts the board still maps after the activation).
These steps confirm the same fix in a browser, which no automated suite covers.

### Field survives a field-spell activation
- [ ] `npm run dev`, open the printed URL, go to `#/duel`.
- [ ] Pick **Spellbook** as your deck, any opponent deck, and Start.
- [ ] Play to your Main Phase 1 and activate **The Grand Spellbook Tower** from your hand.
- [ ] The duel field stays mounted. The panel headed **Duel field unavailable**
      (`data-cy="app-field-error-panel"`) never appears.
- [ ] The Tower renders inside your **Field Zone** — the single slot left of your
      monster row — not in a Spell/Trap slot and not missing.
- [ ] Prompts keep rendering on the field itself; you are not pushed into the
      dialog-only fallback where every action goes through a decision box.

### The duel continues normally afterwards
- [ ] Answer the Tower's follow-up prompts and pass to the End Phase. The field
      is still mounted and still shows the Tower in the Field Zone.
- [ ] Take one more turn: summon a monster and set a Spell/Trap. Both land in
      their own slots; the Field Zone still holds only the Tower.

## T2 unsupported-message-abort

Automated coverage exists and is the hard gate
(`tests/integration/xyz-overlay-progression.test.ts` drives three real
`ygopro-core` WASM duels through an Xyz Summon and asserts no
`unsupported_message`; `tests/integration/spellbook-duel-progression.test.ts`
plays a scripted Spellbook duel to its result). These steps confirm the same
fix in a browser, which no automated suite covers.

### A duel with an Xyz Summon is not stopped by a technical failure
- [ ] `npm run dev`, open the printed URL, go to `#/duel`.
- [ ] Pick **Burning Abyss** as your deck, any opponent deck, and Start.
- [ ] Play until you can Xyz Summon (two Level 3 Burning Abyss monsters, for
      example **Dante, Traveler of the Burning Abyss**). Complete the summon,
      including the zone-selection prompt.
- [ ] The duel keeps running. The panel reporting a technical failure
      (`data-cy="app-error-panel"`) never appears and the duel does not end.
- [ ] Open the browser console: no `duel.worker.command.failed` entry with
      `code: 'unsupported_message'`, and no `duel.worker.detached` entry.

### The Xyz monster shows the materials it carries
- [ ] The summoned Xyz monster renders in a Monster Zone with its overlay
      materials attached, not as a bare monster and not with its materials
      still sitting in the zones they were summoned from.
- [ ] The zones the materials came from are now empty.
- [ ] Activate an effect that detaches a material (Dante's effect, for
      example). The material count drops by one, the detached card appears in
      the Graveyard, and the duel continues.

### A story duel survives the same flow
- [ ] Go to `#/story`, start the duel the story hands off, and play several
      turns past the first Xyz Summon.
- [ ] The duel is never stopped by a technical failure and the connection to
      the duel worker is never reported as interrupted.


## T3 deck-search-private-identity

- [ ] Start a dev duel and activate a card that searches the deck (e.g. Spellbook Magician of Prophecy effect, or any search-style effect). Confirm the target list dialog shows real card art and names for your own deck cards, not "Face-down card".
- [ ] After confirming the search choice, open the deck browse list and confirm those cards now show as face-down again (the prompt-attested identity is gone once the prompt resolves and the deck shuffles).

## T4 extra-deck-facedown-top

- [ ] Start a dev duel and observe both deck stacks (own and opponent). Each non-empty deck stack shows the card-back image, not a face-up card art.
- [ ] Observe both extra deck stacks. Each non-empty extra deck stack shows the card-back image (same back art as the deck), not a face-up card art.
- [ ] Open the GY (graveyard) browse list — the top card in the GY stack shows face-up art (regression: public piles unchanged).
- [ ] Open the extra deck browse list — the list still shows own card names/art face-up (browse of private piles is intentionally allowed; only the stack tile face is hidden).

## T5 center-hand-cards

- [ ] Open the duel at `http://localhost:4173` (or dev server) with a 5-card starting hand — the hand cluster is horizontally centered under the duel field middle (visually sits in the center of the hand band, not packed to the left).
- [ ] Draw cards until the hand overflows (≥ 10–12 cards at 1920×1080) — the scrollbar appears and scrolling left/right reaches both the first and last card.
- [ ] Opponent hand (top band) with 5 cards also appears centered.

## T6 zoom-gating-known-facedown

- [ ] Run `npm run dev` and open the duel at `http://localhost:4173` (or configured dev port).
- [ ] Hover over an opponent's set (face-down) card on the spell/trap row — the card must NOT zoom (no scale-up) and must show NO name label at the bottom.
- [ ] Hover over an opponent's face-down monster — same: no zoom, no label.
- [ ] Hover over your own set card (face-down spell/trap) — the card MUST zoom (scale 1.35) and MUST show the card name label at the bottom.
- [ ] Hover over a face-up card (own or opponent's visible) — zoom and label both present (regression check).
- [ ] Hover over cards in the opponent hand band — no zoom, no label (opponent hand cards have no code).
- [ ] Confirm the browser console shows no errors during the above.

## T7 hand-hover-zoom-overlay

- [ ] Run `npm run dev` and open the duel at `http://localhost:4173` (or configured dev port).
- [ ] Hover a known hand card (own face-up or face-down card you own) — a fixed-position overlay appears enlarged (~1.6× the card height) escaping the hand band and overlapping adjacent panels or side rails if it would clip there.
- [ ] Confirm the overlay extends visually ABOVE the hand band top edge (not clipped by the band's overflow-y: hidden).
- [ ] Action buttons (e.g. Summon, Set) appear directly above the zoomed card — not inside the hand band below the card.
- [ ] Click an action button on the overlay — the action is dispatched (card is played or prompt advances). Overlay disappears.
- [ ] Move the pointer from the card onto the overlay without leaving — overlay must stay visible (pointer-over-overlay grace period).
- [ ] Move the pointer off the overlay entirely — overlay disappears.
- [ ] Start dragging a hand card — overlay disappears immediately on drag start.
- [ ] Press Escape while a hand card has keyboard focus with chips pinned — in-place zoom appears (1.35× via focus-within) and chips are accessible; the fixed overlay is NOT shown.
- [ ] Hover over an opponent hand card (face-down, no code) — NO overlay appears.
- [ ] Confirm the browser console shows no errors during the above.

## T8 full-control-toggle

- [ ] Run `npm run dev` and open the duel at `http://localhost:4173` (or configured dev port); confirm a "Full Control" checkbox sits at the bottom-right corner of the duel field, unchecked.
- [ ] With Full Control unchecked, activate one of your own Spell/Trap cards — no chain window appears for your own activation (the engine's own-effect chain window is auto-passed).
- [ ] With Full Control unchecked, Normal Summon a monster — no extra response window appears after the summon resolves.
- [ ] With Full Control unchecked and a Trap set on your field, let the opponent activate an effect or declare an attack — a chain window DOES appear so you can respond.
- [ ] Hold Ctrl down: the checkbox visibly ticks while the key is held.
- [ ] Keep Ctrl held and activate your own effect — the chain window now appears (auto-pass is suppressed).
- [ ] Release Ctrl — the checkbox unticks again, and own-effect chain windows are auto-passed once more.
- [ ] Click the checkbox to check it manually, then press and release Ctrl — the checkbox stays checked after the release (manual check survives the hold).
- [ ] With Full Control checked, summon a monster — the placement (zone) prompt surfaces instead of auto-placing, and single-option prompts surface instead of being auto-answered.
- [ ] With Full Control checked, uncheck it while a prompt you can already see is open — that visible prompt is NOT auto-answered behind your back; it stays until you answer it.
- [ ] Focus the browser's address bar (or switch windows) while holding Ctrl, then return — the checkbox is unticked (blur clears the hold).
- [ ] Confirm the browser console shows no errors during the above.

## T9 remove-inspect-option

- [ ] Run `npm run dev` and open the duel at `http://localhost:4173` (or configured dev port); start a duel.
- [ ] Trigger any prompt dialog (effectYesNo, selectCard, etc. — use workspace toggle in Settings if needed) — verify NO "Inspect …" rows / `<details>` expanders appear inside the dialog.
- [ ] Force a multi-choice card-select prompt (e.g. discard cards) — verify the card checkbox rows show the card label only, with NO inspect expander beneath each checkbox.
- [ ] Force a sort/order prompt (e.g. rearrange cards on field) — verify order list shows label + up/down buttons only, NO inspect expander.
- [ ] Force a counter-allocation prompt — verify each card row shows label + +/- controls only, NO inspect expander.
- [ ] Verify that the left CardPreviewPanel still shows card art and description when a card is focused on the field (the side panel remains the sole card-info surface).
- [ ] Verify the HUD "Inspect" buttons (top-right tray) are unaffected and still open the card preview.
- [ ] Confirm the browser console shows no errors during the above.

## T10 right-rail-redesign

- [ ] Run `npm run dev` and open the duel at `http://localhost:4173` (or configured dev port); start a preset duel.
- [ ] Confirm a visible horizontal rule (border-bottom line) separates the turn/phase header row from the rest of the rail.
- [ ] Confirm the avatar images are square, fill the full rail width, and have a fat accent-coloured border on all four sides (no card-back image; silhouette placeholder only).
- [ ] Confirm the LP display reads `LP 8000` (label before the number, no thousands separator) for both players at the start of the duel.
- [ ] Confirm the LP plate sits inside a bordered box (border visible, background slightly tinted).
- [ ] Deal damage in the duel that brings a player below 4001 LP — confirm the LP plate colour changes to orange.
- [ ] Deal damage that brings a player below 2000 LP — confirm the LP plate colour changes to red.
- [ ] Confirm that when LP changes, the displayed number visibly counts/tweens toward the new value over ~600 ms (not a hard jump).
- [ ] Enable `prefers-reduced-motion` in OS/browser settings, then repeat damage — confirm the LP number jumps immediately (no animation).
- [ ] Confirm the action-prompt block (`status.title` / `status.subtitle`) is vertically centred within the rail (aligned with the middle of the duel field).
- [ ] Confirm thinking dots still animate when the opponent is deciding.
- [ ] Confirm the browser console shows no errors during the above.

## T11 preview-keeps-last-card

Start a dev duel (`npm run dev`), open the app in the browser, and pick decks to start a duel.

- [ ] Hover a face-up card on the field (own monster or opponent face-up monster) — confirm the left preview panel updates to show that card's name and image.
- [ ] While the preview panel is showing that card, hover an opponent's face-down (set) card — confirm the preview panel **does not change** (still shows the previously hovered card).
- [ ] Hover a card in your own deck pile (graveyard stack, banished pile) — confirm preview updates to show its name.
- [ ] Hover a stack pile that has no public top-card identity (e.g. opponent's deck) — confirm the preview panel does not change.
- [ ] In the zone-list dialog (click a stack zone), hover a face-down entry — confirm the preview panel does not change.
- [ ] In the zone-list dialog, hover a face-up/known entry — confirm the preview panel updates.
- [ ] On a fresh duel load (before hovering any card), hover a hidden card — confirm the panel stays in its empty state ("Hover a card to see its details.").
- [ ] Confirm the browser console shows no errors during the above.

## T13 launcher-toggles-collapse

Start a dev duel (`npm run dev`), open the app in the browser, and pick decks/start a duel. Activate a card effect that searches the deck (e.g. Reinforcement of the Army / Pot of Greed) so the off-field target list appears.

- [ ] With the target list visible, click the graveyard pile (or whichever stack pile is haloed as the launcher) — confirm the list **collapses** to a single `+` button (does **not** close/disappear).
- [ ] Click the same launcher pile again — confirm the list **expands** back to full, showing target entries.
- [ ] With the list expanded, click the `−` button in the list header — confirm the list collapses to the `+` button.
- [ ] With the list collapsed, click the `+` button — confirm the list expands and the `−` collapse button receives focus.
- [ ] Click elsewhere on the duel field (not a launcher) — confirm the list closes (existing outside-click dismissal is unchanged).
- [ ] Start a new duel effect that triggers a different target prompt — confirm the list opens expanded (collapse resets to `false` for the new prompt).
- [ ] Confirm the browser console shows no errors during the above.

## T14 halo-semantics-v2

Start a dev duel (`npm run dev`), open the app in the browser, and pick decks/start a duel.

- [ ] Open the GY (graveyard) browse list — hover entries that have no choices (neutral): confirm **no colored ring appears** on hover.
- [ ] Activate a card effect with field targets (e.g. a monster that targets another monster). Hover actionable field cards — confirm **green ring** appears on hover.
- [ ] Select a target card in the list — confirm **orange ring** persists even while hovering.
- [ ] In a multi-select prompt, select up to the maximum, then hover an unselected entry — confirm **red ring** appears on the unavailable entry.
- [ ] With a card-targeting prompt active: hover a non-candidate field card (one that is NOT highlighted green) — confirm **red ring** appears on hover and **disappears** when the pointer leaves.
- [ ] Confirm the browser console shows no errors during the above.


## T15 preview-stats-row

- [ ] Hover a monster card in the preview panel — stats line shows `ATTRIBUTE · Race · Level/Rank N · ATK X / DEF Y` between name and effect text.
- [ ] Hover a Link monster — stats line shows `ATTRIBUTE · Race · Link N · ATK X` (no `/ DEF` segment).
- [ ] Hover a Spell card — stats line shows `Spell · SubType` (e.g., `Spell · Quick-Play`) or plain `Spell` when there is no subtype.
- [ ] Hover a Trap card — stats line shows `Trap · SubType` or plain `Trap`.
- [ ] Hover a card with unknown ATK/DEF — stats line renders `ATK ?` or `DEF ?` for null/negative values.
- [ ] Hovering a face-down card shows no stats row (hidden card preview).
- [ ] Stats line text is muted, small (0.78rem), and bold — matches `.card-preview-panel__stats` spec.

## Review repair pass 1

Start a dev duel (`npm run dev`), open the app in the browser, pick decks and start a duel.

- [ ] Hold Ctrl with the Full Control checkbox off — confirm the box stays **unticked**, the label turns accent-coloured and a "held by Ctrl" pill appears beside it; release Ctrl and confirm the pill disappears.
- [ ] With Ctrl held, click the Full Control checkbox — confirm it ticks and stays ticked after Ctrl is released.
- [ ] With Full Control on, trigger a chain window you opened yourself — confirm the window waits for you instead of auto-passing.
- [ ] Open a chain window while holding Ctrl, then release Ctrl while the window is still on screen — confirm nothing answers it for you.
- [ ] Rotate a phone-sized viewport into the portrait duel layout (device toolbar, e.g. 390x844) and hover a hand card near the right edge — confirm the zoom overlay stays inside the rotated board instead of being pulled toward the left edge.
- [ ] Rest the pointer on a hand card without moving it for a few seconds — confirm the zoom overlay mounts once and stays perfectly still, with no flicker or strobe.
- [ ] With the zoom overlay open, click the hand card itself, then drag it onto a highlighted zone — confirm both work exactly as they do without the overlay, even though the overlay art is drawn over the card.
- [ ] With the zoom overlay open, move the pointer straight up from the card onto the action chips above it — confirm the overlay stays open the whole way and the chip you click fires its action.
- [ ] Move the pointer off the card sideways, away from the overlay — confirm the overlay closes immediately.
## T1 library-toolbar-row

- [ ] Open `#/decks`. Confirm the library header shows no buttons — only a visually-hidden "Deck Library" heading.
- [ ] Confirm the search field, sort dropdown, **Import Deck** button, and **Create deck** button all appear on the same horizontal toolbar row below the header.
- [ ] Resize the window to a narrow viewport (~400 px). Confirm the toolbar wraps gracefully with no overlapping elements.
- [ ] In the deck list, confirm the **Default** badge appears on the same line as the deck name, pushed to the right edge of that line.
- [ ] Confirm the counts line (Main · Extra · Side) and the "Updated …" timestamp appear below the name line, unchanged.
- [ ] Click **Import Deck** and confirm the import flow opens.
- [ ] Click **Create deck** and confirm the create-deck dialog opens.
- [ ] Create a deck, open it, click **Set default** in the deck header, return to the library, and confirm the **Default** badge appears right-aligned on its name row.

## T2 favourite-decks-ordering

- [ ] Open the deck library; confirm every deck row shows a star button (☆) to the right of the open button.
- [ ] Click the star on a deck; confirm the glyph changes to ★ and the button's `aria-pressed` flips to `true`.
- [ ] Click the star again; confirm the glyph reverts to ☆.
- [ ] Star two decks (but not the default), then reload the page; confirm the starred decks still show ★ after reload.
- [ ] With a default deck and two starred decks, confirm the library order is: default deck first, then starred decks, then unstarred — within starred/unstarred groups the active sort (modified/name) applies.
- [ ] Switch the sort to **Name** and confirm order within each group respects alphabetical ordering.
- [ ] Open a starred deck and delete it from the deck page header; reload the page; confirm it no longer appears in the favourites.
- [ ] Open, create, and delete decks (delete from the deck page) while favourites are set; confirm the library remains functional with no console errors.

## T3 deck-page-actions

- [ ] Open any deck. Confirm the editor header contains **Duplicate**, **Export**, **Set default**, and **Delete** buttons (in that order, between the name field and Undo).
- [ ] Confirm no deck row in the library shows Rename, Duplicate, Export, Set default, or Delete buttons.
- [ ] Click **Duplicate** — the copy opens in the editor and the URL points at the copy; the library lists both decks.
- [ ] Rename the open deck by editing the name input and blurring — the new name is saved (no dialog, no rename button).
- [ ] Click **Export** — the YDK export dialog opens for the open deck; Close returns focus to the Export button.
- [ ] Open a deck that is already the default. Confirm **Set default** is disabled.
- [ ] Open a non-default deck. Click **Set default** — the **Default** badge moves to that deck's row in the library, and **Set default** becomes disabled on the deck page.
- [ ] Click **Delete** — the confirm dialog appears with the deck name and "Local deck and retained history will be removed."; **Delete** (confirm) is available and **Cancel** returns focus to the Delete button without deleting.
- [ ] Confirm deletion — you land on `#/decks`; the deleted deck row is gone. Reload and confirm it stays gone.
- [ ] Delete the default deck — after deletion no row shows the **Default** badge.

## T4 card-tile-art-fit

- [ ] Run `npm run dev`, open a deck, and confirm tiles in **Main**, **Extra**, and **Side** zones show the full card art scaled to fill the tile (no top-left-corner clip, no letterbox).
- [ ] Confirm the card name overlays the bottom of the art with a readable scrim (dark gradient behind the text), and the name still has its own `data-cy` attribute (`deck-tile-name-{code}`).
- [ ] Open the catalog panel and confirm catalog tiles also show full card art with the name overlay.
- [ ] Select a card tile and confirm the accent border is still visible around the tile. (Since T6 of decks-feedback-round-2, clicking a deck tile also moves or removes it — press Undo, or select a catalog tile whose copy limit is already reached.)
- [ ] Confirm the limit badge (number in circle, top-left) remains above the art and is not obscured.
- [ ] Scroll to a card whose art this build did not package; confirm the placeholder glyph (letter or `!`) fills the tile and the name appears as a normal (non-overlay) row below it. (Corrected 2026-08-20 by T12: every code now gets an image URL by convention, so the placeholder is reached by the image failing to load rather than by a null URL.)
- [ ] Confirm no tile overflows its grid slot at any of the default column widths.

## T5 fifteen-in-a-row-collapse-bar

Run `npm run dev` and open a deck at `#/decks/<id>`.

Single-row Extra and Side grids

- [ ] Confirm the Extra Deck zone renders all 15 slots on **one horizontal row** (not 3 rows of 5).
- [ ] Confirm the Side Deck zone renders all 15 slots on **one horizontal row**.
- [ ] Confirm the Main Deck zone is unchanged: 10 columns and 4 rows (40 slots) for a deck with ≤ 40 cards.
- [ ] Add cards to Extra Deck until it holds 15; confirm all 15 tiles sit in one row with compact gap.
- [ ] Confirm card-name text in Extra/Side tiles is smaller than in Main Deck tiles (compact font).

Full-width collapse bar

- [ ] Click the chevron icon in the Extra Deck header — the zone collapses.
- [ ] Click the zone heading text in the Extra Deck header — the zone re-expands.
- [ ] Click the count badge (e.g. "0/15") in the Extra Deck header — the zone collapses again.
- [ ] Confirm the toggle button spans the full width of the workspace column (no orphan count badge to the right).
- [ ] Confirm a hover highlight appears across the entire header bar (not just the chevron region).
- [ ] Tab to the Extra Deck toggle and confirm a visible focus ring spans the full button; Enter/Space toggles the zone.

Side Deck expanded on arrival

- [ ] Open the deck editor from the library; confirm the Side Deck card grid and drop area are **visible immediately** without clicking the toggle.
- [ ] Confirm cards can be dragged from Main or Extra Deck directly onto the Side Deck drop area without first expanding it.

## T6 click-intents-and-sideboard

Desktop click intents (viewport ≥1024px wide — the `panels` layout)

- [ ] Run `npm run dev`, open `http://localhost:5173/#/decks`, and open a saved deck in a window wider than 1024px.
- [ ] Click a catalog card whose canonical zone is **Main** — one copy is added to Main Deck, the counts update, and the announcement reads "… added to main."
- [ ] Click a catalog card whose canonical zone is **Extra** (e.g. a Fusion monster) — it is added to Extra Deck, announcement "… added to extra."
- [ ] Click the card you just added in the **Main Deck** zone — that copy moves to Side Deck; Main drops by one, Side rises by one, announcement "… moved to side."
- [ ] Click that same copy in the **Side Deck** zone — it returns to Main Deck, announcement "… moved to main."
- [ ] Click a card in the **Extra Deck** zone — the copy is removed outright (it does not go to Side), announcement "… removed."
- [ ] Click an Extra Deck card that you first moved into Side, while in Side — it returns to **Extra**, not Main.
- [ ] Confirm every click also updates the preview panel to the clicked card, and that hovering another tile still wins over the selection.

Blocked click intents

- [ ] Fill Side Deck to **15** cards, then click a Main Deck card — nothing moves and the announcement reads "…: Side Deck is full."
- [ ] With Extra Deck at **15**, move one Extra card to Side first, then click it in Side — nothing moves and the announcement reads "…: Extra Deck is full."
- [ ] Fill Main Deck to **60** and Side Deck to **15**, then click a Main-canonical catalog card — nothing is added and the announcement reads "…: No space left."
- [ ] With Main Deck at **60** but Side below 15, click a Main-canonical catalog card — it lands in **Side Deck** instead, announcement "… added to side."
- [ ] Click a catalog card already at its copy limit (tile shows the maxed border) — nothing is added and the announcement gives the copy-limit reason, not a zone reason.

To-sideboard checkbox

- [ ] Confirm a **To sideboard** checkbox sits in the catalog header beside the result count, and that it is **unchecked** on arrival.
- [ ] Check **To sideboard**, then click a Main-canonical catalog card — it is added to **Side Deck**, not Main.
- [ ] With **To sideboard** still checked and Side Deck at **15**, click another catalog card — it falls back to its canonical zone (Main/Extra) rather than being blocked.
- [ ] Uncheck **To sideboard** and click a catalog card — it goes back to landing in its canonical zone.
- [ ] Tab to the checkbox and confirm it takes a visible focus ring and toggles with Space.

Catalog → Side drag

- [ ] Start dragging a Main-canonical catalog card — the **Main Deck and Side Deck** drop areas turn green and Extra turns red.
- [ ] Drop that catalog card onto the **Side Deck** drop area — one copy is added to Side, announcement "… added to side."
- [ ] Drag an Extra-canonical catalog card onto the **Side Deck** drop area — it is added to Side as well.
- [ ] Drag a catalog card onto the drop area that is still red (Extra for a Main card) — nothing is added.

Mobile is unchanged

- [ ] Narrow the window below 1024px (or use the device toolbar at e.g. 390x844) so the tabbed layout appears.
- [ ] Tap a catalog card — the **tap target menu** opens as before; the card is not silently added.
- [ ] Tap a deck card — the tap target menu opens with its zone choices; no immediate move or removal happens.

Undo / redo and persistence

- [ ] After a click-driven add, press **Undo** — the card is removed again; press **Redo** — it comes back.
- [ ] After a click-driven move (Main → Side), press **Undo** — the copy returns to Main; **Redo** sends it to Side again.
- [ ] After a click-driven Extra Deck removal, press **Undo** — the copy returns to Extra.
- [ ] Make several click edits, confirm **Load → Autosaves** lists them, reload the page, and confirm the deck contents match what you left.

## T7 autosave-every-command

Autosave log records position changes

- [ ] Open the deck editor with a deck that has at least two cards in the Main Deck.
- [ ] Drag one card to a different position within the Main Deck zone.
- [ ] Open the **Load** dialog — confirm a new autosave entry appears with the current timestamp and the reordered card list.
- [ ] Click the **Sort** button (alpha or type) — open **Load** again and confirm another fresh entry appears.

Undo still reverts membership only, not order

- [ ] With a deck open, add a card, then drag a different card to a new position.
- [ ] Press **Undo** — the previously added card is removed; the card you dragged stays in its new position (order is not restored).

## T8 editor-viewport-fit

Preview width

- [ ] Open the deck editor at 1920×1080 — the left card-preview panel is visually narrower than before (≈248px ≈ 15.5rem, not the old 352px / 22rem).
- [ ] Open the duel at 1920×1080 — the card-preview column is also narrower, confirming `--preview-w` is shared.

No region scrollbar (desktop)

- [ ] Open any deck at 1920×1080 — the browser viewport shows no vertical or horizontal scrollbar on the deck editor region.
- [ ] Resize to 1280×720 — still no region scrollbar (stage smaller, layout still fits).

Sub-breakpoint usable (tablet / portrait)

- [ ] Resize to 768×1024 portrait — the deck editor switches to tab layout; the header and content fill the width without side-scrolling.
- [ ] Resize to 390×844 portrait — tabbed layout is still usable; no horizontal overflow.

## T9 catalog-overlay-scrollbar

Overlay scrollbar visible and functional

- [ ] Open the deck editor with a deck. Scroll the card catalog with the mouse wheel — a themed overlay scrollbar thumb appears over the catalog results on the right edge.
- [ ] Drag the scrollbar thumb up and down — the catalog results scroll smoothly in response.
- [ ] Resize the browser so the catalog results fit without scrolling — the overlay scrollbar track and thumb disappear automatically.

Native scrollbar hidden

- [ ] In a browser that shows native scrollbars (non-macOS or forced-visible), open the deck editor — no native scrollbar is visible on the catalog results panel.

Mobile tabs layout still scrolls

- [ ] Resize to 390×844 portrait to activate the tab layout — switch to the Catalog tab and scroll the catalog results; the whole pane grows normally without a clipped overlay bar.

## T10 catalog-infinite-scroll

First paint bounded

- [ ] Open the deck editor, clear all filters — the catalog shows the result count (e.g. "14 794 results" with real data, or the fixture count) but only the first 60 card tiles are visible without scrolling. (Corrected 2026-08-20 by R2: 60 is the three-panel layout above the breakpoint. In the tabbed layout the observer is rooted on the viewport, so the first render settles around 300 tiles instead — still a window over the database, never all of it.)
- [ ] Confirm no freeze or jank on first paint even with a large card list.

Grow on scroll

- [ ] Scroll the catalog results to the very bottom — an additional batch of 60 cards appends to the list and the scroll position does not jump.
- [ ] Scroll to the bottom again — another 60 cards appear, up to the total result count.
- [ ] After reaching the full result count, no more batches are appended and the sentinel disappears.

Overlay scrollbar thumb resizes correctly

- [ ] As cards are appended, the overlay scrollbar thumb grows smaller (reflecting the longer content), and does not jump or flicker.

Filter resets window

- [ ] While viewing a grown list (e.g. 120 tiles), type in the Name filter — the list instantly resets to at most 60 tiles matching the new filter.
- [ ] Clear the Name filter — the list resets again to the first 60 of the full result set.

Interaction intact on appended tiles

- [ ] Scroll down to a tile in the second or third batch. Left-click it — the card is added to the deck (or the card preview panel updates) correctly.
- [ ] Drag an appended tile into the deck zone — drag-and-drop works normally.
- [ ] Right-click an appended tile (context add) — context menu or direct-add works normally.

## T11 ship-full-runtime-snapshot

Goal: verify the full runtime snapshot (451 declared files) is packaged and the duel still works on the fatter `dist`.

Build integrity

- [ ] Run `npm run build` and confirm it completes without error.
- [ ] Run `find dist/runtime/assets/current -type f | wc -l` and confirm the count is 452 (451 declared files + manifest.json).
- [ ] Run `du -sh dist` and confirm the total is approximately 65 MB.

Duel still starts from bundled decks

- [ ] Navigate to `/#/duel`, select a preset deck on each side, and confirm the duel launches and the first turn starts without errors in the browser console.
- [ ] Complete at least three turns to confirm game loop and script loading are unaffected.

Runtime asset availability

- [ ] Open DevTools → Network, reload the duel, and confirm requests to `/runtime/assets/current/scripts/...` return 200 for scripts not in the preset-deck closure (e.g. `scripts/globals.json`).

## T12 runtime-catalog-editor

Goal: the deck editor's catalog is every card in the packaged database (14,794
codes), fetched from the runtime assets when the editor opens instead of
compiled into the bundle. Run against `npm run dev` unless a step says otherwise.

The whole database is offered

- [ ] Open `#/decks`, create or open a deck, and clear every catalog filter — the result count reads `14794 results`.
- [ ] Search `Dark Magician` — the count drops to `40 results` and "Dark Magician" itself is among the tiles.
- [ ] Search `Blue-Eyes` — 39 results, including printings the old ~120-card catalog never offered (e.g. "Blue-Eyes Shining Dragon", "Blue-Eyes Alternative White Dragon").
- [ ] Click a card the old catalog did not have — it is added to its canonical zone and the deck counts move.

The catalog arrives as a load, not as a bundle

- [ ] Open DevTools → Network, filter on `catalog`, then hard-reload `#/decks`: exactly 128 requests appear — `runtime/assets/current/catalog/cards/00.json`…`3f.json` and `runtime/assets/current/catalog/texts/en/00.json`…`3f.json` — and all return 200.
- [ ] Navigate away to `#/duel` and back to `#/decks` **without** reloading — no second burst of 128 requests appears. The catalog is read once per page load.
- [ ] While those requests are in flight, the editor shows the "Loading local decks…" skeleton rather than an empty catalog or a partially filled one.

A catalog that cannot be read says so

- [ ] In DevTools → Network, enable **Offline**, then hard-reload `#/decks`. The editor shows the "Deck Editor stopped" screen, and the message begins `Deck Editor could not start: Runtime catalog shard failed:` and names a shard file.
- [ ] Turn Offline back off and press **Retry** — the editor reloads and opens normally.

Art is a URL by convention, and a miss is not an error

- [ ] In `npm run dev`, confirm most catalog tiles show real jpg art.
- [ ] Run `npm run build && npm run preview`, open the built app at `#/decks`, and search `Blue-Eyes`: exactly one tile shows art and the other 38 show the glyph placeholder. **No tile shows a broken-image icon.**
- [ ] Open the validation panel on a 40-card deck of art-less cards — there is no "uses placeholder art" warning. That warning was deleted in this slice.

The results grid no longer overlaps itself

- [ ] Search a term matching more than one row of results (`Blue-Eyes` gives 13 rows). Click the card named in the **last** row — the card that is added is the one you clicked, not a card from a row below it.
- [ ] Scroll the results with the overlay scrollbar and confirm rows stay a full tile apart, with no tile drawn over the tile above it.

Nothing else moved

- [ ] Open a deck, add and remove cards, rename it, and confirm it still autosaves (**Load → Autosaves** gains entries).
- [ ] Press Undo and Redo — both still work against the bigger catalog.
- [ ] Reload — the deck is exactly as you left it.
- [ ] Go to `#/duel` and start a bundled preset duel — it still initializes and reaches the first prompt.

## T14 catalog-performance

- [ ] Open the deck editor with the full runtime catalog loaded (14,551 offered cards: the database's 14,794 less its 243 Tokens, see R1). Type into the **Name** filter — the list should keep up with typing without visible lag on a mid-range laptop.
- [ ] Apply each filter dropdown (Type, Subtype, Attribute, Race) — results update immediately.
- [ ] Scroll the catalog results past the initial 60 tiles — more tiles load on scroll (windowing still works).
- [ ] Click a card tile to select it, then drag one into a deck zone — drag intents still fire.
- [ ] Clear all filters and confirm the full result count is back and scrolling is smooth.

## T13 duel-runtime-catalog

Goal: any deck the editor can build is offered by the duel picker and shows real
card names and effect text in the duel, because the duel reads the same
whole-database runtime catalog the editor does. Run against `npm run dev` unless
a step says otherwise.

A deck of cards no bundled deck names is offered and duels

- [ ] Open `#/decks`, press **Create deck**, name it `Manual T13`.
- [ ] Search `Blue-Eyes` and add printings the old ~120-card packaged set never carried (e.g. "Blue-Eyes Alternative White Dragon"), then fill the Main Deck to 40 legal cards so the validation panel shows no errors. Confirm the autosave landed through **Load → Autosaves**.
- [ ] Go to `#/duel` — `Manual T13` is listed. Before this slice it was silently absent, because the picker filtered against the ~120 art-backed codes.
- [ ] Select it and press **Start** — the duel initializes, reaches the first prompt, and the opening hand is drawn from those cards.
- [ ] Every card in hand shows its real name, never `Card 89631139`. Hover one — the preview panel shows the real name and effect text.
- [ ] Play a card to the field, then open that zone's card list — both the field card and the list entry name the card, not `Card {code}`.

One catalog read, shared with the editor

- [ ] DevTools → Network, filter on `catalog`, hard-reload `#/duel`: exactly 128 requests appear — `runtime/assets/current/catalog/cards/00.json`…`3f.json` and `runtime/assets/current/catalog/texts/en/00.json`…`3f.json` — and all return 200.
- [ ] Without reloading, navigate to `#/decks` — no second burst of 128 requests. The duel and the editor share one read per page load.
- [ ] Reverse it: hard-reload `#/decks`, wait for the catalog, then navigate to `#/duel` — again no second burst, and `Manual T13` is listed.

Bundled decks never wait on the catalog

- [ ] DevTools → Network → throttle to **Slow 3G**, then hard-reload `#/duel`. The **Bundled decks** group and all six rows appear immediately and **Start** is enabled while the catalog shards are still in flight.
- [ ] `Manual T13` appears a moment later, once the shards land. The bundled rows do not flicker, reorder, or briefly disappear.

A catalog that cannot be read says so, and the bundled decks still duel

- [ ] DevTools → Network → enable **Offline**, then hard-reload `#/duel`.
- [ ] A **Card database** panel appears. Its message begins `Card database could not load: Runtime catalog shard failed:`, names a shard file, and then says bundled decks can still be played, decks you built are not listed, and to reload to try again.
- [ ] All six bundled decks are still listed and **Start** still reaches the first prompt.
- [ ] In this state only, cards read `Card {code}` — no text was fetched. Confirm the duel is still playable: answer one prompt and end the turn.
- [ ] Turn **Offline** back off and reload — the panel is gone, `Manual T13` is listed again, and cards show real names.

The filter still refuses what it should

- [ ] In `#/decks`, build a deck with only 39 Main cards (or 4 copies of one card).
- [ ] Go to `#/duel` — that deck is absent from the list. It is not greyed out and there is no message about it.
- [ ] Return to `#/decks` — the deck is exactly as you left it. Nothing was renamed, repaired, re-saved, or deleted.

Nothing else moved

- [ ] Pick a bundled pair, press **Start**, and play three turns — the game loop, script loading and card images behave exactly as before.
- [ ] Surrender, then **Change decks** — the list returns with the same selection and does not auto-start.
- [ ] `#/decks` still opens, still autosaves (**Load → Autosaves** gains entries), and Undo/Redo still work.

Build shape

- [ ] Run `npm run build` and confirm `build:verify` reports `"battle"` at or below `316908` bytes, comfortably under the 488,750-byte budget — the two inlined card manifests left the bundle.
- [ ] Run `grep -rn "__ACTIVE_CARD_DATA__\|__ACTIVE_CARD_TEXTS__" src` — the only hit is a stale doc comment in `src/battle/app/presentation/card-preview.ts`, left untouched because that file was being hand-merged elsewhere. No build `define` and no runtime read remains.

## R1 round-2-review-fixes

Goal: six product-correctness defects found reviewing the round-2 diff. Run
against `npm run dev`.

Tokens are never offered and never enter a deck

- [ ] Open `#/decks`, open any deck, and search the catalog for `Token` — no entry named `… Token` appears. The catalog offers 14,551 cards, not the database's 14,794: the 243 Tokens are cards the duel creates on the field and no deck may hold.
- [ ] Search `Sheep Token` specifically — no result.
- [ ] Start a duel that summons Tokens (Scapegoat, or any Token-producing effect). Each Token on the field still shows its real name, never `Card {code}` — the duel and the editor still share one catalog read; only the editor's offer is narrowed.

"To sideboard" works with a finger, not only with a mouse

- [ ] Narrow the window below 1024 px (or use a phone) so the editor shows the **Deck / Catalog / Card** tab strip.
- [ ] Open the **Catalog** tab, tick **To sideboard**, tap a Main-deck card.
- [ ] The card lands in the **Side Deck**, and the live region says it was added to `side`. Before this fix the tap ignored the checkbox and put it in the Main Deck while announcing "Main Deck".
- [ ] Untick **To sideboard** and tap another card — it goes to the Main Deck as before.

Clicking one copy of a repeated card edits that copy

- [ ] Build a Main Deck reading, in order, card A, card B, card A (add A, add B, add A).
- [ ] Click the **third** tile. That tile is the one that moves to the Side Deck; the first A and B stay put, in that order.
- [ ] Repeat below the breakpoint: tap the third tile, choose **Remove from deck** — the third tile is the one that disappears.
- [ ] Undo twice and confirm the deck returns to A, B, A in that order.

A status message does not bring back a scrollbar

- [ ] At 1920×1080, open a deck and press **Duplicate**. The strip reading `Deck duplicated.` appears.
- [ ] The page does not gain a scrollbar while it shows, and the three panels still end at the bottom of the stage.
- [ ] Repeat for the save-failure and conflict strips (DevTools → Application → IndexedDB, or the e2e recovery scenario): both fit inside the stage too.

Dropping a card back where it was is not an edit

- [ ] Open **Load → Autosaves** and note the newest entry.
- [ ] Drag a deck tile and drop it back on its own slot. The deck is unchanged, and the editor says `Nothing to reorder.`
- [ ] Re-open **Load → Autosaves** — no new entry was written. A non-edit must not spend one of the 100 retained autosave slots.

A delete that fails stays on the deck

- [ ] Open the same deck in two tabs. In tab B, rename it (so its stored revision moves ahead of tab A's).
- [ ] In tab A, press **Delete** and confirm.
- [ ] Tab A reports that the deck could not be deleted and the URL stays on `#/decks/{deckId}` — it must not fall back to `#/decks` as though the deck were gone.
- [ ] Reload tab A — the deck is still there, under the name tab B gave it.

## R2 round-2-robustness-fixes

Goal: eight robustness defects found reviewing the round-2 diff, plus the
right-click half of R1.3. Run against `npm run dev` unless a step says
otherwise.

The catalog only accepts cards from this build's snapshot

- [ ] Open DevTools → Network, filter on `manifest`, then hard-reload `#/decks`.
      `runtime/current/manifest.json` is requested **once** before the 128
      catalog shard requests, and every request returns 200.
- [ ] Navigate to `#/duel` and back to `#/decks` without reloading — still no
      second manifest request. One read per page, shared by both surfaces.
- [ ] Serve a shard from another snapshot: in DevTools → Network, right-click
      `runtime/assets/current/catalog/cards/00.json` → **Override content**,
      change one card's name, then hard-reload. The editor stops with
      `Runtime catalog shard failed: assets/current/catalog/cards/00.json`
      rather than offering a card the duel would refuse. Delete the override
      afterwards.

The editor cannot hang waiting for a shard

- [ ] DevTools → Network → throttling → **Custom** → add a profile with 0 kb/s
      download, select it, then hard-reload `#/decks`. Within 30 seconds the
      loading skeleton gives way to the "Deck Editor stopped" screen naming a
      shard; it must not sit on the skeleton indefinitely.
- [ ] Set throttling back to **No throttling** and press **Retry** — the editor
      opens normally.

One failed read does not poison the other surface

- [ ] DevTools → Network → **Offline**, then load `#/duel` and wait for the
      "Card database" panel to appear.
- [ ] Turn Offline off, then navigate to `#/decks` **without reloading** — the
      editor fetches the catalog and opens. Before this fix it showed the
      stopped screen without attempting a fetch of its own.

The duel's card-database panel is not a life sentence

- [ ] DevTools → Network → **Offline**, load `#/duel`, and confirm the "Card
      database" panel appears with a **Retry card database** button, while the
      six bundled decks remain listed and playable.
- [ ] Turn Offline off and press **Retry card database** — the panel disappears
      and any decks you built appear in the picker.
- [ ] Confirm the duel is back to one viewport height with no banner over the
      field (settings → HUD and workspace both off).

Infinite scroll keeps going on a phone

- [ ] At 390×844, open a deck, open the **Catalog** tab and clear every filter
      (`14551 results`).
- [ ] Scroll the pane to the very bottom, repeatedly. The tile count keeps
      climbing past 600, past 1200, and on toward the full result count. Before
      this fix it stalled at 599 and no further scrolling ever added a card.
- [ ] The first render is still a window, not the whole database — roughly 300
      tiles before you scroll, and no freeze on opening the tab.

Right-click removes the copy under the pointer

- [ ] Above the breakpoint (1440×900), build a Main Deck reading, in order,
      card A, card B, card A.
- [ ] Right-click the **third** tile. That tile is the one that disappears; the
      first A and B stay put, in that order. Before this fix the first A went
      and the tile you clicked stayed on screen.
- [ ] Undo — the deck returns to A, B, A in that order.

## R3 round-2-test-quality-fixes

Goal: two product bugs found while strengthening the round-2 test suite. Run
against `npm run dev`.

"Set default" stays on the deck page

- [ ] Open any non-default deck. Click **Set default** in the deck header —
      the editor remains on the deck page; neither the library view nor the
      "Opening deck…" loading skeleton replaces it.
- [ ] Without navigating away, confirm **Set default** is now disabled, and
      that the **Default** badge has moved to that deck's row in the library
      panel.
- [ ] Open a second non-default deck and click **Set default** — the editor
      stays on the second deck's page; the badge moves to the second deck's
      row and the first deck's button becomes enabled again.
- [ ] Reload — the badge is still on the second deck's row after reload.

Drag to an illegal zone removes the copy under the pointer

- [ ] Build a Main Deck with, in order, card A, card B, card A (add A, then
      B, then A again — three separate tiles in that sequence).
- [ ] Drag the **third tile** (the second copy of A) onto the Extra Deck drop
      area, which shows a red border for a Main-canonical card. That tile is
      removed; the deck reads A, B in that order. Before this fix the first A
      was removed instead, leaving B, A.
- [ ] Undo — the deck returns to A, B, A in that order.

Drag cancel removes the copy under the pointer

- [ ] With the deck reading A, B, A, start dragging the **third tile** but
      release it outside every drop zone — over the page header, sidebar, or
      empty margin, not onto any deck zone.
- [ ] That tile is removed; the deck reads A, B in that order. Before this fix
      the first A was removed instead, leaving B, A.
- [ ] Undo — the deck returns to A, B, A in that order.

## T1 trunk-docs-and-baseline

No `src/` change, so nothing in the running app can regress. What a human verifies
is that the repo's own instructions now agree with how the repo is worked.

Read `AGENTS.md` top to bottom

- [ ] `## Purpose and status` no longer offers domain worktree lanes and points at
      ADR-045 instead.
- [ ] `### Branch model` replaces `### Branch ownership`, and nothing in the file
      tells an agent to commit on `duel`, `deck` or `vn`.
- [ ] `## Three-domain application direction` still names the same four directory
      owners; only the branch/worktree bullets are gone.
- [ ] `## Boundary rules`, `## File design policy`, `## HTML element contract`, the
      knowledge-graph section and the technical stack table read exactly as before.

Read the ADRs

- [ ] `docs/ADR/045_ADR_single_branch_trunk_development.md` states the decision, and
      its "import boundaries are unaffected" line is unambiguous.
- [ ] `docs/ADR/022_...worktree_boundaries.md` carries the partial-supersession line in
      its status block, and its import-boundary content is otherwise untouched.

Working copy

- [ ] `git worktree list` shows `main` plus `deckbuilder` only — `duel` and `vn` are
      gone. `deckbuilder` remaining is expected; removing it has not been authorised.
- [ ] Decide whether the `deckbuilder` worktree should now be retired too, since its
      branch is fully merged into `main`.

## T2 announce-number-response-index

`src/` changed by a comment only — the encoder itself shipped in `6d865e8`. What a human
still has to confirm is the runtime half no unit test can reach: that a real
announce-number prompt is answered, accepted by the core, and resolves as the number the
human actually picked.

Reach an announce-number prompt

- [ ] Start a duel with a deck holding a card that declares a number — "declare a
      Level", "declare a number from 1 to N", a Number-declaring effect — and activate it.
- [ ] A prompt appears with the heading "Announce a number" and one button per
      announced number.
- [ ] The button labels are the announced numbers themselves (for example 4, 6, 8) —
      not 0, 1, 2. Labels stay values; only the answer sent to the core is an index.

Answer it without killing the duel

- [ ] Pick the **last** button in the list — the largest announced number, the case that
      used to be out of range when sent as an index.
- [ ] No error panel appears. Specifically "ocgcore rejected the previous response" does
      not appear and the duel is not closed as failed.
- [ ] The duel continues: the next prompt or phase advance arrives normally.
- [ ] The effect resolves with the number that was picked, not another number from the
      list. The quiet half of the old bug announced a neighbour instead of aborting.

Repeat once from the other end

- [ ] Reach a second announce-number prompt (replay the effect, or restart the duel) and
      pick the **first** button this time. Same two checks: no error panel, and the
      number that resolves is the one picked.

If the bundled decks raise no announce-number prompt

- [ ] Record that here instead of checking the boxes above. The encoding stays pinned by
      `tests/unit/prompt-registry.test.ts` ("answers an announced number with its index
      rather than its value") and by the diagnostics trace cited in ADR-046; the manual
      pass is the only thing that observes it end to end in a browser.

## T3 response-encoder-audit

This slice changes no duel behaviour. `src/battle/worker/protocol/PromptRegistry.ts` is
byte-identical to its previous version once block comments are stripped; everything else
added is a test or an ADR section. So the pass below is a regression sweep across the
prompt kinds the pinning tests now cover, not a check of something new.

Confirm the duel is unchanged

- [ ] Start a duel from the bundled preset decks and play a few turns. Nothing about the
      prompts, the field or the log looks different from before this change.
- [ ] No error panel appears at any point. In particular "ocgcore rejected the previous
      response" does not appear and no duel closes as failed.

Answer each prompt kind you can reach and confirm the answer lands

- [ ] Main Phase: Summon a monster, then Set a different monster, then activate a
      Spell/Trap. Each time, the card that acts is the card that was picked — not its
      neighbour in the list.
- [ ] Battle Phase: with two or more monsters able to attack, attack with the **second**
      one in the list. The monster that attacks is the one picked.
- [ ] A yes/no prompt ("do you want to activate…"): answer No once and confirm the
      effect does not resolve, then reach it again and answer Yes.
- [ ] An effect with two or more options: pick the **last** option and confirm the
      effect that resolves is the one described by that option, not the first.
- [ ] A card-selection prompt asking for two or more cards: pick a non-contiguous pair,
      for example the second and fourth. Exactly those two cards are used.
- [ ] A summon-position prompt: choose face-down Defense and confirm the monster lands
      face-down in Defense, not face-up in Attack.
- [ ] A zone-placement prompt: pick a zone other than the leftmost. The card lands in the
      zone that was picked.
- [ ] A chain prompt with at least one candidate: choose Pass once and confirm the chain
      resolves without your card, then reach it again and chain the **second** candidate.
- [ ] A tribute prompt: pick the tributes explicitly and confirm exactly those monsters
      leave the field.
- [ ] An announce-number prompt: pick the last number offered. It resolves as the number
      picked and the duel continues. (Same check as the T2 section; repeated here because
      the sweep now covers every kind.)

Record what the bundled decks cannot reach

- [ ] Note here every prompt kind above that no bundled deck can raise — sort, counter
      allocation, select-sum, announce race/attribute/card, rock-paper-scissors are the
      likely ones. Those stay covered only by
      `tests/unit/prompt-registry.test.ts` (`describe("response encoding")`) and by the
      audit table in `docs/ADR/046_ADR_engine_response_encoding_contract.md`; no human
      has observed them end to end in a browser.
