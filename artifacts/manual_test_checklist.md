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
- [ ] Drag an actionable hand card after scrolling; confirm drag still starts and completes (a card with two legal actions for that zone now ends the drag in the drop confirmation — answer it, see T11).
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

- [ ] The first screen is the main menu: an "Echoes of the Draw" title with New Game, Load, Settings and Free Play (Continue too, once a save exists). NO deck picker and NO duel appear here. (Replaced by T15: the hub's "YGO Story Duel Simulator" title and its Story/Decks/Duel entries are gone.)
- [ ] Click Free Play: the URL becomes `#/free-play` and the deck picker loads; start a duel and play a turn — the duel behaves exactly as before. (Route renamed by T14; entry renamed by T15; the old `#/duel` still redirects here.)
- [ ] Press the browser Back button from the duel: you return to the main menu and the duel is gone.
- [ ] Open `http://localhost:4300/#/free-play/decks` in the address bar: the deck editor loads. (Corrected by T15: the main menu has no Decks entry — the free-play submenu that offers one lands in T16. The old `#/decks` still redirects here.)
- [ ] Click New Game: the URL becomes `#/story` and the visual novel loads. (Corrected by T15: this entry was "Story"; corrected by T7: the story is real, not a placeholder.)
- [ ] Type `http://localhost:4300/#/nonsense` in the address bar: you land back on the main menu, not on an error.
- [ ] Click Settings on the main menu: a settings dialog opens with a Fullscreen switch reading "Off" and a Close button.
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

- [ ] From the main menu at `http://localhost:4300/`, look over the whole screen and open Settings: there is NO Admin/Console/Developer button anywhere.
- [ ] Press Tab repeatedly through the main menu and the settings dialog: focus never lands on an admin control.
- [ ] Do the same sweep inside `#/duel` and `#/decks`: no admin control appears there either.
- [ ] Type `http://localhost:4300/#/admin` in the address bar: a "Developer console" screen loads with a warning line and three sections — Routes, State jumps, Resets.
- [ ] The console stays inside the 16:9 stage (letterbox bars are untouched) and scrolls with its own scrollbar if the window is short; the page itself never scrolls.
- [ ] In Routes, click `#/` → the main menu loads. Type `#/admin` again, click `#/free-play` → the deck picker loads. Type `#/admin` again, click `#/free-play/decks` → the deck editor loads. Type `#/admin` again, click `#/story` → the "Not available yet" placeholder shows. (Buttons are labelled by their route, so T14 renamed these two labels.)
- [ ] Back on `#/admin`, click "Seed test deck & open decks": the deck editor opens and the library lists a deck named "Admin test deck".
- [ ] Open that deck: it holds 40 Main-deck cards.
- [ ] Return to `#/admin` and click "Launch preset duel": the duel route opens with the normal deck picker, and no extra deck was written to the library.
- [ ] Return to `#/admin` and click "Open story": the visual-novel title screen shows. (Corrected by T7: this used to land on the placeholder.)
- [ ] Click "Reset…" next to "Free-play deck library": nothing is deleted yet — a "Delete for good" button and a "Cancel" button appear in its place.
- [ ] Click "Cancel": the row returns to a single "Reset…" button. Visit `#/decks` — "Admin test deck" is STILL there. A single stray click must never delete data.
- [ ] Back on `#/admin`, click "Reset…" on "Free-play deck library", then click "Reset…" on "Shell settings": only ONE row is armed at a time — the deck-library confirm disappears.
- [ ] Press Cancel, then arm "Free-play deck library" again and click "Delete for good": the status line reads "Cleared Free-play deck library." Visit `#/decks` — the library shows "No local decks".
- [ ] Repeat the arm-then-confirm flow for each remaining row (Duel snapshots, Shell settings, Story saves): each one asks for a separate confirmation and reports "Cleared …" when done. (Corrected by T7: the story row exists. Corrected by T13: it is now labelled "Story saves" and deletes the `ygo-story-saves` database, not a local-storage key.)
- [ ] After clearing "Shell settings", check devtools Application → Local Storage: the `ygo.ui.v3` entry is gone, and reloading the hub shows default settings.
- [ ] After clearing "Duel snapshots", start a duel from `#/duel` and play a turn: the duel still works (the snapshot store rebuilds itself).
- [ ] Reload `#/admin` after every reset: the console still loads and normal play from the main menu is unaffected.

## T7 story-domain-migration

Reach the story

- [ ] Run `npm run dev` (default `DEV_PORT=4300`) and open `http://localhost:4300/#/` — the main menu appears; click New Game and the URL becomes `#/story`. (Corrected by T15: the entry used to be "Story" on the home hub.)
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

- [ ] Run `npm run dev` (default `DEV_PORT=4300`) and open `http://localhost:4300/#/free-play/decks` — the deck editor loads. (Corrected by T15: the main menu replaced the home hub and offers no Decks entry; the free-play submenu that offers one lands in T16.)
- [ ] Open `http://localhost:4300/#/decks` directly — the "Deck Library" heading renders (an empty library says "No local decks"). The browser tab title reads "Deck Editor · YGO Story Duel Simulator", not "Deck Builder Prototype".
- [ ] Confirm there is NO "Prototype review states" panel in the bottom-right corner and no "State fixture" dropdown anywhere in the deck editor.
- [ ] Confirm the deck editor still looks exactly as it did before this ticket — this was a move, not a restyle.

Build and save a deck

- [ ] Click "Create deck", name it `Manual T8`, confirm — the editor opens with Catalog / Build deck / Select a card panels.
- [ ] Check the address bar: the URL is now `#/free-play/decks/<some-id>`, NOT `#/free-play/decks`.
- [ ] Type `Blue-Eyes` into the catalog Name search, drag "Blue-Eyes White Dragon" onto the Main Deck drop area — the Main Deck collapse bar reads `1/40`. (Corrected 2026-08-20: the "Deck counts" panel became a per-zone count in each collapse bar, and the "Saved locally" autosave chip went with the rest of the header chrome. Autosave is now checked through **Load → Autosaves**, which gains an entry per edit.)
- [ ] Press Undo then Redo — the count goes `0/40` then back to `1/40`, and **Load → Autosaves** keeps gaining entries.
- [ ] Right-click the Main Deck card, then choose **Move to Side Deck** from the tap menu (portrait) or confirm the move via the context menu (desktop) — the card moves and the counts follow.
- [ ] Edit the "Deck name" field to `Manual T8 Renamed` and click elsewhere to blur — the name sticks.

Deep link, reload and Back

- [ ] Copy the `#/free-play/decks/<id>` URL, reload the page — the same deck reopens directly, without bouncing through the library.
- [ ] Press the browser Back button — you land on the library at `#/free-play/decks` and the editor is gone.
- [ ] Press Forward — the same deck reopens.
- [ ] Open `http://localhost:4300/#/decks/no-such-deck` — a "Deck not found" page appears with a "Back to Deck Library" link; click it and the library at `#/decks` renders with your decks intact.

Import and export

- [ ] From the library, click "Import Deck", set the deck name to `Manual T8 Import`, paste `#main` / `99999999` / `#extra` / `!side` (one per line) into "Or paste YDK text", click "Preview import" then "Replace deck cards" — the editor opens on the imported deck and shows a "Missing card 99999999" tile.
- [ ] Confirm the URL moved to that imported deck's `#/free-play/decks/<id>`, then reload — the missing-card tile is still there.
- [ ] With the imported deck open in the editor, click **Export** in the deck header — the dialog warns the deck is invalid; copy to clipboard, then Close.
- [ ] Open another deck and click **Export** — the YDK text dialog opens for that deck and Close returns focus to the Export button.

Library CRUD

- [ ] Open a deck and click **Duplicate** in the deck header — the copy opens in the editor and the URL points at the copy, not the original.
- [ ] Edit the deck-name input to rename the deck and blur — the new name is saved.
- [ ] Click **Delete** in the deck header, confirm in the dialog — you land on the library and the row is gone; reload and confirm it stays gone.

Admin console jump

- [ ] Open `http://localhost:4300/#/admin`, click "Seed test deck & open it" — the editor opens directly on the seeded deck (name "Admin test deck") and the URL is `#/free-play/decks/admin-test-deck`.
- [ ] Back on `#/admin`, arm and confirm the "Free-play deck library" reset, then click the `#/free-play/decks` route button — the library shows "No local decks".

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
- [ ] Back on `#/admin`, arm and confirm the "Free-play deck library" reset, then open
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
      your finger is the one that previews and pins its zoom. Work along the
      whole hand, including the cards nearest each screen edge.
- [ ] Tap a graveyard/deck pile. The pile under your finger opens.
- [ ] Tap an action chip on a card. The chip under your finger fires, and not a
      neighbouring one.

Portrait: dragging, hands, dialogs and overlays

- [ ] Drag a card from your hand onto a highlighted zone. Two things must both
      be true: the ghost card **stays under your finger** the whole way (it must
      not shoot off at right angles to your movement), and the card is played
      into the zone you dropped it on — directly when only one action is legal
      there, or after you pick one in the drop confirmation when two are (T11).
      The confirmation itself reads the same way up as the board.
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
- [ ] Drag a card onto a zone — ghost, drop and settle behave exactly as before,
      except that a drop offering two legal actions now asks which one (T11)
      instead of picking the more committal one for you.
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
- [ ] Open `#/admin`, click **Reset Free-play deck library** and confirm, so no local deck exists.
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
- [ ] With no local deck at all (use `#/admin` → **Reset Free-play deck library**), `#/duel` renders only the **Bundled decks** group — no empty "Your decks" heading — and Start works. (Superseded by T15: opening `#/duel` now seeds a "Starter Deck", so a **Your decks** group holding exactly that one deck is the expected state here.)
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
- [ ] Play to your Main Phase 1 and activate **The Grand Spellbook Tower** from your hand — click the card to pin its zoom, then press **Activate** in the pinned action list.
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
- [ ] Move the pointer off the overlay entirely, having only hovered the card and never clicked it — overlay disappears. (A click pins it instead; see **T9 click-pinned-hand-zoom**.)
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

- [ ] With the target list visible, click the graveyard pile (or whichever stack pile holds the targets) — confirm the list **collapses** to a single `+` button (does **not** close/disappear). (Corrected by R6: a pile showing no card the player may see wears no halo, so the launcher is not always the haloed pile.)
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

- [ ] Hold Ctrl with the Full Control checkbox off — confirm the box stays **unticked**, the label turns accent-coloured and a "held by Ctrl" pill appears beside it; release Ctrl and confirm the pill disappears. (Corrected by R6: the label is a tooltip now, so hover or focus the box to see it turn accent-coloured.)
- [ ] With Ctrl held, click the Full Control checkbox — confirm it ticks and stays ticked after Ctrl is released.
- [ ] With Full Control on, trigger a chain window you opened yourself — confirm the window waits for you instead of auto-passing.
- [ ] Open a chain window while holding Ctrl, then release Ctrl while the window is still on screen — confirm nothing answers it for you.
- [ ] Rotate a phone-sized viewport into the portrait duel layout (device toolbar, e.g. 390x844) and hover a hand card near the right edge — confirm the zoom overlay stays inside the rotated board instead of being pulled toward the left edge.
- [ ] Rest the pointer on a hand card without moving it for a few seconds — confirm the zoom overlay mounts once and stays perfectly still, with no flicker or strobe.
- [ ] With the zoom overlay open, click the hand card itself — confirm the press reaches the card (the zoom freezes in place with an orange halo) even though the overlay art is drawn over it — then click it again to release, and drag it onto a highlighted zone: the drag still plays the card exactly as it does without the overlay.
- [ ] With the zoom overlay open, move the pointer straight up from the card onto the action chips above it — confirm the overlay stays open the whole way and the chip you click fires its action.
- [ ] Move the pointer off the card sideways, away from the overlay, without having clicked the card — confirm the overlay closes immediately.
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
- [ ] Confirm deletion — you land on `#/free-play/decks`; the deleted deck row is gone. Reload and confirm it stays gone.
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
- [ ] Tab A reports that the deck could not be deleted and the URL stays on `#/free-play/decks/{deckId}` — it must not fall back to `#/free-play/decks` as though the deck were gone.
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

## T4 hand-zoom-art-lease

- [ ] Start a duel with the preset decks and hover one of your own hand cards: the zoom
      overlay shows that card's real art — the same picture as the small card in the hand —
      not the grey "Image unavailable" placeholder.
- [ ] Move the pointer from one hand card to another without leaving the hand: each zoom
      shows its own card's art, never the previous card's.
- [ ] Hover an opponent hand card: the overlay shows the card back, and no card name or
      art of a hidden card appears anywhere.
- [ ] Hover a hand card whose art this build did not package (if the deck has one): only
      that card's zoom shows the "Image unavailable" placeholder, and no broken-image icon
      appears.
- [ ] Open a dozen hand zooms, then restart the duel from the HUD: field cards, hand cards
      and the tray still render their art, with no broken images and no blank tiles.

## T5 preview-effect-text-flow

- [ ] Start a duel with the preset decks and hover a monster in your hand: the effect text
      starts one small line-gap under the stats row — the same tight gap the rest of the
      panel uses — with no tall blank band between the stats line and the text.
- [ ] Hover a monster whose effect text is only one or two lines (a vanilla monster is
      ideal): the text still sits directly under the stats row, and the empty space is
      below the text, not above it.
- [ ] Hover a card with very long effect text (a Ritual or a long Pendulum effect): the
      stats line stays fully readable on its own line and no part of it is painted over
      the effect text.
- [ ] Read the effect text: the lines are left-aligned with a ragged right edge — no
      stretched word spacing, no text flush to both edges.
- [ ] With that long-text card still previewed, scroll the effect text with the wheel and
      with the keyboard (click the text, then Home / End / PageUp / PageDown): it scrolls,
      and the thin overlay scrollbar appears on the right edge of the text area only.
- [ ] Open the Deck Editor and hover a catalog tile: the preview there has no stats row,
      and its effect text still starts right under the card name and fills the panel down
      to the bottom edge.
- [ ] In the Deck Editor, hover a card with long effect text: the text area scrolls inside
      the panel rather than pushing the panel out of the layout.
- [ ] Narrow the window until the Deck Editor switches to its tabbed layout, open the card
      details tab and hover a card: the preview is still readable, with the effect text
      directly under the name and no giant gap.

## T6 end-turn-button-single-row

- [ ] Start a duel with the preset decks and look at the End turn button in the phase strip
      (bottom-right of the board, right-anchored beside the phase chips): its label sits on
      one single row, not broken over two.
- [ ] Compare it against the phase chips beside it: the End turn button is clearly the
      bigger control — taller, wider, and its text is noticeably larger than the chip text.
      (Corrected by R6: the button was trimmed to the shared 44px control floor, so it is
      still the bigger control but no longer towers over the chips.)
- [ ] Play forward to your Battle Phase so the button's label becomes "End Battle Phase":
      that longer label is also on one row, and the button simply grows leftwards to fit it.
- [ ] With the longer "End Battle Phase" label showing, check the button's left edge: it
      does not cover any card, zone outline or pile, and clicking a card near it still
      selects the card rather than the button.
- [ ] Click End turn: the phase actually passes (the phase strip's highlighted chip moves
      on, or the turn changes) — the bigger button is still a working control.
- [ ] Resize the window to 1280x720 and then to 1920x1080: at both sizes the label stays on
      one row and the button stays inside the board, hard against its right edge.
- [ ] Rotate to a portrait/mobile window (narrower than 1024px, taller than wide): the
      rotated field still shows the End turn label on one row, at a comfortable tap size.
- [ ] Confirm the button is still the amber "warning" colour with the same hover shade — the
      size change did not alter its colour or its disabled (dimmed) look while the opponent
      is thinking.

## T7 hand-band-safe-center

- [ ] Start a duel with the preset decks and look at the opponent's band along the top of
      the board: their five card backs sit as one adjacent group in the middle of the band,
      with no card pinned against the band's left or right edge.
- [ ] Look at the gaps between the opponent's backs: every gap is the same small one, with
      no wide hole opened up inside the row.
- [ ] Look at your own hand along the bottom: it is still one centred group, exactly as
      before this change.
- [ ] Draw cards until a hand no longer fits its band (roughly 10-12 cards at 1920x1080, or
      narrow the window until the cards overflow): the hand starts scrolling and its overlay
      scrollbar appears, for your hand and for the opponent's alike.
- [ ] With a hand overflowing, scroll it to both ends: every card can be brought fully into
      view, including the one at the end the band starts from — nothing is stranded outside
      the scrollable area.
- [ ] Play or discard down to a single card in hand: that one card sits centred in its band,
      not shoved to one side.
- [ ] Repeat the first check at 1280x720 and in a portrait/mobile window: both bands still
      group their cards at the centre after the field has been re-laid out or rotated.

## T8 hand-zoom-action-button-rows

- [ ] Start a duel with the preset decks and hover a hand card that has two or more legal
      actions (a monster you can both Summon and Set is the easiest): the actions appear
      above the zoomed card as a vertical list, one button per row, never two side by side.
- [ ] Look at the width of those buttons: each one spans the whole width of the zoomed card
      below it — left and right edges line up with the enlarged card's edges exactly.
- [ ] Read the button labels: the text is clearly larger than the small chip text on a
      field card's own menu, and each label fits inside its button with no clipped or
      overflowing words.
- [ ] Move the pointer straight up from the card onto the top button and pause there: the
      overlay stays open the whole way, and the button under the pointer highlights.
- [ ] Click that button: the action fires (the card is played or the prompt advances) and
      the overlay disappears.
- [ ] Hover a hand card that offers only one action: a single full-width button appears
      above it, in the same place and at the same width as the stack.
- [ ] Hover a hand card that offers no action at all: the zoom still appears with its art
      and name, and no button strip appears above it.
- [ ] Give a card on the field (not in hand) its own menu — click it to pin the menu, or
      tab to it so it takes focus: those chips are unchanged, still small and side by side
      in one row directly above the card, not stacked and not full width.
- [ ] Open a card list dialog (a browse or target prompt that lists cards): the action
      chips inside each list row are unchanged too.
- [ ] Resize to 1280x720 and then to 1920x1080, hovering a multi-action hand card at each:
      the buttons still fill the zoom's width at both sizes, and the label text grows with
      the bigger card rather than staying tiny.
- [ ] Rotate a phone-sized viewport into the portrait duel layout (device toolbar, e.g.
      390x844) and hover a multi-action hand card: the stack stays inside the rotated board
      and every button is still comfortably tappable.
- [ ] Confirm the browser console shows no errors during the above.

## T9 click-pinned-hand-zoom

Start a duel with the preset decks (`npm run dev`, `#/duel`) and play to your own
Main Phase 1, so the hand cards carry legal actions.

- [ ] Hover a hand card that has exactly ONE legal action (a Spell you can only Activate,
      or a monster you can only Set): the zoom opens as before. Now click the card. Nothing
      is played — no card leaves your hand, the life totals and the log do not move.
- [ ] While that card is clicked, look at it: the zoom stays frozen where it was, its action
      button stays in the same place, and the zoomed card wears an orange halo border.
- [ ] Move the pointer well away from the card and the buttons — across the field, over a
      pile, off the field entirely: the frozen zoom stays exactly where it was, orange halo
      and all. It does not follow the pointer and it does not close.
- [ ] With the zoom still frozen, hover a different hand card: the frozen zoom does not
      move to the new card and no second zoom opens.
- [ ] Click the frozen card a second time: the zoom closes, the halo goes, the card returns
      to its normal size in the hand, and still nothing has been played.
- [ ] Click a hand card again to freeze it, then click somewhere empty on the field: the
      zoom closes and nothing is played.
- [ ] Click a hand card again to freeze it, then press **Escape**: the zoom closes and
      nothing is played.
- [ ] Click a hand card to freeze it, then click one of its action buttons: that action
      fires (the card is played or the prompt advances), the zoom closes, and the halo goes.
      Exactly one action happens — not two.
- [ ] Repeat the whole sequence with a hand card that offers TWO or more actions (a monster
      you can both Summon and Set): the click freezes the zoom in the same way and lists
      both buttons; it does not fire either one on its own.
- [ ] Click a hand card to freeze it, then drag that same card onto a highlighted zone and
      release: the card is played by the drop, the frozen zoom is gone, and only one action
      happens.
- [ ] Click a hand card to freeze it and leave it frozen while the opponent takes an action
      (end your turn, or wait for a chain): the frozen zoom clears itself rather than
      hanging over a board that has moved on.
- [ ] Keyboard, unchanged: Tab or arrow to a hand card with two or more actions, press
      **Enter** — the small chip menu opens in the hand band as before and focus lands on
      the first chip, with NO enlarged overlay. Press **Escape**: focus returns to the card.
- [ ] Field cards are unchanged: click a monster on the field with one legal action — it
      still fires that action directly; click one with several — its chip menu still pins.
- [ ] Targeting is unchanged: reach a prompt that asks you to pick cards (a tribute or a
      discard) and click a hand card it names — it still selects/deselects for that prompt
      instead of freezing a zoom.
- [ ] Repeat one freeze/release cycle on a touch device or the browser's device toolbar:
      tapping a hand card freezes it, tapping it again releases it.
- [ ] Confirm the browser console shows no errors during the above.

## T10 stable-local-hand-order

Start a duel with the preset decks (`npm run dev`, `#/duel`) and play to your own
Main Phase 1. You need a card that searches your Deck (fetches a card to your hand);
if the preset hand offers none, play on until a Deck-search effect resolves.

- [ ] Before searching, read your hand left to right and write the order down.
- [ ] Resolve the search and pick a card: the fetched card appears at the **rightmost**
      end of your hand, and every card you wrote down is still in the same place, in the
      same left-to-right order. Nothing slides sideways to make room in the middle.
- [ ] Watch the hand through the rest of the turn — each further draw also lands at the
      right end, and no engine shuffle ever reorders the cards you already held.
- [ ] Play the card the search fetched (click it to pin its zoom, then click its action
      button): the card that leaves your hand is the one you clicked, not a neighbour.
- [ ] Play a card from the **middle** of your hand the same way: again the card that
      leaves is the one you clicked, and the cards on either side close the gap without
      otherwise reordering.
- [ ] Drag a hand card onto a highlighted zone and drop it: the dropped card is the one
      you dragged. If the drop confirmation opens (T11), the card it names is that same
      card, and the action you pick is played on it.
- [ ] Reach a prompt that asks you to pick cards in hand (a tribute, a discard, a cost):
      click the rightmost card — the card that highlights and the card the prompt resolves
      on are the one you clicked.
- [ ] Keyboard: Tab into your hand, then press the Right arrow repeatedly — focus walks
      your cards strictly left to right as you see them, with no jumping back and forth,
      and the Left arrow walks back the same way.
- [ ] Look at the opponent's band along the top: their card backs are unchanged, still one
      centred group in the same count, and nothing about your hand's order affects it.
- [ ] End your turn and take a second turn: the hand still holds its order from the
      previous turn plus the new draw at the right end.
- [ ] Confirm the browser console shows no errors during the above.

## T11 drop-action-confirm-modal

Start a duel with the preset decks (`npm run dev`, `#/duel`) and play to your own
Main Phase 1. You need a hand card the engine offers two ways to play into the same
zone: a Spell you may either activate or set is the case item 6 names, and almost any
Level 4 or lower monster (Summon or Set) is the case you will hit first.

- [ ] Drag a Spell from your hand onto an empty Spell & Trap Zone and release.
      A small window opens in the middle of the field, over everything else. It names
      the card you dragged, names the zone you dropped it on, and lists **Activate**,
      **Set** and **Cancel** — in that order, Activate first.
- [ ] Nothing has been played yet: the card is back in your hand behind the window,
      the zone is still empty, and the turn has not moved on.
- [ ] Press **Cancel**. The window closes and nothing at all happens: the card is still
      in your hand, the zone is still empty, and it is still your Main Phase 1 with the
      same cards everywhere. Repeat the drag — it still offers the same three buttons.
- [ ] Drag the same Spell onto the same zone again and press **Escape** instead. Same
      result as Cancel: nothing is played.
- [ ] Drag it again and click somewhere outside the window (on the dimmed area around
      it). Same result again: nothing is played.
- [ ] Drag it a fourth time and press **Set**. The card is set face-down in the zone you
      dropped it on — not in some other zone, and it is not activated.
- [ ] Now drag a monster onto an empty Monster Zone. The window offers **Summon**,
      **Set** and **Cancel**, with Summon first. Press **Summon**: the monster is
      summoned face-up in attack position, in that zone.
- [ ] Find a drop with only one legal action — for example a monster you can only Set
      because you have already Normal Summoned this turn. Drag it onto an empty Monster
      Zone: it plays straight away in the one gesture, with **no** window at all.
- [ ] Drag a card onto a zone it cannot be played into (an occupied zone, or the deck
      pile): as before, nothing happens, the card springs back, and no window opens.
- [ ] Keyboard: open the window with a drag. Focus is already on the first action button,
      so pressing Enter straight away plays that action; Tab moves along the buttons to
      Cancel. (Focus is not trapped inside the window — Tab past Cancel walks on into the
      board behind it. Escape closes the window from anywhere.)
- [ ] Confirm the browser console shows no errors during the above.

## T12 duel-replay-log-contract

This slice is the engine half of the recovery feature: the Worker learns to rebuild a
duel from its own recorded responses. Nothing it added is visible during a healthy
duel — the button that calls it lives on T13's fatal-error dialog — so these steps are
mostly about proving a normal duel is untouched. Run them with `npm run dev` on
`#/duel`.

- [ ] Start a duel with the preset decks and play three or four of your own decisions
      (summon, set, attack, end turn). Everything behaves exactly as before: prompts,
      the duel log, the opponent's turns, the field.
- [ ] Confirm the browser console shows no errors during the above.
- [ ] Surrender, then start a fresh duel from the same screen. The new duel starts
      normally and its opening hand is different from the one you just left.
- [ ] Press the duel result dialog's **Download diagnostics** button after that
      surrender and confirm a report still downloads, exactly as before this ticket.
- [ ] Confirm no **Restore** button appears anywhere in a healthy duel: not on the
      field, not in the duel log, not in the settings, and not on the result dialog
      after a surrender. (Since T13 it exists, but only on the dialog a *fatal* duel
      error opens — see `## T13 duel-error-recovery-dialog`.)

## T13 duel-error-recovery-dialog

This slice is the UI half of the recovery feature: a fatal duel error stops being a
dead end and becomes a dialog offering **Download diagnostics**, **Restore your last
decision** and **Try again**.

Automated coverage is the hard gate — `tests/component/BattleFacade.test.ts` drives the
dialog through every branch (opens on a fatal error, hides Restore when the trace holds
no human response, calls the Worker and closes on success, keeps itself open on a
failed or refused restore, still downloads, ignores `Escape`), and
`tests/integration/duel-replay-restore.test.ts` covers the replay behind it. These steps
confirm the same behaviour in a browser, which no automated suite covers.

Run them with `npm run dev` and open the printed URL at `#/duel`.

### A healthy duel never sees the dialog

- [ ] Start a duel with the preset decks and play three or four of your own decisions
      (summon, set, attack, end turn). No dialog appears, no Restore button appears,
      and the field, prompts and duel log behave exactly as before.
- [ ] Confirm the browser console shows no errors during the above.

### A rejected choice is still just a rejected choice

- [ ] Reach a prompt that asks for a specific number of cards (a tribute or a target
      selection). Submit a selection the engine refuses, or press the submit control
      with nothing selected.
- [ ] The **in-flow** warning panel appears in the page (not a modal), it offers
      **Dismiss**, and the board behind it stays fully usable. Press Dismiss: the panel
      goes away and you answer the same prompt again.
- [ ] No **Restore** button and no **Try again** button appear on that panel. A choice
      you can answer again is never a duel to rebuild.

### A duel that cannot start offers a dialog, and offers only what it can deliver

- [ ] Open DevTools → Network, reload `#/duel`, right-click the `duel.worker-*.js`
      request and choose **Block request URL**. Reload the page.
- [ ] A centred modal dialog appears over a dimmed backdrop. It has a heading naming
      the failure, a line reading `Error code: worker_error`, and a **Try again**
      button.
- [ ] There is **no** Restore button and **no** Download diagnostics button: no duel
      ever started, so there is no report to download and nothing to rebuild. This is
      the point of the slice — the dialog must never offer what it cannot deliver.
- [ ] Press `Escape`. The dialog stays exactly where it is: a dead duel has no safe
      dismissal.
- [ ] Click the dimmed area outside the dialog. Nothing is dismissed.
- [ ] Un-block the request (Network → right-click → **Unblock**), press **Try again**,
      and confirm the app comes back to the deck picker and a fresh duel starts.

### A duel killed mid-play offers the report and the restore

This needs a real rejection from `ygopro-core`, which is not reproducible on demand —
there is no failure-injection hook for it. Run this block whenever you do hit one; the
browser console shows `duel.worker.command.failed` and the dialog heading reads
`ocgcore rejected the previous response`.

- [ ] The dialog appears over the duel, centred and modal, with the heading above, the
      `Error code:` line, and the note **Contains the production seed.**
- [ ] Press **Download diagnostics**. A `ygo-duel-diagnostics-<snapshot>.json` file
      lands in your downloads and the dialog adds the line
      "Diagnostics downloaded. The file contains the production seed; share it
      carefully."
- [ ] The **Restore your last decision** button sits next to the download button, and
      is still there after the download. Press it: the label changes to
      "Rebuilding the duel…" while it works.
- [ ] The dialog closes on its own and the duel comes back at **your** last decision —
      the same prompt you answered before it died, with the same board, life points and
      graveyard. Answer it differently and keep playing.
- [ ] Confirm the browser console shows no errors after the restore.
- [ ] If the rebuild fails instead, the dialog stays open, adds a red line saying why
      (a different question, no decision left to rebuild from, or the rebuild could not
      run), the **Restore** button disappears, and **Download diagnostics** still works.
      Nothing fails silently.

## T14 route-table-contexts

Run `npm run dev` (default `DEV_PORT=4300`). Every route below is typed into the
address bar unless the step says to click something.

### Old links still land where they used to

- [ ] Open `http://localhost:4300/#/duel` — the free-play menu loads (T16 put it on that route); its Start a match entry opens the match setup, and Start the duel there begins the duel. (Corrected by T17: Start a match used to open the duel's own deck picker.) The address bar still reads `#/duel` (the redirect is what the app resolves, not a URL rewrite).
- [ ] Open `#/decks` — the Deck Library renders.
- [ ] Open `#/decks/<id>` for a deck you own — that deck opens in the editor.
- [ ] Open `#/duel/session/anything` — unchanged: the duel region shows, and a session nobody can resume still returns you to `#/story`.
- [ ] Open `#/admin` — the developer console still loads.

### The new context-carrying routes

- [ ] Open `#/free-play` — the free-play menu loads, same as `#/duel`.
- [ ] Open `#/free-play/decks` — the Deck Library renders.
- [ ] Open `#/free-play/decks/<id>` — that deck opens.
- [ ] Open `#/story/decks` — the Deck Library renders. (T23 gives it the save's decks; today both contexts read the same library.)
- [ ] Open `#/story/decks/<id>` — that deck opens.
- [ ] Open `#/free-play/collection` and `#/story/collection` — each shows the main menu, not a blank screen. (T29 replaces both with the real collection screen.)
- [ ] Open `#/story` — the visual novel still loads.

### Navigation keeps its context

- [ ] From `#/free-play/decks`, open a deck: the URL becomes `#/free-play/decks/<id>`.
- [ ] Press Back: you return to `#/free-play/decks`.
- [ ] From `#/story/decks`, open a deck: the URL becomes `#/story/decks/<id>` — it must NOT jump to `#/free-play/decks/<id>`.
- [ ] From `#/story/decks/<id>`, use the editor's own back-to-library path: you land on `#/story/decks`, still in the story context.

### Nothing unknown becomes a screen

- [ ] Open `#/free-play/nope`, `#/story/nope`, `#/free-play/decks/a/b` and `#/nonsense` — each falls back to the main menu at `#/`.

### The duel still spends the pillarbox

- [ ] On a window wider than 1024px, open `#/duel` (or `#/free-play`), press Start a match, then Start the duel (T17 added that second step), and confirm the duel field still uses the full window width, with the right rail absorbing the reclaimed space — exactly as before this ticket. In DevTools, `[data-cy="app-stage"]` carries `data-stage-route="free-play"`.
- [ ] Open `#/free-play/decks` at the same width: the deck editor still sits in the 16:9 stage with bars at the sides, unchanged.

### The developer console lists the new routes

- [ ] Open `#/admin` → Routes. There are buttons for `#/`, `#/free-play`, `#/free-play/decks`, `#/free-play/collection`, `#/story`, `#/story/decks` and `#/story/collection`, and none for `#/admin` itself.
- [ ] Click each one and confirm it lands on the screen its label names.

## T15 shell-main-menu-screen

Run `npm run dev` (default `DEV_PORT=4300`). The app's first screen is now the game's own main menu, not the developer-shaped home hub.

### The front door

- [ ] Open `http://localhost:4300/#/` with no hash of your own — an "Echoes of the Draw" title renders in a large serif over the dark blue gradient, above the line "One signal. One duel. More than one way forward." and an eyebrow reading "Private prototype · v0.1".
- [ ] The entries read, top to bottom: New Game, Load, Settings, Free Play. Free Play is LAST. There is no "Duel" and no "Decks" entry any more.
- [ ] "Press F11 for fullscreen." still sits under the entries.
- [ ] Nothing about a deck picker, a duel or a card appears on this screen.

### Continue appears only when there is something to continue

- [ ] In DevTools → Application → IndexedDB, delete `ygo-story-saves` if it is there, then reload `#/` — there is NO Continue entry, and the other four are unchanged.
- [ ] Still on `#/`, check DevTools → Application → IndexedDB again: `ygo-story-saves` is NOT listed. Merely looking at the menu must never create the database. (If it does, the story can never save again — that is the bug this step is watching for.)
- [ ] Click New Game, play far enough for the story to save (reach the map, or use its Save), then return to `#/` — Continue is now the second entry, between New Game and Load.
- [ ] Reload `#/` — Continue is still there.
- [ ] Open `#/admin`, arm and confirm the "Story saves" reset, then return to `#/` — Continue is gone again.

### Every entry goes where it says

- [ ] Click New Game — the URL becomes `#/story` and the visual novel loads.
- [ ] Press Back — you return to the main menu.
- [ ] Click Load — the URL becomes `#/story`.
- [ ] With a save present, click Continue — the URL becomes `#/story`.
- [ ] Click Free Play — the URL becomes `#/free-play` and the free-play menu loads (T16); its Start a match entry opens the match setup (T17, which replaced the duel's own deck picker here) — Start the duel and play a turn.
- [ ] Click Settings — a dialog opens ON TOP of the menu and the URL stays `#/` (no new hash, no navigation). Close it: the menu is exactly as you left it.

### The visual novel is still loaded lazily

- [ ] Open DevTools → Network, tick "Disable cache", and load `http://localhost:4300/#/` fresh. No `story-*.js` and no `story-*.css` request fires while only the menu is on screen.
- [ ] Now click New Game: `story-*.js` is requested at that moment, not before.
- [ ] Confirm no `.wasm` and no `runtime/` request fires on the menu, and no Worker appears under Application → Workers.

### Nothing else moved

- [ ] Open `#/free-play/decks` — the deck editor still loads and looks unchanged.
- [ ] Open `#/free-play/collection` and `#/story/collection` — each still shows the main menu rather than a blank screen (T29 replaces both).
- [ ] Open `#/nonsense` — you land on the main menu.
- [ ] Open `#/admin` → Routes and click `#/` — the main menu loads.
- [ ] Resize the window narrow and short: the menu stays readable and scrolls inside the stage rather than pushing a scrollbar onto the page.

## T16 free-play-menu-screen

Run `npm run dev` (default `DEV_PORT=4300`). Free play now has a menu of its own between the main menu and the duel.

### The menu

- [ ] Open `http://localhost:4300/#/` and click Free Play — the URL becomes `#/free-play` and a "Free Play" title renders over the same dark gradient as the main menu, above the line "Every card available. No story, no stakes."
- [ ] The entries read, top to bottom: Start a match, Deck builder, Return to main menu. Nothing about a deck picker, a card or a duel is on this screen.
- [ ] Type `#/free-play` into the address bar directly — the same menu, not a duel.
- [ ] Type `#/duel` — the same menu (the old link still resolves here, and the address bar keeps reading `#/duel`).

### Every entry goes where it says

- [ ] Click Deck builder — the URL becomes `#/free-play/decks` and the Deck Library renders.
- [ ] Press Back — you return to the free-play menu at `#/free-play`.
- [ ] Click Return to main menu — the URL becomes `#/` and the main menu renders.
- [ ] Click Free Play again, then Start a match — the match setup loads. (Corrected by T17: this used to be the duel's own deck picker.) Press Start the duel and play a turn.

### Leaving a match

- [ ] While the duel is on screen, a small "Leave match" button sits in the top-left corner. Click it — you are back on the free-play menu, and the URL is still `#/free-play`. (Corrected by T17: the match setup that now comes first carries its own Back button instead, and no "Leave match". Corrected again by R6: Leave match is an item of the duel's own options menu, under Surrender, rather than a button over the board.)
- [ ] Press Start a match again — the match setup opens again, and Start the duel begins a fresh duel. (Corrected by T17.)
- [ ] Start a match, then type `#/` in the address bar and go back to `#/free-play` — you land on the menu, not back inside the duel.
- [ ] Start a match, then press the browser's Back button — you leave free play for the main menu rather than staying in the duel.
- [ ] Play into a real duel and confirm the board's bottom edge (your hand band) is not cut off by the extra button, and that opening the duel's own options menu draws its dialog OVER "Leave match" rather than under it. (Retired by R6: there is no button over the board to draw over.)
- [ ] Enter a story duel instead (New Game → play to an encounter): that duel has NO "Leave match" button — the story owns that exit. (R6: and no Leave match item in its options menu, for the same reason.)

### The duel is still loaded only when a match starts

- [ ] Open DevTools → Network, tick "Disable cache", and load `http://localhost:4300/#/free-play` fresh. While only the menu is on screen: no `battle-*.js`, no `.wasm` and no `runtime/` request fires, and no Worker appears under Application → Workers.
- [ ] Click Start a match: `battle-*.js` and the runtime requests fire at that moment — the match setup reads its deck list from that same chunk. (Corrected by T17: the Worker itself appears one step later, when you press Start the duel.)

### On a phone-sized window

- [ ] With a portrait phone viewport (390x844 in DevTools), open `#/free-play` — the menu reads upright and is not rotated.
- [ ] Press Start a match — the match setup reads upright too (T17). Press Start the duel: the duel is turned a quarter turn as before, and "Leave match" turns with the board rather than staying upright in the corner of the screen. (Corrected by R6: Leave match moved into the duel's options menu, which the rotation already carried.)

## T17 free-play-opponent-picker

Run `npm run dev` (default `DEV_PORT=4300`). A free-play match now chooses both
decks before the duel starts, and remembers the pair.

### Both seats are a choice

- [ ] Open `http://localhost:4300/#/free-play` and click Start a match — a "Choose the decks" screen appears, NOT the duel. It shows two dropdowns, "Your deck" and "Opponent deck", plus Start the duel and Back.
- [ ] Both dropdowns list the same decks: a "Bundled decks" group with Starter (Player), Starter (Opponent), Burning Abyss, Nekroz, Shaddoll and Spellbook. Neither seat says anything about Shaddoll being auto-assigned.
- [ ] On first visit the pair reads Starter (Player) against Shaddoll.
- [ ] Set Your deck to Burning Abyss and Opponent deck to Nekroz, then press Start the duel — the duel starts immediately with NO second deck picker in front of it.
- [ ] Play a turn and confirm the opponent's deck really is the one you chose (surrender through the duel's options menu, then read the result dialog / open the duel log — the opponent's cards are Nekroz, not Shaddoll).

### Your own decks are offered for either seat

- [ ] Go to `#/free-play/decks` and build or import a deck the ruleset accepts (40+ cards, all from the packaged catalog).
- [ ] Return to `#/free-play` → Start a match. Both dropdowns now carry a second group, "Your decks", with that deck in it.
- [ ] Pick your own deck for Your deck and a bundled deck for the opponent, press Start the duel, and confirm the duel starts and your deck's cards are the ones in your hand.
- [ ] Pick your own deck for BOTH seats and start — the duel still begins.
- [ ] Build a deck of 39 cards in the editor. Back on the match setup, confirm it is offered in NEITHER dropdown.

### The pairing is remembered

- [ ] Choose Burning Abyss against Nekroz, press Start the duel, then leave through the options menu's Leave match. Press Start a match again — both dropdowns are already set to Burning Abyss and Nekroz.
- [ ] Reload the whole page (F5), open `#/free-play` → Start a match — still Burning Abyss against Nekroz.
- [ ] In DevTools → Application → Local Storage, open the `ygo.ui.v3` entry: it holds `"freePlayPairing":{"player":"preset:burning-abyss","opponent":"preset:nekroz"}`. No other key was added.
- [ ] Choose one of your own decks for a seat, start, leave, and come back — that deck is still selected.

### A remembered deck that is gone

- [ ] With one of your own decks selected for a seat and remembered (start a match, then leave), go to `#/free-play/decks` and DELETE that deck.
- [ ] Return to `#/free-play` → Start a match. The screen opens normally: the seat that pointed at the deleted deck has fallen back to a bundled deck, no error message is shown, and Start the duel is clickable.
- [ ] Instead of deleting it, EDIT that deck (add and remove a card so it is saved again), then come back to the match setup: the seat falls back the same way, because the remembered key names the revision the deck had.

### Back, and leaving

- [ ] From the match setup, press Back — you land on the free-play menu at `#/free-play`, and no duel was started.
- [ ] Press Start a match, then type `#/` in the address bar and navigate back to `#/free-play` — you land on the free-play menu, not back on the match setup.
- [ ] Press Start a match, press Start the duel, then leave through the options menu's Leave match — you land on the free-play menu. Press Start a match again: the setup screen, not the duel.
- [ ] Start a duel from the setup, surrender through the duel's options menu, and press "Change decks" in the result dialog — the duel's own picker opens and NO second duel starts by itself.

### The duel is still lazy

- [ ] Open DevTools → Network, tick "Disable cache", and load `http://localhost:4300/#/free-play` fresh. While only the free-play menu is on screen: no `battle-*.js`, no `.wasm` and no `runtime/` request.
- [ ] Click Start a match: `battle-*.js`, `FreePlayMatchSetup-*.js` and the `runtime/` catalog requests fire now.
- [ ] Under Application → Workers, no Worker exists yet. Press Start the duel — the Worker appears at that moment.

### A story duel is untouched

- [ ] New Game → play to an encounter and start it. That duel still opens the duel's OWN deck picker with the opponent fixed to Shaddoll, and offers no "Leave match" anywhere. The free-play match setup must not appear there.

### On a phone-sized window

- [ ] With a portrait phone viewport (390x844 in DevTools), open `#/free-play` → Start a match: the match setup reads upright, both dropdowns are reachable, and the screen scrolls inside the stage rather than pushing a scrollbar onto the page.
- [ ] Press Start the duel — the duel is turned a quarter turn as before.

## T18 story-state-decks-and-save-migration

Nothing on screen changes in this slice: no screen reads the new deck fields yet.
What is being checked is that the save file grew a deck list without losing anything.

### A save made before this change still opens

- [ ] Open `#/story`, press New Game, advance a few beats, visit the Card Shop, buy one pack and open it, then save to Manual slot 1. Write down the DP the wallet shows and which cards the collection holds.
- [ ] Open DevTools → Console and turn that record back into the shape the PREVIOUS build wrote — paste and run:
      `await new Promise(done => { const r = indexedDB.open("ygo-story-saves", 1); r.onsuccess = () => { const db = r.result; const tx = db.transaction("saves", "readwrite"); const store = tx.objectStore("saves"); const get = store.get("manual:1"); get.onsuccess = () => { const record = get.result; delete record.state.decks; delete record.state.defaultDeckId; store.put({ ...record, schemaVersion: 2 }, "manual:1"); }; tx.oncomplete = () => { db.close(); done(); }; }; });`
- [ ] Reload the page (F5), open `#/story` → Load, and load Manual slot 1. The story resumes on the screen it was saved on, the wallet shows the same DP, and the collection holds the same cards. No error banner appears and the slot is not shown as empty.
- [ ] In DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`, the `manual:1` record STILL reads `schemaVersion: 2` — loading an old save must not rewrite it.
- [ ] Save to Manual slot 1 again from inside the story. Only now does that record read `schemaVersion: 3`, with `decks: []` and `defaultDeckId: null` beside the wallet.

### A save from a newer build is refused rather than replaced

- [ ] Run the snippet above again with `schemaVersion: 4` in place of `2`, reload, and open `#/story`. A message names the slot and says the save was written by a newer version (schema 4); the story still starts.
- [ ] In DevTools → Application → IndexedDB, that `manual:1` record is still there, untouched. A save this build cannot read is never cleared for you.

### Nothing else moved

- [ ] Open `#/free-play/decks`: it lists exactly the decks it listed before, and `ygo-story-decks` in IndexedDB is unchanged. This slice does not touch the free-play deck library.
- [ ] Play a fresh New Game through the prologue to the map and start an encounter — the duel handoff still works, and the checkpoint slot still restores if you leave the duel.

## T19 story-deck-repository-adapter

Nothing on screen changes in this slice either: the adapter exists but no screen binds it
yet (T23 does that). What is being checked is that widening the story's public entry did
not drag the visual novel into the shell, and that neither the free-play deck library nor
an existing story save moved.

### The visual novel is still lazy

- [ ] Open DevTools → Network, tick "Disable cache", and load `http://localhost:4300/#/` fresh. On the main menu: no `story-*.js` request.
- [ ] Click through to the story. Only now does `story-*.js` load.
- [ ] In the same Network panel, note the transferred size of `story-*.js`. It is expected to be larger than before this slice — the deck error type it now shares with the editor comes with it.

### The free-play deck library is untouched

- [ ] Open `#/free-play/decks` and confirm it lists exactly the decks it listed before.
- [ ] Create a deck there, rename it, set it as default, favourite it, then reload the page (F5). All four survive.
- [ ] In DevTools → Application → IndexedDB, `ygo-story-decks` still holds those decks and no store was added, renamed or emptied.
- [ ] Delete one of those decks and confirm only that deck disappears.

### An existing story save still opens and still saves

- [ ] Open `#/story` → Load and load a save you already had. It resumes on the screen it was saved on, with the same DP and the same collection.
- [ ] Save to Manual slot 1 from inside the story. In DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`, that record reads `schemaVersion: 3` with `decks` and `defaultDeckId` beside the wallet.
- [ ] Reload the page (F5) and load that slot again — it opens normally rather than reporting a corrupt save.

### The deck editor still behaves for free play

- [ ] In `#/free-play/decks`, open a deck in two browser tabs, edit and save it in tab A, then edit and save the same deck in tab B. Tab B reports a conflict rather than silently overwriting tab A.
- [ ] Undo and redo an edit, then check the autosave list still shows the recent edits.

## T20 free-play-deck-library-split

No deck moves in this slice and no database is renamed. The editor now reaches its
repository through one entry point that a context chooses — free play until T23 wires the
story route — and the admin console says out loud which library it clears. So the thing to
check is that nothing changed for a player who already has decks.

### Decks built before this change are still there

- [ ] Before pulling this build, open `#/free-play/decks` and write down the name of every deck you have, plus which one carries the default badge and which ones are favourited.
- [ ] Load this build and open `#/free-play/decks` again. Every deck on that list is present, under the same name, in the same order (most recently edited first). The same deck is still the default and the same decks are still favourited.
- [ ] Open one of those older decks. Its Main/Extra/Side contents are unchanged and the card count matches what it had.
- [ ] In DevTools → Application → IndexedDB, the database is still named `ygo-story-decks` and there is no second deck database beside it. Its `decks` store holds the same rows as before.

### The editor still behaves for free play

- [ ] Create a deck, add and remove cards, rename it, undo and redo. Reload the page (F5): everything survived.
- [ ] Set a deck as default, favourite another, delete a third. Reload — the default, the favourite and the deletion all stuck.
- [ ] Open the same deck in two tabs, save in tab A then save in tab B: tab B reports a conflict instead of overwriting.
- [ ] Leave the deck editor and come back to it several times, then go to `#/admin` and reset the deck library. The reset completes rather than hanging on "another tab still has it open" — each visit released its database connection.

### The admin console names the right library

- [ ] Open `#/admin`. The first storage row now reads **Free-play deck library** rather than "Deck library".
- [ ] Arm and confirm that reset. The status line reads "Cleared Free-play deck library."
- [ ] The **Story saves** row is a separate entry and is untouched by that reset: load a story save afterwards and it still opens.

## T21 new-save-starter-grant

Starting a new story now hands the save a deck **and** the cards behind it, so the deck is
one the save owns from the first duel. The wallet is untouched at 1000 DP.

There is no story deck-list screen yet — that arrives with the story deck editor — so the
deck itself is checked in DevTools, while the granted cards are visible in the shop's Sell
screen, which reads the same collection.

The grant happens on save creation and nowhere else. The last section is the one that
matters most: a save that already exists must come back exactly as it was left.

### A new story save arrives with the Starter Deck

- [ ] Open `#/story` and choose **New Game**. The prologue starts as before, with no new prompt or delay on the button.
- [ ] Play to the map, enter the **Card Shop**, and open **Sell**. The list is not empty: it holds 16 different cards, among them 3× La Jinn the Mystical Genie of the Lamp, 3× Celtic Guardian, 2× Blue-Eyes White Dragon, 2× Summoned Skull and 2× Mirror Force.
- [ ] Counting every copy on that Sell list gives 40 cards.
- [ ] Leave the shop without selling. The DP counter still reads **1000** — the grant is cards, not credit.
- [ ] Save to Manual slot 1. In DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`, that record's `state.decks` holds exactly one deck, named `Starter Deck`, with 40 entries in `main` and none in `extra` or `side`.
- [ ] In the same record, `state.defaultDeckId` reads `story-starter-deck` and matches that deck's `id`.
- [ ] In the same record, `state.collection` has one entry per card code in the deck, each count equal to the number of copies the deck uses.
- [ ] Reload the page (F5) and load Manual slot 1. It opens normally rather than reporting a corrupt save, and the Sell screen still lists the same 40 cards.

### The granted deck is a legal deck

- [ ] In that save's `state.decks[0].validation`, no entry in `issues` has `"severity": "error"`. Two warnings are expected and correct — `empty-extra` and `empty-side` — because the starter deck has no Extra and no Side deck.
- [ ] Start a second **New Game** and compare its `state.decks[0]` against the first: same `id`, same `createdAt`, same card list. The grant is fixed, not generated per save.

### An existing save is not modified retroactively

- [ ] Before pulling this build, open `#/story`, load a save you already had, and write down its DP, the cards on its Sell list, and the screen it resumes on.
- [ ] Load this build and open that same save. It resumes on the same screen with the same DP, and the Sell list holds exactly the cards it held before — no starter cards were added to it.
- [ ] In DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`, that record's `state.decks` is still `[]` and `state.defaultDeckId` is still `null`. An older save is completed with an empty deck list, never with a granted one.
- [ ] Save that older save again, reload, and load it once more. It still holds no decks — nothing granted a deck on the way through.

### Free play keeps the deck it already had

- [ ] Open `#/free-play/decks` on this build with a library you already had. Every deck is present under the same name, the same deck is still the default, and no `Starter Deck` was added beside them.
- [ ] In a fresh profile or after clearing `ygo-story-decks`, open `#/free-play/decks` again. It seeds one `Starter Deck`, and opening it shows 40 Main Deck cards with no red error banner — in particular **2× Mirror Force and 1× Raigeki**, which is what the copy limits allow.

## T22 card-ownership-contract

Nothing on screen changes here. This slice lands the one function that later answers "how
many copies of this card may this context use" — the save's own count in a story,
unlimited in free play — and no screen reads it yet. Six later slices will: the story
catalog, deck legality, the sell dialog, the pre-battle picker and the collection screen.

Two things are worth a human's time. The contract deliberately sits in the shared deck
library rather than in the visual novel, and the point of that is the deck editor must
never pull the story in to ask the question. And the story's public entry was widened once
more, so the visual novel must still load only when the player goes there.

### The deck editor never loads the visual novel

- [ ] Open DevTools → Network, tick "Disable cache", and load `http://localhost:4300/#/` fresh. On the main menu: no `story-*.js` request and no `deck-editor-*.js` request.
- [ ] Go straight to `#/free-play/decks` and build a deck: add cards, remove cards, rename it, save. In the Network panel `deck-editor-*.js` loaded and **`story-*.js` never did**.
- [ ] Only after clicking through to the story does `story-*.js` appear in that panel.
- [ ] Note the transferred size of `deck-editor-*.js`. It is the same as before this slice — the editor gained nothing.

### Free play still behaves exactly as before

- [ ] In `#/free-play/decks`, open a deck you already had. Its Main/Extra/Side contents and card count are unchanged.
- [ ] Add a fourth copy of an ordinary card. The editor still refuses it at three, as it always did — free play owning every card does not raise the deck limit.
- [ ] Add a second copy of **Raigeki**. It is still refused at one copy. Ownership never overrides the pinned copy limit.
- [ ] Create, favourite, set as default and delete a deck, then reload (F5). All four stuck.

### An existing story save still opens, and its collection is untouched

- [ ] Open `#/story` → Load and load a save you already had. It resumes on the screen it was saved on, with the same DP.
- [ ] Enter the **Card Shop** → **Sell**. The list holds exactly the cards it held before — reading ownership changes nothing, and nothing on this screen consults it yet.
- [ ] Leave the shop without selling, save to Manual slot 1, reload the page (F5) and load that slot. It opens normally rather than reporting a corrupt save, and the Sell list is unchanged.
- [ ] In DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`, that record's `state.collection` is a plain map of card code to count, with no rarity and no new field beside it.

## T23 deck-editor-context-binding

One editor now serves two deck libraries, and the route decides which one it writes into.
`#/free-play/decks` is the database every deck ever built already lives in;
`#/story/decks` is the deck list inside the save the player would resume. Nothing moves
between them, so the thing worth a human's time is the separation itself: a deck built in
a story must never turn up in free play, and vice versa. The banner across the top of the
editor is what tells the player which one they are in.

The story context is the save Continue would resume — the newer of Manual slot 1 and the
autosave. A story deck route reached with no save at all goes to the main menu instead of
opening an empty editor.

### The banner names the world you are editing

- [ ] Open `#/free-play/decks`. A small line above the library reads **Free Play library**.
- [ ] Open a deck from that library. The banner is still there, still reading **Free Play library**, and the editor's three panels still reach the bottom of the stage with no scrollbar on the region.
- [ ] Start a story (`#/story` → New Game), play to the city map, and save to Manual slot 1. Now open `#/story/decks`. The banner reads **Story save:** followed by the chapter and the screen that save resumes on, e.g. `The Signal Beneath the City · City map`.

### A story deck does not appear in free play

- [ ] From `#/story/decks`, create a deck named `Story Only`. Add a few cards and let it save.
- [ ] Navigate to `#/free-play/decks`. `Story Only` is **not** listed. Every free-play deck you already had is.
- [ ] Reload the page (F5) on `#/free-play/decks`. Still no `Story Only`.
- [ ] In DevTools → Application → IndexedDB → `ygo-story-decks` → `decks`, there is no record named `Story Only`.

### A free-play deck does not appear in the story

- [ ] From `#/free-play/decks`, create a deck named `Free Only` and let it save.
- [ ] Navigate to `#/story/decks`. `Free Only` is **not** listed. The save's own decks are.
- [ ] Reload the page (F5) on `#/story/decks`. Still no `Free Only`, and `Story Only` is still there.
- [ ] In DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`, the `manual:1` record's `state.decks` holds `Story Only` and nothing named `Free Only`.

### Crossing between the two libraries rebinds the editor

- [ ] With both decks above in place, open `#/story/decks`, then press the browser **Back** button until you land on `#/free-play/decks`. The banner changes to **Free Play library** and the list changes with it — `Story Only` is gone, `Free Only` is there.
- [ ] Press **Forward** back to `#/story/decks`. The banner and the list swap back. Create one more deck here and confirm it lands in the story list, not the free-play one.

### A story deck edit reaches the save

- [ ] On `#/story/decks`, open `Story Only`, add two more cards, and wait for the editor to report the deck saved.
- [ ] Go to `#/story` and press **Continue**. The run resumes from the save.
- [ ] Return to `#/story/decks`. `Story Only` holds the two cards you just added.

### The story's own deck button goes to the story's decks

- [ ] Inside a story run, on the narrative or the city map, click the deck icon in the top bar. It opens the **story** deck library — the banner says `Story save:`, not `Free Play library`.

### A story deck route with no save goes to the main menu

- [ ] In DevTools → Application → IndexedDB, delete the `ygo-story-saves` database, then reload.
- [ ] Paste `#/story/decks` into the address bar. The main menu appears and the address becomes `#/`. No empty deck editor is shown, and no banner appears.
- [ ] Paste `#/free-play/decks`. It still opens normally — free play never needs a save.

### Free-play editing is unchanged

- [ ] In `#/free-play/decks`, create, rename, favourite, set as default, duplicate, export and delete a deck. All of it behaves as before, and each survives a reload (F5).
- [ ] Open `#/free-play/decks/no-such-deck`. The "Deck not found" screen appears; click **Back to Deck Library** and it lands on the free-play library.
- [ ] Do the same at `#/story/decks/no-such-deck` while a save exists. **Back to Deck Library** lands on the **story** library, not free play.

## T24 owned-only-story-catalog

Inside a story save the deck editor now builds only from the cards that save owns. The
catalog offers nothing else, and the add path is capped by the smaller of two numbers —
how many copies you own, and how many copies the pinned ruleset lets a deck run. Owning
five copies of a card limited to three still gets you three; owning one gets you one.

The cap counts every copy in the deck, Main, Extra and Side together, so moving a card to
the sideboard does not free a slot to add another.

Free play is the control. It owns every card without limit, so its catalog and its caps
must look exactly as they did before this slice — if anything there changed, this slice is
wrong.

### A new save's catalog is its starter deck and nothing else

- [ ] Start a **New Game**, get through to the city map, then open the story deck library (`#/story/decks`) and open the deck the save was granted.
- [ ] The catalog header reads **16 results**. That is the 16 distinct cards behind the starter deck — not the 14,551 free play offers.
- [ ] Search the catalog for a card you know is in the database but not in the starter deck (for example `Raigeki`). No row appears, and the empty state says to clear filters or try another name.
- [ ] Clear the search. It goes back to 16 results, not to the whole database — the filters run on the narrowed list.
- [ ] Use the **Card type**, **Subtype**, **Attribute** and **Monster type** dropdowns. Each narrows the 16, and each dropdown only offers values that exist among them.

### You cannot add a copy you do not have

- [ ] In the same deck, empty the Main Deck (right-click each tile, or click each and remove) so you are starting from zero.
- [ ] Find a card the starter deck gave you exactly **one** of. Click its catalog tile once: it lands in the Main Deck and the zone count goes to `1/40`.
- [ ] Click the same tile again. Nothing is added, the count stays `1/40`, and the message line under the deck name reads `<card name>: You own 1 of this card.`
- [ ] That tile now has a red border. Drag it toward the Main Deck: it will not pick up — the tile is no longer draggable.
- [ ] Right-click the same tile. Still nothing is added, and the same message appears — the context-menu add is capped too.
- [ ] Tick **To sideboard** in the catalog header, then click the tile again. Nothing lands in the Side Deck; the count there stays `0/15`. The cap counts the copy already sitting in the Main Deck.

### The ruleset's copy limit still applies on top

- [ ] Find a card the starter deck gave you **three or more** of, and click its tile four times.
- [ ] Three copies land. The fourth is refused with `Copy limit 3 reached.` — not with an ownership message. Owning more copies never raises the deck limit.
- [ ] Reload the page (F5) and reopen the deck. It holds the three copies you added, and the tile is still red.

### Free play is untouched

- [ ] Go to `#/free-play/decks` and open any deck. The catalog header reads **14,551 results**, exactly as before.
- [ ] Add four copies of an ordinary card: three land, the fourth is refused with `Copy limit 3 reached.`
- [ ] Add a second **Raigeki**: refused at one copy. Add **Obelisk the Tormentor**: refused outright as forbidden.
- [ ] Scroll the catalog to the bottom in one go. Tiles keep appending smoothly and the scroll does not get slower the further down you are.
- [ ] Search, filter, drag a card in, drag one out, undo, redo, save. All of it behaves as it did before this slice.

### The deck editor still never loads the visual novel

- [ ] DevTools → Network, tick "Disable cache", load `http://localhost:4300/#/` fresh, then go straight to `#/free-play/decks` and build a deck.
- [ ] `deck-editor-*.js` loaded and **`story-*.js` never did**. Only clicking through to the story fetches it.

## T25 ownership-deck-legality

A story deck that uses cards the save no longer owns is now reported illegal, and the
report names the card. Two questions stay apart in that verdict, and this slice is wrong
if they merge: **owning** a card and being **allowed to run** it. Selling your last copy
of a card a deck uses is an ownership error; putting four copies of a three-limit card in
a deck is a ruleset error; a deck can carry both at once and must say both.

Warnings are not illegal. The deck a new save is granted has no Extra and no Side deck, so
its honest verdict is two warnings — it must stay duel-able. If a fresh save's only deck
wears a red badge, this slice is wrong.

Free play owns every card without limit, so it can never raise an ownership error at all.

### Selling a card your deck uses badges the deck illegal

- [ ] Start a **New Game**, get to the city map, then open the story deck library (`#/story/decks`). The granted **Starter Deck** row has an **orange** halo and no badge next to its name — two warnings, not an error.
- [ ] Hover the row. The tooltip reads `Extra Deck is empty.` and `Side Deck is empty.` and nothing else.
- [ ] Open the deck, note the name of a card you have exactly **one** of, then go back to the city map and into the **shop → Sell Cards**.
- [ ] Sell that one copy, then return to the story deck library.
- [ ] The Starter Deck row now has a **red** halo and a red **CARDS NOT OWNED** badge next to its name.
- [ ] Hover the row. The tooltip names the card: `This deck uses 1 copy/copies of <card name>; you own 0.`
- [ ] Open the deck. The **Deck checks** panel lists that same sentence as an error (red, with a `×`), alongside the two empty-deck warnings.
- [ ] Click the error. The editor jumps to that card in the deck, exactly as it does for any other issue.
- [ ] Reload the page (F5) and reopen the library. The badge is still there — the verdict is recomputed from the save, not remembered from before the reload.

### Buying the card back clears it

- [ ] Go back to the shop and buy the card you sold.
- [ ] Return to the story deck library. The row is orange again, with no badge, and the tooltip is back to the two empty-deck warnings.

### The badge names the right thing to fix

- [ ] In a story deck, remove cards until the Main Deck is under 40, then sell a card that deck still uses.
- [ ] The row's badge reads **ILLEGAL**, not **CARDS NOT OWNED** — buying the card back alone would not make this deck legal, so the badge does not promise that it would.
- [ ] Hover the row: the tooltip lists both the size error and the ownership error, so nothing is hidden.
- [ ] Put the deck back to 40 cards without buying the card back. The badge changes to **CARDS NOT OWNED**.

### The two limits stay separate

- [ ] In a story deck, add three copies of a card you own at least three of. No error appears.
- [ ] Sell one copy of that card, then reopen the library. The deck is badged **CARDS NOT OWNED**, and the tooltip reads `This deck uses 3 copy/copies of <card name>; you own 2.`
- [ ] The message is about how many you *own*. It never says `Copy limit 3 reached.` — that wording belongs to the ruleset and only appears when you try to add a fourth copy.

### Free play is never badged for ownership

- [ ] Go to `#/free-play/decks`. No deck there ever wears a **CARDS NOT OWNED** badge, whatever it holds.
- [ ] Open a free-play deck, remove cards until it is under 40, and go back to the library. That deck is badged **ILLEGAL** — the badge itself still works in free play, it just never blames ownership.
- [ ] Import a YDK with four copies of an ordinary card into free play. The deck is badged **ILLEGAL** and the Deck checks panel says `<card name> allows 3 copy/copies; found 4.` — a ruleset error, not an ownership one.

### The paths that carry a whole deck at once are covered too

- [ ] In a story save, use **Import Deck** to import a YDK naming a card the save does not own at all.
- [ ] The import is accepted — nothing silently drops your cards — and the resulting deck is badged **CARDS NOT OWNED** with that card named in the tooltip.
- [ ] Duplicate a story deck that is already badged illegal. The copy is badged the same way.
- [ ] Restore an autosave entry for a deck whose cards you have since sold. The restored deck is badged illegal and names the card.

## R1 story-editor-no-starter-seed

Opening the deck editor never gives a story save a deck. Free play still seeds one, exactly
as before. The two are one call apart, so the free-play half is retested here rather than
assumed.

The bug this closes: a story save whose default deck is gone — deleted by the player, or
never set because the save migrated from an older schema — was handed a fresh 40-card
"Starter Deck" the moment the editor opened, with **none of its cards granted**. The
player's only deck was one badged **CARDS NOT OWNED** that the game will not let them
duel with. Cards are granted by **New Game** and by the shop, and nowhere else.

### Deleting a story save's default deck does not conjure a replacement

- [ ] Start a **New Game**, get to the city map, open the story deck library (`#/story/decks`). One row, **Starter Deck**, wearing the **Default** badge.
- [ ] Open it, click **Delete** from the deck page header and confirm. The library is now empty: it reads **No local decks** with a **Create blank deck** button, and no row carries a **Default** badge.
- [ ] Navigate away to the city map and back into the deck library. Still empty — no deck was seeded. Reload the page (F5), continue the save, reopen the library: still empty.
- [ ] DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`. That save's `state.decks` is `[]` and `state.defaultDeckId` is `null`.
- [ ] In the same record, `state.collection` is unchanged — the cards the deck used are still owned, exactly as they were before the delete. Nothing was granted and nothing was taken.

### The empty story library is not a dead end

- [ ] From that empty story library, click **Create blank deck**, type a name and confirm. The editor opens on the new empty deck.
- [ ] Go back to the library. The new deck is listed. Its halo is red and the **Deck checks** panel says the Main Deck is under 40 — correct for an empty deck, and repairable from the catalog on the left.
- [ ] The catalog on that deck page offers only cards this save owns, and adding them works normally.
- [ ] Reload the page and continue the save. The deck you built is still there.

### A save with no decks opens the editor cleanly

- [ ] Simulating an older save: in DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`, edit a save record so `state.decks` is `[]` and `state.defaultDeckId` is `null`, then load that save and open `#/story/decks`.
- [ ] The library opens on the empty state. No error banner, no loading skeleton that never resolves, and no deck appears in the list.

### Free play still seeds, unchanged

- [ ] DevTools → Application → Storage → **Clear site data**, reload, then open `#/free-play/decks`. Exactly one deck, **Starter Deck**, wearing the **Default** badge, with 40 Main Deck cards.
- [ ] Reload and reopen it. Still exactly one **Starter Deck** — no second one was added.
- [ ] Open it and delete it, then reload and reopen `#/free-play/decks`. A single fresh **Starter Deck** is seeded and marked default. Free play hands one out for as long as you keep deleting it; a story save never does.
- [ ] Open `#/duel` on a cleared free-play library. The picker's **Your decks** group still holds the seeded **Starter Deck** — the duel's own seeding path is untouched by this change.

### A save that already caught the bug

- [ ] If a save built on an earlier build already carries an unowned **Starter Deck** — red halo, **CARDS NOT OWNED** — this change does not remove it. Delete that deck from the deck page; the library stays empty and nothing replaces it.

## T26 sell-breaks-decks-confirmation

Selling cards a deck depends on names those decks before the sale commits. The warning
informs, it never refuses: confirming sells exactly what was selected and leaves those
decks illegal, cancelling sells nothing at all.

The half that is just as important: a sale that breaks nothing shows no dialog. A
confirmation that fires on every sale is one the player learns to click through.

### A sale that would break a deck warns first

- [ ] Start a **New Game** and walk to the city map, then enter the **card shop** and reach the keeper's menu.
- [ ] Choose **Sell**. The grid lists the cards the starter grant gave you, **Blue-Eyes White Dragon** among them, **Owned 2**.
- [ ] Press **+** once on Blue-Eyes, then press **Sell**. A dialog appears — it does **not** sell yet — headed **Sell cards these decks use?**, listing **Starter Deck** with **Blue-Eyes White Dragon** under it.
- [ ] The DP counter in the top bar has not moved, and the card is still in the grid at **Owned 2**.
- [ ] Press **Keep the cards** (the red one). The dialog closes, DP is unchanged, and the stepper still reads **1** — the selection survived the cancel.
- [ ] Press **Sell** again. The same dialog comes back. Press **Sell anyway**. Now DP rises by the Blue-Eyes price and the grid shows **Owned 1**.
- [ ] Open the story deck library (`#/story/decks`). **Starter Deck** is badged **CARDS NOT OWNED** — the sale was allowed to break it, exactly as confirmed.

### A sale that breaks nothing shows no dialog

- [ ] Back in the shop, buy a pack and open it, then go to **Sell**.
- [ ] Sell one copy of a card that came out of that pack and is **not** in any of your decks. No dialog appears at all — the sale commits straight away and DP rises.
- [ ] Find a card your deck uses where **Owned** is higher than the number of copies the deck runs (buy a spare single of one of your deck's cards if you have none). Sell down to exactly the number the deck runs. Still no dialog: spare copies are not the deck's copies.
- [ ] Sell one more of that same card, so the deck is left short. Now the dialog appears and names the deck.

### Several decks, several cards

- [ ] Build a second deck in the story deck editor that reuses a card your first deck already runs, so both decks depend on your last copies.
- [ ] Go to **Sell**, select that card, press **Sell**. The dialog lists **both** decks, each with the card under it.
- [ ] Select two different cards from two different decks in one go. One dialog appears, naming every deck the sale would break and every card at fault under it.

### Keyboard and focus

- [ ] Open the dialog again. Focus starts on **Keep the cards**, so pressing **Enter** straight away cancels rather than sells.
- [ ] Press **Escape**. The dialog closes and nothing was sold.
- [ ] With the dialog open, **Tab** cycles only between **Sell anyway** and **Keep the cards** — the sell grid behind it cannot be reached or clicked.
- [ ] After cancelling, focus is back on the **Sell** button you pressed.

### A deck that was already illegal is not blamed on the sale

- [ ] Take a save whose deck is already badged **CARDS NOT OWNED** (sell a card it uses, as above, and leave it broken).
- [ ] Go back to **Sell** and sell one copy of a completely different card that no deck uses. No dialog — the already-broken deck is not reported, because this sale is not what broke it.

## T27 pre-battle-deck-picker-legality

The briefing before a story encounter now picks the deck the duel will use, out of the
save's own decks. Legality is recomputed against the live card database and this save's
collection every time the screen opens — the verdict stored on the deck record is a cache
built with no catalog and is never trusted.

Illegal means **errors**, never warnings. The deck a new game grants has no Extra and no
Side deck, so it validates to *warnings* — and it must still start a duel. That case is the
first one below, and it is the one that breaks worst: a gate that demanded a clean deck
would lock every new player out of their very first encounter.

### A brand-new save starts its first encounter on the deck it was granted

- [ ] DevTools → Application → Storage → **Clear site data**, reload, open `#/story`, press **New Game**.
- [ ] Tap through the prologue to the city map, then choose **Old Arena**.
- [ ] The briefing shows **Choose your deck** with exactly one deck, **Starter Deck**, highlighted as selected. **Your deck** in the fact list reads **Starter Deck** — not a hardcoded name.
- [ ] Briefly, while the card database loads, **Start Duel** is disabled and the picker reads *Checking your decks against the card database…*. It becomes enabled on its own within a few seconds. Nothing has to be clicked to unstick it.
- [ ] No red border, no error text, no block message anywhere — the empty Extra and Side deck are warnings, not errors.
- [ ] Press **Start Duel**. The duel starts as before.

### A deck the save no longer owns the cards for is refused by name

- [ ] From the map, enter the **card shop**, choose **Sell**, and sell a copy of a card **Starter Deck** uses (**Blue-Eyes White Dragon** works; confirm through the T26 warning dialog).
- [ ] Leave the shop, choose **Old Arena**.
- [ ] **Starter Deck** is listed with a red border and cannot be clicked. Under it is the first error, naming the card: *This deck uses N copy/copies of Blue-Eyes White Dragon; you own M.*
- [ ] **Start Duel** is disabled. Below the list, a block message names the deck and repeats the reason.
- [ ] **Return to Map** still works. This is the way out that never depends on the card database, and it is always there.

### The block links to the story deck editor, not free play's

- [ ] From that blocked briefing, press **Open the deck editor**. The URL becomes `#/story/decks` and the story deck library opens — the decks listed are this save's, and **Starter Deck** wears the **CARDS NOT OWNED** badge there too. The two screens agree.
- [ ] Progress comes with you: this button writes the run to the autosave slot before the route changes, so the editor opens the save you were just playing. See the R3 section at the end of this file for the full check, including what happens when that write is refused. (The top bar's deck icon is *not* this button and does not write — save first, pause menu → Save, if you leave that way.)

### Choosing a different deck, and the choice sticking

- [ ] Open `#/story/decks`, build a second deck of 40 cards you do own, and go back to `#/story`.
- [ ] Reach the briefing. The broken deck is still preselected and still blocks — it is your save's default and you are told so rather than quietly moved off it.
- [ ] Click the new deck. The red block disappears, **Your deck** updates to its name, and **Start Duel** enables.
- [ ] Press **Return to Map**, then choose **Old Arena** again. The new deck is still the selected one — the pick was written into the save, not just into the screen.
- [ ] Press **Start Duel**. The duel starts on that deck.

### A save with no decks at all

- [ ] In DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`, edit your save record so `state.decks` is `[]` and `state.defaultDeckId` is `null`. Reload and load that save.
- [ ] Choose **Old Arena**. No deck list appears. The block reads *This save has no decks yet. Build one to duel with.* and the link is labelled **Build a deck**.
- [ ] **Start Duel** is disabled and **Return to Map** works.

### A card database that will not load

- [ ] DevTools → Network → **Offline**, then reload and reach the briefing (load a save that is already on the map).
- [ ] The picker shows *The card database could not load.* with a **Try again** button. **Start Duel** is disabled — it never guesses a verdict without the catalog.
- [ ] Turn Network back **Online** and press **Try again**. The deck list appears and **Start Duel** enables.
- [ ] Repeat with the network still offline and press **Return to Map** instead. It works — a failed read never traps you on this screen.

### Keyboard and screen reader

- [ ] Tab through the briefing. Every legal deck button is reachable and shows a focus ring; illegal ones are skipped, being disabled.
- [ ] Press **Space** or **Enter** on a legal deck. It becomes the selection and **Start Duel** enables.
- [ ] With a screen reader on, the picker list is announced under its **Choose your deck** heading, and the block message is announced when it appears.

## T28 story-duel-uses-save-deck

An encounter is now fought with the deck the save chose at the briefing, not with a bundled
preset. **Start Duel** goes straight to the field: the duel's own deck picker never appears
inside a story session, because both seats are already decided — your save's deck for you,
the encounter's fixed preset for the opponent.

"A duel started" is not evidence here. The hand is what has to be read.

### The opening hand is dealt from the deck you picked

- [ ] Open `#/story/decks` and open the deck your save duels with. Write down its name and five card names you can recognise on sight.
- [ ] Go back to `#/story`, continue the save, and choose **Old Arena**. The briefing's **Your deck** line reads the deck you just looked at.
- [ ] Press **Start Duel**. The duel field comes up on its own — no **Choose your decks** screen, no second **Start duel** button. The field is the next thing you see.
- [ ] Hover each card in your opening hand in turn. The preview panel beside the field names it. **Every name is on the list you wrote down** — that is the check this ticket exists for. A name that is not on that list means the duel was dealt some other deck.
- [ ] Play the duel a few turns and keep hovering what you draw. Still only cards from that deck.
- [ ] The opponent is unchanged: they play the encounter's bundled preset, as they always have. Only your seat comes from the save.

### A different deck deals a different hand

- [ ] Open `#/story/decks` and build a second 40-card deck out of cards you own, using cards the first deck does not hold. Note five of them.
- [ ] Return to `#/story`, reach the briefing, and click that second deck. **Your deck** updates to its name.
- [ ] Press **Start Duel** and hover the opening hand. The names now come from the second list, not the first. The hand changed because the deck did.

### A brand-new save fights its first encounter on the granted deck

- [ ] DevTools → Application → Storage → **Clear site data**, reload, `#/story`, **New Game**, tap through to the map, choose **Old Arena**.
- [ ] **Start Duel** is enabled and the duel starts. The granted **Starter Deck** has no Extra and no Side deck, which are warnings, never errors — a fresh save must never be locked out of its first duel.
- [ ] Hover the opening hand. The cards are Starter Deck cards, the same list `#/story/decks` shows for that save.

### A reload mid-duel resumes on the same deck

- [ ] With a story duel on screen, reload the page (F5). The URL stays on `#/duel/session/…`.
- [ ] The duel comes back by itself — no deck picker in between.
- [ ] Hover the hand. The cards are from the same deck the encounter started on, not from a preset.

### The story's branches still fire, and progress survives

- [ ] Surrender through the duel menu. The story reaches its **Duel paused** / abort scene and grants no reward.
- [ ] Start the encounter again and press browser **Back** from the duel. Same abort scene, progress intact.
- [ ] Play one encounter to a win. The win scene shows, its reward is granted, and the map updates.
- [ ] After any of these, the save you return to is the save you left — same money, same cards, same decks, same default deck as before the duel.

## T29 collection-screen

The collection is a browsable card list for one world at a time: `#/story/collection` is the
loaded save's own cards, `#/free-play/collection` is the whole card database. Both use the set
list's grid and the shared card preview panel. The steps below reach them by typing the hash, so
the screen is checked on its own; the button that opens it is T30's.

### The story collection is the save's own cards, at its own counts

- [ ] Continue a save that has bought or opened some cards, then type `#/story/collection` into the address bar.
- [ ] The heading reads **Your collection**. Only cards this save owns are on screen — a card you have never owned is not there.
- [ ] Every tile carries a small count under its name. Buy a second copy of a card in the shop, come back, and that card's count has gone from 1 to 2.
- [ ] Sell a card down to zero copies in the shop, come back, and it has left the list entirely.

### Show every existing card

- [ ] The **Show every existing card** checkbox starts unticked.
- [ ] Tick it. The list grows to the whole database, and every card you do not own is visibly dimmed against the ones you do.
- [ ] The dimmed cards carry no count; the ones you own still do.
- [ ] Untick it. The list returns to your own cards only.

### Grouping and ordering

- [ ] **Group by rarity** starts ticked. The list is broken into headed sections running Common → Rare → Super Rare → Ultra Rare → Secret Rare → Ultimate Rare → Ghost Rare, and each heading carries that rarity's halo colour. A rarity you own nothing of has no heading at all.
- [ ] Inside each section the card names run alphabetically.
- [ ] Untick **Group by rarity**. The headings disappear and the whole list is one alphabetical run.

### The preview panel

- [ ] Hover a tile. The panel on the left fills with that card's art, name and rules text.
- [ ] Click a tile. Same panel, same card — it is the preview the deck editor and the duel use, not a new one.
- [ ] Tab through the tiles with the keyboard. Focus moves tile to tile, each focused tile fills the preview, and the focus ring is visible.

### Free play is the whole database, with no counts

- [ ] Type `#/free-play/collection`. The heading reads **Card database**.
- [ ] There are no counts anywhere, and no **Show every existing card** checkbox — free play owns everything, so there is nothing to reveal and nothing to count.
- [ ] Scroll to the bottom of the grid. More cards keep appending as you go, rather than the page trying to draw all 14,794 at once. Scrolling stays smooth.
- [ ] Grouping and the preview behave exactly as they do in the story collection.

### Getting out, and the routes that should not open

- [ ] Press **← Back** from `#/free-play/collection`. You land on `#/free-play/decks`.
- [ ] Press **← Back** from `#/story/collection`. You land on `#/story/decks`.
- [ ] With no save loaded at all (DevTools → Application → Storage → **Clear site data**, reload), type `#/story/collection`. You are sent straight to the main menu instead of an empty collection.
- [ ] `#/free-play/collection` still opens after clearing site data — free play needs no save.

### Nothing else moved

- [ ] The shop's set list, the booster reveal and the sell screen look and behave exactly as before.
- [ ] The deck editor opens and edits normally from both `#/free-play/decks` and `#/story/decks`.

## T30 collection-entry-points

The collection stops being a hash you have to know. The deck menu — the same one screen in both
worlds — now carries a **Collection** button, and it opens the collection belonging to the world
that menu is bound to. Every step below is a round trip: go in, and come back out to the menu you
pressed the button in. A door that only opens one way is the failure here.

### Free play: in and back out

- [ ] From the main menu press **Free Play**, then **Deck builder**. You are on `#/free-play/decks`.
- [ ] The toolbar row above the deck list reads: search box, **Sort**, **Collection**, **Import Deck**, **Create deck**.
- [ ] Press **Collection**. The address bar becomes `#/free-play/collection` and the heading reads **Card database**.
- [ ] Press **← Back**. You land back on `#/free-play/decks`, with your free-play decks listed exactly as you left them.
- [ ] Do the round trip a second time. Nothing accumulates: still one collection screen, still one deck library, no duplicated toolbar.
- [ ] Use the browser's own Back button instead of **← Back** the third time. It also returns you to `#/free-play/decks`.

### A story save: in and back out

- [ ] From the main menu press **Continue** (or **Load**) into a save that owns some cards, and get to the map.
- [ ] Press the deck icon in the top bar. You land on `#/story/decks` — this save's decks, not free play's library. The banner above the list names the save.
- [ ] Press **Collection**. The address bar becomes `#/story/collection` and the heading reads **Your collection** — your own cards, with their counts, and the **Show every existing card** checkbox.
- [ ] Press **← Back**. You land back on `#/story/decks`, still naming the same save, still listing that save's decks.
- [ ] Press the top bar's deck icon again from the map, then **Collection**, then **← Back**, then the browser's Back button repeatedly. You walk back out through `#/story/decks` and never get stranded on a screen with no way off it.

### The two worlds never cross

- [ ] Open the collection from `#/free-play/decks`. It is the whole database, with no counts and no **Show every existing card** checkbox.
- [ ] Without reloading, go to `#/story/decks` and open the collection from there. It is the save's own cards, with counts. The free-play database is not what you see.
- [ ] Go back to `#/free-play/decks` and open the collection again. It is the database again — the previous save's cards are not still on screen.
- [ ] With no save loaded (DevTools → Application → Storage → **Clear site data**, reload), `#/free-play/decks` still offers **Collection** and it still opens.

### Nothing else moved

- [ ] **Import Deck** and **Create deck** still do what they always did, and **Create deck** is still the last button in the row.
- [ ] Opening a deck, editing it and returning to the library all behave exactly as before, in both worlds.
- [ ] Narrow the window until the toolbar wraps onto two lines. All five controls are still reachable and none is cut off.
- [ ] Tab through the toolbar with the keyboard. Focus reaches **Collection** between **Sort** and **Import Deck**, its focus ring is visible, and Enter opens the collection.

## T31 set-image-acquisition-pipeline

Nothing on screen changes here. This slice acquires the 50 shop sets' official art into
`generated/set-images/`, pins every byte with a sha256 manifest, and publishes them as plain
static URLs at `{BASE_URL}runtime/sets/{setId}.jpg`. What you are testing is the pipeline's
honesty: it must fail loudly when the bytes drift, and it must degrade quietly when the art was
never acquired. `generated/` is git-ignored, so nothing here ends up in a commit.

### Acquire and verify

- [ ] Run `npm run assets:sets`. It prints `"status": "ok"` with `"sets": 50`, `"downloaded": 50`, `"missing": []`, and takes roughly 20 seconds.
- [ ] Run `ls generated/set-images`. There are 50 `.jpg` files named after the shop set ids (`legend-of-blue-eyes-white-dragon.jpg`, `metal-raiders.jpg`, …) plus one `manifest.json`.
- [ ] Open `generated/set-images/manifest.json`. Every entry carries `setId`, `sha256`, `bytes` and a `sourceUrl` on `https://images.ygoprodeck.com/images/sets/`, and `missing` is an empty list.
- [ ] Run `npm run assets:sets:verify`. It prints `"status": "ok"` with `"sets": 50` and no failures.
- [ ] Run `npm run assets:sets` a second time and confirm `manifest.json` is byte-identical to before (`sha256sum generated/set-images/manifest.json` matches). Two acquisitions of the same upstream produce the same pin.

### It fails loudly when the bytes drift

- [ ] Change one byte of `generated/set-images/metal-raiders.jpg` (any hex editor, or open and re-save it). Run `npm run assets:sets:verify`: it exits non-zero and the failure names `metal-raiders`, with the expected and found digests.
- [ ] Delete `generated/set-images/spell-ruler.jpg`. Verify fails with `Set image is missing: spell-ruler`.
- [ ] Copy any set image to `generated/set-images/not-a-shop-set.jpg`. Verify fails with `Set image is not listed in the manifest: not-a-shop-set.jpg`.
- [ ] Run `npm run assets:sets` once more. It repairs all three: the stray file is pruned, the deleted and corrupted images are re-downloaded, and `npm run assets:sets:verify` is `"status": "ok"` again.
- [ ] Run `npm run check:headless`. It passes, and its `assets:verify` step now prints two `"status": "ok"` blocks — the data snapshot's and the set images'.

### Missing art degrades, it never breaks

- [ ] Move the whole folder away: `mv generated/set-images /tmp/`. Run `npm run assets:sets:verify` — it fails with a message naming the absent `generated/set-images/manifest.json` and telling you to run `npm run assets:sets`.
- [ ] With the folder still moved away, run `npm run build`. It **succeeds**, and `ls dist/runtime` has no `sets` directory. A contributor who has never acquired set art can still build the app; the shop simply has no art to show.
- [ ] Move the folder back (`mv /tmp/set-images generated/`) and run `npm run build` again. Now `ls dist/runtime/sets | wc -l` is 50.

### Works with the network unplugged

- [ ] Disconnect the network (or turn off Wi-Fi). Run `npm run assets:sets:verify` — still `"status": "ok"`. Verification only re-hashes local files.
- [ ] Still offline, run `npm run build` and `npm run check:headless`. Both pass. Reconnect afterwards.

### The images are reachable in the browser

- [ ] Run `npm run dev` and open `http://localhost:4202/runtime/sets/legend-of-blue-eyes-white-dragon.jpg`. The Legend of Blue Eyes set image loads (about 71 KB).
- [ ] Open `http://localhost:4202/runtime/sets/no-such-set.jpg`. You get a 404, not an error page and not a crash.
- [ ] Open `http://localhost:4202/runtime/sets/../../package.json`. You do not get `package.json`.
- [ ] Run `npm run build:app -- --base=/ygo-story-duel/`, then `npm run preview -- --base=/ygo-story-duel/`, and open `http://localhost:4202/ygo-story-duel/runtime/sets/metal-raiders.jpg`. The Metal Raiders image loads under the deployed base path too.
- [ ] In that same preview, open `http://localhost:4202/ygo-story-duel/runtime/sets/no-such-set.jpg`. A built preview answers unknown paths with the app's own HTML page instead of a 404 — which is why a set tile must fall back on the image's `error` event rather than on a status code.

### Nothing in the app moved

- [ ] Open the app, go **Continue → Shop**. The set list renders the art this pipeline acquired — that rendering is T32's slice, checked in its own section below.
- [ ] Open a booster, sell a card, and open the deck editor. All unchanged.

## T32 shop-set-grid-and-art

The shop's browse screen is illustrated: every set tile shows the pack art T31 acquired, the
all-sets grid is four columns on a desktop screen, and the **Latest Released** row is the newest
released sets in chronological order. Set art needs `npm run assets:sets` (T31) to exist locally;
a set with no art is a normal, browsable, buyable tile, not a broken image.

### Four per row at HD, and the rest are below the fold

- [ ] Size the browser window to 1280×720 (Chromium devtools → device toolbar → **Responsive**, 1280×720, at 100% zoom). Go **Continue → Shop → Buy packs**.
- [ ] The **All Sets** grid shows exactly **four tiles per row**. Count the top row.
- [ ] The tiles are pack-shaped and large — roughly 290 px wide by 515 px tall, so one row nearly fills the height.
- [ ] Scroll down inside the shop. The remaining sets keep coming, all 50 of them, and the last row is `Legacy of the Valiant`.
- [ ] Drag the window narrower, to about 1000 px. The grid becomes **two** columns. Narrower still, under 640 px, it becomes **one**. Widen back past 1280 px and it returns to four.

### The art is the real art

- [ ] Each tile shows a booster-pack image with the set name and year written across the bottom of it.
- [ ] The first tile is **Legend of Blue Eyes White Dragon** and its picture is the Blue-Eyes pack, not a placeholder.
- [ ] No tile shows a browser broken-image icon.
- [ ] Right-click the Metal Raiders tile → **Inspect**. Its `<img>` `src` ends in `runtime/sets/metal-raiders.jpg` — the set's id, not its set code.
- [ ] Locked (unreleased) sets — everything from `Spell Ruler` down — still show their art but dimmed, with the 🔒 next to the year, and clicking one still does nothing.

### Latest Released, oldest to newest

- [ ] Above the grid, the **Latest Released** row shows only released sets — today that is three: `Legend of Blue Eyes White Dragon`, `Metal Raiders`, `Pharaoh's Servant`, in that order (oldest on the left).
- [ ] It never shows more than four. When a fourth set is marked released in `public/story/shop-sets.v1.json` the row shows four; a fifth pushes the oldest out, and the row still reads oldest-to-newest left to right.

### Shipped shop data updates reach a returning profile

- [ ] Open the Card Shop once online. Then edit `public/story/shop-sets.v1.json` (flip a fourth set's `released` to `true`), rebuild/re-serve, and revisit the shop in the same browser profile — the change is visible without clearing site data.
- [ ] DevTools → Network → **Offline**, reload, reopen the shop — the last fetched data still renders (Cache Storage entry `story-shop-data`).
- [ ] Revert the JSON edit afterwards.

### A set with no art stays usable

- [ ] Quit the dev server. Run `mv generated/set-images/metal-raiders.jpg /tmp/`, then `npm run dev` and go back to **Shop → Buy packs**.
- [ ] The Metal Raiders tile is now a plain typographic tile — a tinted panel with the name and year centred on it, no broken image.
- [ ] Click it. The set dialog still opens and buying a pack still works.
- [ ] Do the same against a **built** site, which is the case a real host hits: `mv generated/set-images/pharaohs-servant.jpg /tmp/`, `npm run build:app`, `npm run preview`, then open the shop. A built preview answers the missing image with its own HTML page and `HTTP 200` rather than a 404 — the tile must still fall back to the typographic version rather than showing a broken image.
- [ ] Restore both files: `mv /tmp/metal-raiders.jpg /tmp/pharaohs-servant.jpg generated/set-images/` and run `npm run assets:sets:verify` — `"status": "ok"`.

### Nothing else in the shop moved

- [ ] Clicking a tile opens the same set dialog as before, with Buy 1 / Buy 10 / custom amount, and the DP total drops by the right amount.
- [ ] The **View cards** route, booster opening, and the sell screen all behave as they did.
- [ ] With the network throttled to Slow 3G (devtools → Network), the grid still appears immediately and the art fills in as it loads; the page never waits on images.

## T33 shop-card-art-parity

Every card the story draws — the shop's set list and its preview, the sell screen, the two reveal
screens and the collection — goes through one tile now, and that tile renders what the deck
editor's does: the whole card at the card's own proportions, never a crop. A card the build has no
image for shows the editor's placeholder, a tinted panel with the card's initial on it, rather than
a broken image.

Run these against `npm run dev`. A built site packages only the 121 pinned card images, so almost
every tile there is a placeholder and there is no art to compare; the dev server serves all 14,579
local images.

### The same card, side by side with the deck builder

- [ ] Run `npm run dev`, open the app, go **Continue → Deck builder** and find **Change of Heart** in the catalog. Leave that tab open.
- [ ] In a second tab open the same app, go **Continue → Shop → Sell cards** and find **Change of Heart** there.
- [ ] Put the two windows beside each other. The picture is the same picture: the whole card, frame and card name and text box included, with nothing cut off at the top or the bottom in either one.
- [ ] Neither tile stretches the card sideways or squashes it. Held next to each other at the same width, the two cards are the same shape.
- [ ] Right-click each tile → **Inspect**. Both `<img>` `src` values end in `runtime/images/4031928.jpg` — the same file from the same path, not two different URLs.

### All five card surfaces

- [ ] **Shop → Buy packs → Metal Raiders → View card list.** Every tile in the grid shows a whole card. Hover one — it magnifies, still whole, still uncropped.
- [ ] The preview panel on the left of that list shows the hovered card, larger, and also whole.
- [ ] Go back, buy one Metal Raiders pack, open the boosters pill, select 1 and press **Open selected**. Click through the reveal: each revealed card is whole.
- [ ] Press **Skip** (or reveal all nine). The results grid shows nine cards, all whole.
- [ ] **Continue → Shop → Sell cards.** Every owned card shows its art above its name, count and price, and the steppers still add and subtract.
- [ ] **Deck builder → Card database** (the collection). Every tile shows a whole card, and the rarity groups still read `COMMON`, `RARE`, and so on.

### A card with no image

- [ ] Still in the collection, turn **Group by rarity** off and scroll to `Accesscode Talker` — one of the 215 cards the image set has no picture for. It shows a tinted panel with a large initial on it, the same treatment the deck builder uses for a card it has no art for. Find the same card in the deck builder's catalog: the same panel.
- [ ] No tile anywhere shows the browser's broken-image icon.
- [ ] Quit the dev server, run `mv generated/card-images/archive/full/4031928.jpg /tmp/`, start `npm run dev` again and open **Shop → Sell cards**. Change of Heart is now the placeholder panel, not a broken image, and the row still sells.
- [ ] Restore it: `mv /tmp/4031928.jpg generated/card-images/archive/full/`.

### Rarity is still visible

- [ ] In the sell screen and the results grid, the coloured halo around a rare card is still there — a common card has none, a super/ultra rare glows.

## T34 set-list-rarity-sort

The set card list's header row now carries one more button, beside **← Back** and the set name. It
cycles three states: off, common-to-rarest, rarest-to-common, then off again. Grouping is a view
setting, not a saved one — it starts off every time the list is opened.

Run these against `npm run dev`, from **Continue → Shop → Buy packs → Metal Raiders → View card
list** (144 cards, five rarities).

### The three states, in order

- [ ] The list opens ungrouped: no rarity headings anywhere, and the button on the right of the header row reads **Sort by rarity**.
- [ ] Click it once. The button reads **Rarity: common first**, and the cards are now under headings in this order, top to bottom: `COMMON`, `RARE`, `SUPER-RARE`, `ULTRA-RARE`, `SECRET-RARE`.
- [ ] Click it a second time. The button reads **Rarity: rarest first** and the same five headings appear in the opposite order: `SECRET-RARE`, `ULTRA-RARE`, `SUPER-RARE`, `RARE`, `COMMON`.
- [ ] Click it a third time. Every heading disappears and the button reads **Sort by rarity** again — the list is back to the order it opened in, unsorted.

### What grouping must not change

- [ ] In each of the three states, scroll to the bottom: every card of the set is still there exactly once. Nothing is dropped and nothing is listed twice.
- [ ] Inside any one heading the cards read alphabetically — under `SECRET-RARE`, `Gate Guardian` comes before `Thousand Dragon`.
- [ ] While grouped, hover a card near the bottom of the list. The preview panel on the left still switches to it and still names its rarity.
- [ ] While grouped, the card grid still scrolls on its own, with the header row and the preview panel staying put.
- [ ] Buy a single from a grouped list. The price and the purchase behave exactly as they do ungrouped.
- [ ] Press **← Back**, re-enter the card list. Grouping is off again — the state is not remembered.

### Keyboard and screen reader

- [ ] Tab from **← Back**: focus reaches the sort button, and Space or Enter cycles it just like a click.
- [ ] With a screen reader on, activating the button announces both the new name and its pressed state — "Rarity: common first, pressed" on the first click, "Sort by rarity, not pressed" on the third.
- [ ] The heading colours match the collection screen: a `SECRET-RARE` heading carries the same halo colour a secret-rare card's tile does.

## R2 story-chunk-headroom

The shop's screens now arrive as their own download the first time the player walks in, instead of
riding along with every narrative route. Nothing about the shop should look or behave differently —
this list is entirely about proving that.

Run these against `npm run build && npm run preview`, not the dev server: the dev server serves
modules unbundled, so it cannot show the boundary that was added. Open the browser devtools
**Network** tab before starting and leave it open. Play from **New Game** through the prologue to
the map, or **Continue** into a save that has reached it.

### Walking in

- [ ] Click the card shop on the map. The shopkeeper's greeting appears with no pause, no white or black flash, and no moment where the screen is empty below the top bar.
- [ ] The DP figure and the packs pill in the top bar stay on screen and stay readable for the whole transition — they never blank out and reappear.
- [ ] In the Network tab, exactly one new script named `shop-screens-<hash>.js` and one `shop-screens-<hash>.css` were requested at that click, and both returned 200.

### Opening a set

- [ ] Advance through both greeting lines and click **Buy Cards**. The set grid appears with its artwork; no set tile is a blank rectangle waiting for styling.
- [ ] Click a set — Metal Raiders will do. The dialog opens immediately with its price and pack controls styled the same as before.
- [ ] Buy 6 packs. The DP figure in the top bar drops by the right amount, and the packs pill reads **6 packs**.
- [ ] Press Escape, then **View card list** on the same set. The card list opens with card art and prices, again with no empty frame first.

### Opening a booster

- [ ] Click the packs pill. The booster dialog opens at once — no delay between the click and the dialog, and nothing flashes behind it.
- [ ] Click **Open all**. The reveal plays, then the results grid lists every card with its rarity halo.
- [ ] Press **Continue**. The results screen hands back to the shop, not to a blank screen.

### Coming back

- [ ] From the greeting, click **Leave Shop**. The map returns with no pause.
- [ ] Walk into the shop a second time. The greeting is instant, and the Network tab shows **no** second request for `shop-screens-<hash>.js` — it was already in hand.
- [ ] Open the gear menu, **Save**, confirm, then reload the page and **Continue**. The save resumes on the screen it was made on, shop screens included.

### Rarity ordering is unchanged

- [ ] In **Sell Cards**, a card printed in more than one set is still priced at its highest printed rarity, not its lowest — pick any card you own two printings of and check its price against the rarity shown on the higher of the two set lists.
- [ ] In the set card list, the **Sort by rarity** button still orders the headings `COMMON` → `RARE` → `SUPER-RARE` → `ULTRA-RARE` → `SECRET-RARE` on its first click, and exactly reversed on its second.

## T35 card-zoom-inspector-component

The zoom inspector was built here and mounted nowhere. **T36 has since mounted it on the
pack-opening screen** — the face-down reveal you click through — so every step below is live
*there*. The results grid that follows it is still T37's, so a step that says "results grid" is
not testable yet and is not a failure.

- [ ] Play from the map into the card shop, buy packs and open them. Greeting, set grid and set card list look and behave exactly as before: no card grows on hover there, no window floats beside one.

On the pack-opening screen (T36), for a card you have already turned over:

- [ ] Hover a revealed card. It grows to twice its size in place — same centre, whole card visible, not a crop — and an orange ring fades in around it rather than snapping on.
- [ ] A window appears beside the magnified card carrying the card's name, a stats row and its full effect text. A monster reads like `DARK · Spellcaster · Level 7 · ATK 2500 / DEF 2100`; a monster with `?` ATK reads `ATK ?`, never a negative number. A spell or trap shows name and effect text with no stats row at all.
- [ ] Hover a card in the rightmost column. The window flips to the left of the card instead of running off the screen edge. Hover the bottom row: the window sits fully on screen, top and bottom, and never hangs past the bottom edge even for one frame.
- [ ] Move the pointer from the card onto the floating window. The zoom closes — the window is decoration and cannot hold the pointer, so nothing sticks open.
- [ ] Keyboard-only, no mouse: press Tab until a revealed card takes focus. The same magnified card and window appear for the focused card, and follow the focus to the next card. This is the non-hover path — on a touch screen the same happens on tap.
- [ ] Turn on the operating system's "reduce motion" setting, reload, and hover a card. The magnified card and its halo appear at once with no fade, and everything else still behaves the same.
- [ ] Hover a Secret Rare in the results grid. The orange selection ring is still the inner ring, with the card's rarity colour glowing outside it — the two are layered, not one replacing the other.
- [ ] Known limitation to confirm rather than fix: in a browser window narrower than roughly 530px the floating text window can cover the magnified card, because neither side has room for both. Note where it happens.

## T36 booster-reveal-flip

The pack-opening screen used to be a counter: a click anywhere turned over the next card,
wherever the pointer was. It is now nine face-down cards you turn over yourself — or tick a
box and watch open themselves. Reach it by buying packs and using **Open selected** on the
booster dialog (**Open all** skips straight to the results grid, which is T37's).

### The pack arrives face down

- [ ] Buy at least one pack, click the packs pill, step the count to 1 and press **Open selected**. Nine card backs are on screen at once — a patterned back, not a blank rectangle, and not a single stacked card waiting to be clicked.
- [ ] No card name is readable and no card art is visible anywhere. A face-down card gives away nothing but its shape.
- [ ] On a desktop-width window the nine sit on **one row** spanning nearly the whole width, with only a thin margin at each edge, and the row is centred vertically in the screen. They are noticeably bigger than the old reveal's tiles.
- [ ] Narrow the window below roughly 1024px. The nine become a single centred column you scroll, and the column scrolls from its **top** — the first card is reachable, not cut off above the scroll.

### Hover shows the rarity before the face

- [ ] Hover a face-down card. A coloured glow **fades** in around it rather than snapping on, and the card stays face down — you learn the rarity before you learn the card.
- [ ] Move the pointer off. The glow fades back out.
- [ ] A `common` card shows no glow at all. That is correct, not a bug: commons have no rarity colour anywhere in the story. Hover several cards until you find one that glows, or open packs until a rare turns up.
- [ ] Hover a face-down card and confirm **no** magnified card or floating text window appears. The zoom is for cards you have already turned over.

### Clicking flips one card

- [ ] Click one card in the middle of the row. **Only that card** turns over, with a flip animation — you see it rotate, not fade or pop. Its name appears under it; every other card is still face down.
- [ ] Click the same card again. Nothing happens — a reveal is one-way.
- [ ] Hover the card you turned over. It grows to twice its size with the floating text window beside it, exactly as in the T35 steps above.
- [ ] Turn over all nine. **See all opened cards** appears only after the last one, and takes you to the results list holding those same nine cards, in the order you turned them over. A card the pack drew twice is one tile carrying a count rather than two tiles — T37 renamed the button and deduplicated the list.

### The auto-flip checkbox

- [ ] Open a fresh pack. The **Flip them for me** checkbox in the header is **unticked** — that is the default for a save that has never touched it.
- [ ] Tick it. The cards start turning themselves over from the left, roughly one every half-second, with no further input. Nine cards take about four seconds.
- [ ] Untick it mid-run. The flipping stops where it is and the cards already turned over stay turned over. Tick it again — it carries on from where it stopped rather than starting over.
- [ ] Turn a card over by hand while auto-flip is running. It stays turned over and the run does not stumble, skip or double back.
- [ ] With the box ticked, press **Skip**, then open another pack. The box is **still ticked** and the new pack starts opening itself immediately — the preference is remembered.
- [ ] Reload the page entirely, continue the save and open a pack. The box is still ticked. Untick it, reload again, open a pack: still unticked.

### Keyboard and touch

- [ ] Mouse untouched: press Tab from the top of the screen. Focus lands on the checkbox first, then on each card in turn. A focused card shows the same rarity glow a hovered one does, and the same magnified card and text window once it is turned over.
- [ ] With a card focused, press **Enter**, then on another card press **Space**. Each turns over the focused card and nothing else.
- [ ] With a screen reader, or by inspecting the accessible name, a face-down card announces as `Reveal card 3, ultra-rare` — the rarity a sighted player gets from the glow. A turned-over card announces as its card name.
- [ ] On a touch screen (or with the browser's device emulation): tap a card. It turns over. Nothing here needs a hover to be reachable.

### Reduced motion

- [ ] Turn on the operating system's **reduce motion** setting and reload. Turn a card over: it changes to its face **instantly**, with no rotation and no fade, and the rarity glow appears at once instead of fading.
- [ ] With reduce motion still on, tick **Flip them for me**. The cards still open one at a time at the same roughly half-second pace — reduced motion removes the animation, never the pacing, and must not dump all nine at once.

## T37 booster-open-all-and-results

Buying more than one pack. Before this, every card of every pack was dealt onto one screen at
once and the results grid listed all fifty-four pulls, duplicates and all. Now a pack is opened
at a time with a way out of the queue, and the recap says each card once with a count.

Reach it from the shop: **Buy** → a set → a pack count, then the packs pill in the top bar.
**Open selected** walks the packs; **Open all** on that dialog still skips the walk entirely.

### One pack at a time

- [ ] Buy **three** packs of one set. Click the packs pill, step the count to 3 and press **Open selected**. **Nine** cards are on screen, not twenty-seven, and the header reads `Pack 1 of 3`.
- [ ] Turn one card over. No **Next pack**, **Open all remaining** or **See all opened cards** button has appeared — the way on shows up only once the pack is out.
- [ ] Turn over the remaining eight. **Next pack** and **Open all remaining** both appear, side by side. There is no **See all opened cards** yet — two packs are still unopened.
- [ ] Press **Next pack**. The header reads `Pack 2 of 3`, nine cards are face down again, and they are new cards: turn one over and it is not a card you saw in pack 1 unless the set genuinely dealt it twice.
- [ ] Watch the moment you press **Next pack**. The old pack does **not** spend half a second visibly rotating blank faces back over — the new pack is simply dealt face down.
- [ ] Finish pack 2, press **Next pack** again, finish pack 3. On the last pack **Next pack** and **Open all remaining** are gone and **See all opened cards** is there instead. Press it.

### The way out mid-way

- [ ] Buy three more packs and open them. Finish pack 1 and press **Open all remaining** instead of **Next pack**. You go straight to the results list — no cards flip on the way, and no second screen asks you to confirm.
- [ ] That results list holds **all twenty-seven** cards, not just the nine you turned over. The heading reads `You opened 27 cards`.
- [ ] Do it again and press **Skip** in the corner during pack 1 instead. Same destination, same twenty-seven cards — Skip abandons the ceremony, it never abandons a card.

### Duplicates become a quantity

- [ ] On any results list from three or more packs, find a card the packs dealt more than once. It appears **once**, with a small count badge in the corner of its tile reading `×2`, `×3` and so on. There is no second tile for it anywhere in the list.
- [ ] A card dealt exactly once has **no** badge at all — an unmarked tile means one copy.
- [ ] Add up every badge, counting an unbadged tile as one. The total equals the number in the heading. Nothing was dropped and nothing was invented.
- [ ] With a screen reader, or by inspecting the accessible name, a tile with a count announces as `Kuriboh, 3 copies` — once, not as the name followed by a separate "×3".

### Grouping the results by rarity

- [ ] The results list has a **Sort by rarity** button in its header, in the same place the set card list has one.
- [ ] Press it once. It reads **Rarity: common first**, and the list breaks into headed groups running from `common` down to the rarest tier present. A tier nothing was pulled at gets no heading.
- [ ] Press it again. It reads **Rarity: rarest first** and the same groups appear in the opposite order.
- [ ] Press it a third time. It reads **Sort by rarity** again, the headings disappear, and the list is back in the order the packs dealt it.
- [ ] Compare against a set's card list (**Buy** → a set → the same button). Three presses, the same three labels, the same two directions — the two screens behave identically.
- [ ] The count badges survive all three states: a `×3` tile is still one tile with `×3` inside a rarity group.

### Nothing is lost

- [ ] After any of the routes above, press **Continue**, leave the shop and open the collection. Every card from every pack is there, including the packs you never turned over card by card, and a card pulled three times shows three copies owned.
- [ ] Buy one single pack and open it. **Next pack** and **Open all remaining** never appear — the multi-pack controls stay out of a single-pack opening. What a single pack offers instead is one **← Back**, checked in the T38 section below.

## T38 single-pack-reveal-actions

One pack has one way out, and the cards are the player's from the moment the pack is opened rather than from the moment the last one is turned over.

Nine tiles are the whole opening, so there is no results list worth walking to and nothing left to skip past. Everything here is reached the same way as T37: **Buy** → a set → a pack count, then the packs pill in the top bar.

### One pack, one button

- [ ] Buy **one** pack of any set. Click the packs pill, leave the count at 1 and press **Open selected**. Nine cards are on screen face down and the header reads `Pack 1 of 1`.
- [ ] Before turning anything over, read the buttons. There is exactly one, **← Back**, in the bottom corner. No **Skip**, no **See all opened cards**, no **Next pack**, no **Open all remaining**.
- [ ] Turn all nine over, one by one. Nothing new appears when the ninth lands — no results button slides in, no second screen offers itself. **← Back** is still the only way out.
- [ ] Press **← Back**. You land on the shop's buy list, not on a results list.
- [ ] Do it again and tick **Flip them for me** instead. The pack opens itself; when it finishes, still only **← Back**.

### Leaving with nothing turned over

- [ ] Buy one pack, press **Open selected**, and press **← Back** immediately — do not turn a single card over.
- [ ] Open the collection (leave the shop → **Collection**). All nine cards from that pack are listed. Not one of them was lost by walking out of the reveal.
- [ ] Check the packs pill. It is one lower than before — the pack was spent, not left on the shelf to be opened a second time.

### Closing the tab in the middle of a reveal

Saving is manual in this build: the gear menu writes the save, and nothing in the shop writes one for you. So the save is what survives a closed tab, and the point of this test is that a save taken mid-reveal already holds the cards.

- [ ] Save first (gear → **Save**), then buy **one** pack and press **Open selected**. Turn over two or three cards and stop.
- [ ] With the pack still half face down, open the gear menu and press **Save** again. Then **close the browser tab outright** — no Back, no Continue.
- [ ] Reopen the app and load that save. Open the collection: **all nine** cards from that pack are there, including the six you never turned over.
- [ ] Count a card the pack dealt once — it shows **one** copy, not two. Reloading a reveal does not pay it out a second time.
- [ ] Reload the same save a second time and look again. Still one copy each. The credit belongs to the pack being opened, not to the reveal being displayed.
- [ ] Now the other direction: save, buy one pack, press **Open selected**, and close the tab **without saving again**. Reopen and load. The DP is back, the pack is unbought and no cards were added — the purchase rolled back whole, rather than taking the DP and keeping the cards from you.

### Several packs are untouched by all of this

- [ ] Buy **three** packs and open them with **Open selected**. **Skip** is back in the corner and there is no **← Back** — a multi-pack opening still has packs worth skipping past.
- [ ] Finish pack 1. **Next pack** and **Open all remaining** appear exactly as T37 describes, and the walk to the results list is unchanged.

## T39 story-choice-list-and-danger

Every multiple choice the story asks is now one component: the narrative's branch
point and the shopkeeper's menu are the same centred column of large buttons, and
the action that backs out of a screen is red.

### The narrative branch

- [ ] Start a new game and press Enter until **Choose your response** appears (about 13 beats).
- [ ] The three choices sit in the **middle of the screen**, stacked in one column, each button noticeably taller than the Auto/Skip buttons in the corner. They are not tucked above the dialogue box any more.
- [ ] Keyboard: without touching the mouse, the first choice (**I trust you. Lead the way.**) already has the focus ring. Press Tab twice — focus moves down the list in the order the choices are printed, not around the screen. Press Enter on the second choice and the story takes it.
- [ ] None of the three is red — a branch has no way out to colour.
- [ ] Press **Hide UI** while the choices are open, then **Show UI**. The choices come back and the first one takes focus again.
- [ ] Repeat on a phone-sized window (about 375px wide). The column narrows to fit, and nothing runs off the side of the screen.

### The shopkeeper's menu

- [ ] Walk to the card shop and click through both greeting lines until the menu appears.
- [ ] It is the **same layout as the narrative branch**: one centred column, in the middle of the screen, buttons the same size — not the bordered panel at the bottom it used to be.
- [ ] **Leave Shop** is red; **Buy Cards** and **Sell Cards** are not. Read the red one against its label — the dark text on it is legible.
- [ ] Keyboard: the moment the menu appears, **Buy Cards** has focus. Tab to **Leave Shop**, press Enter, and you land back on the map.
- [ ] Re-enter the shop and take **Buy Cards** and **Sell Cards** by mouse. Each still opens the screen it names.

## R3 review-repairs

Three defects the round-3 review found, checked from the player's side: the main
menu's three story entries, a save written before this round still having a deck
to duel with, and leaving the pre-battle gate without losing the run.

### The main menu's three entries land on the screen they name

The shell's menu and the story's own title screen were two menus in a row, the
second one the real one (ADR-051). Each entry below opens the story *past* that
title screen.

- [ ] DevTools → Application → Storage → **Clear site data**, reload, land on the main menu, press **New Game**. The prologue's first beat is on screen. You are **not** asked to press New Game a second time.
- [ ] Play to the city map, save (gear → **Save**), and reload to the main menu. Press **Continue**. You land on the map, in one click, with the DP you had.
- [ ] Reload to the main menu and press **Load**. The story's Load screen opens directly, listing your slots. Press **Back** there: you land on the story's title screen — and *stay* there. It does not bounce you back to Load.
- [ ] From that title screen press **Main menu**, then **Continue** again. Still one click to the map.
- [ ] Type `#/story` into the address bar and press Enter. This time the title screen *is* what opens: nothing on the menu chose an entry, so nothing is skipped.
- [ ] With **Clear site data** done and no save on disk, check the menu offers **New Game**, **Load**, **Settings**, **Free Play** and no **Continue**.

### A save from before this round still has a deck to duel with

Saves written before the decks moved into the story arrived with an empty deck
list, which no screen would refill: the briefing refused to start, and the deck
editor grants a story save nothing. Such a save now opens with the same starter
deck a new game is granted, and the cards behind it.

- [ ] If you have a save from an earlier build, load it. Otherwise make one: DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`, take your `autosave` record, set `schemaVersion` to `2` and delete `state.decks` and `state.defaultDeckId` from it.
- [ ] Reload and press **Continue**. The save opens where it was left, with the DP and the cards it had.
- [ ] Choose **Old Arena**. The briefing lists **Starter Deck**, selected, with no red border and no block message. **Start Duel** enables once the card database lands.
- [ ] Open the story deck library (top bar → deck icon). **Starter Deck** is there with the **Default** badge, and no card in it is badged **CARDS NOT OWNED** — the cards were granted with it.
- [ ] Cards you already owned are still yours: open the collection and confirm a card you had bought before is still there, at the count you had.
- [ ] Press **Continue** a second time without saving in between, and check the collection again. The counts are the same — the grant completes the save once, it does not pay out again on every load.
- [ ] A save this build wrote is untouched: on a current save, delete every deck in the story deck editor, then reload and press **Continue**. The library is still empty — an empty library you chose stays empty.

### Leaving the pre-battle gate keeps the run

The way out of a blocked briefing was a plain link, and following it unmounted
the story with everything it had not written yet.

- [ ] **Clear site data**, **New Game**, play to the map, then enter the **card shop** and spend some DP on packs. Open them, and note the DP left and one card you pulled.
- [ ] Leave the shop, choose **Old Arena**, and sell-or-break your way to a block if the briefing is not already blocked (the T27 sections above give two ways). Press **Build a deck** / **Open the deck editor**.
- [ ] The URL becomes `#/story/decks` and the story deck library opens. It lists the cards you just pulled — the shop trip came with you.
- [ ] Go back to `#/story` and press **Continue**. You land on the **briefing**, with the same DP, and the pulled card is still in the collection. Nothing since your last manual save was lost.
- [ ] The way out is a button now, not a link: right-click it — there is no *Open link in new tab*, and hovering shows no URL in the status bar. Watch its label as you press it: it reads **Saving your progress…** and greys out for the moment the write takes, so a double-click cannot save the run twice.
- [ ] Refused writes keep you put: DevTools → Application → Storage, tick **Simulate custom storage quota** and set it to `1`, then reach a blocked briefing and press the button. You stay on the briefing, a *Prototype storage needs attention* banner appears, and the URL is still `#/story`. Untick the quota, press the button again, and it goes through.

---

## R4 owner-ask-repairs

Four asks the round left unmet, checked from the player's side: reading a card's
text while browsing a set to buy, the red on every control that backs out of a
screen, the preview panel's two gaps, and a save that owned part of a playset.

### Browsing a set tells you what the cards do

The set list drew its own preview — art, name, rarity, no card text — so
deciding what to buy meant buying it to find out. It now docks the same preview
panel the duel and the deck editor use.

- [ ] Reach the card shop, press **Buy**, open any set and press **View cards**. The panel on the left shows the first card's name *and* its effect text.
- [ ] Move the pointer across the grid. The panel follows the card under it: name, effect text, and the rarity line under the panel all change together.
- [ ] Tab through the grid without touching the mouse. The panel follows the focused card the same way.
- [ ] The card is drawn once, not twice: there is one image in the left column, inside the panel's frame, with no second tile above it.
- [ ] Long effect text scrolls inside the panel instead of stretching it — pick a card with a paragraph of rules text and scroll it with the wheel.

### Backing out of a screen is red

The owner's rule was "make button action that cancel or return to previous
state red", with *Leave shop* as the example. Only the example had shipped.

- [ ] In the shop, check **Leave Shop** is still red, then check the **← Back** on the set browser, on a set's card list, and on the sell screen: all four the same red.
- [ ] Open one pack, and check the **← Back** under the reveal is red. Open several: **Skip** beside it is *not* red — it moves you on to the recap, it does not take you back.
- [ ] Open the packs dialog from the top bar. Its **Close** in the footer and the **Close** in its header are both red.
- [ ] Open the gear menu → **Settings**, then **History**, then **Save**. Every overlay's header **Close** is red.
- [ ] On the city map, and on the story's Load screen, **Back** is red.
- [ ] Open the collection from the deck library. Its **← Back** is red.
- [ ] The label stays readable on the red: no grey-on-red or white-on-red anywhere above — the text is near-black.
- [ ] One dialog deliberately does not follow the rule: on the Load screen press **Delete manual slot 1**. **Delete save** is the red one and **Cancel delete** is not, because red there marks the button that destroys something.

### The preview panel's two gaps match

The effect text sat tighter under the stats than the stats sat under the name,
so it read as attached to the wrong thing.

- [ ] Start a duel and hover a card in your hand. In the left panel, the space between the **name** and the **stats line** is the same as the space between the **stats line** and the **effect text** — the text reads as the row after the stats.
- [ ] Open the deck editor and click a card in the catalog. The same panel, the same single step between the name and the text.
- [ ] Do the same in the shop's set list. All three surfaces space the panel identically.

### A save that owned part of a playset can still duel

A save from before this round is granted the starter deck. It used to keep every
count it already had, so a save owning one copy of a card the deck runs three of
was handed a deck it still could not field.

- [ ] Make the case by hand: DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`. Take a record, set `schemaVersion` to `2`, delete `state.decks` and `state.defaultDeckId`, and set `state.collection` to `{"97590747": 1, "89631139": 5}`.
- [ ] Reload and press **Continue**, then open the story deck library. **Starter Deck** is there and no card in it is badged **CARDS NOT OWNED**.
- [ ] Open the collection. The card you set to `1` now reads **×3** — topped up to what the deck runs, no further. The card you set to `5` still reads **×5** — a count above the deck's is yours and is never lowered.
- [ ] Press **Continue** a second time without saving in between and check the collection again. Both counts are unchanged: the top-up lands on the same numbers however many times the save is opened.
- [ ] Choose **Old Arena**: the briefing accepts **Starter Deck** with no block message, and **Start Duel** enables.

---

## R5 free-play-opens-on-the-seats

Free play used to open on a menu — Start a match, Deck builder, Return — and the
seats behind it sat disabled under "Reading your deck library…" while the whole
card database was fetched. The menu is gone (ADR-054), the deck builder moved
under the player's seat, and the library is read as the player reaches for the
entry rather than after they arrive.

Run `npm run dev` (default `DEV_PORT=4300`).

### Free Play lands on the decks

- [ ] Open `http://localhost:4300/#/` and click **Free Play**: the URL becomes `#/free-play` and the "Choose the decks" screen renders directly. There is no menu step and no "Start a match" button anywhere. (Corrected from T16, which put that menu on this route.)
- [ ] Both seats are on screen with a **Bundled decks** group already in them, and **Start the duel** is clickable straight away — not greyed out waiting for a read.
- [ ] Type `#/free-play` into the address bar directly, then `#/duel`: each lands on the same screen (the old link still resolves here and the address bar keeps reading `#/duel`).
- [ ] Press **Start the duel** and play a turn — the duel behaves as before.
- [ ] While the duel is on screen, open the duel's options menu (the gear on the right rail) and click **Leave match**: you land back on the deck seats, not on a menu, and the URL is still `#/free-play`. (Corrected from T16, where this returned to the free-play menu; corrected again by R6, which moved the control from the board's top-left corner into that menu.)
- [ ] Press the browser's **Back** button from the seats: you leave free play for the main menu.

### The deck builder is under your seat

- [ ] On the seats screen, a **Deck builder** button sits directly under the **Your deck** picker. The **Opponent deck** picker has none.
- [ ] Click it: the URL becomes `#/free-play/decks` and the Deck Library renders.
- [ ] Build or import a deck there, then press **Back** to `#/free-play`: your new deck is listed under **Your decks** in both pickers.
- [ ] Back on the seats, the other way out is **Main menu**, beside Start the duel: click it and you land on `#/` . (Renamed from "Back", which used to mean the free-play menu.)

### No waiting for the pickers

- [ ] Open DevTools → Network, tick **Disable cache**, and load `http://localhost:4300/#/` fresh. With the pointer nowhere near the entries: no `battle-*.js` and no `runtime/` request fires. A player who came for the story pays for none of free play.
- [ ] Now move the pointer onto **Free Play** and leave it there without clicking: `battle-*.js` and the `runtime/` catalog requests start immediately. Tab to the entry with the keyboard instead of hovering — the same requests start on focus.
- [ ] Click through: the seats are already filled, including your own decks, with no "Reading your deck library…" line.
- [ ] Reload, and this time click **Free Play** fast enough that the requests are still in flight. The seats still open with the **Bundled decks** group live and Start clickable; your own decks join the list when the read lands.
- [ ] From a duel, leave through the options menu's **Leave match**, then press **Deck builder**, then **Back**: neither return shows a loading line — the page is only revalidating what it already read.
- [ ] Delete a local deck in the deck builder and come back to the seats: it is gone from both pickers. Edit one and come back: the edited version is what the picker offers.

---

## R6 duel-chrome-trim

Six owner asks against the duel field's chrome: the match exit moved into the
duel's own menu, the piles stopped advertising a halo they could not explain,
End turn and the card action buttons shrank, Full Control moved onto the board
and lost its caption, the hand-count badges went, and effect descriptions stopped
printing `%ls` where a card's name belongs.

Run `npm run dev` (default `DEV_PORT=4300`).

### Leave match lives in the menu

- [ ] Open `#/free-play`, press **Start the duel**. Nothing is painted over the board's top-left corner any more — no "Leave match" button there.
- [ ] Open the duel's options menu (the gear at the top of the right rail). The items read, in order: **Settings**, **Surrender**, **Leave match**, **Close**.
- [ ] Click **Leave match**: you land back on the deck seats and the URL is still `#/free-play`.
- [ ] Start a duel, open the menu, press **Surrender**, then **Keep playing**: the menu's main view comes back with **Leave match** still under Surrender.
- [ ] New Game → play to an encounter and start its duel. Open that duel's options menu: **Settings**, **Surrender** and **Close** only. There is no **Leave match** — the story owns that exit.

### Piles only halo what they can show

- [ ] Reach a prompt that targets a card in your graveyard with at least one face-up card in it: the graveyard pile wears the green legality halo and opens the target list on click.
- [ ] Reach a prompt that targets a card in your deck (a search): the deck pile wears **no** halo — and clicking it still opens the list with the legal target in it. The same for a face-down extra deck.
- [ ] The other three piles behave the same way, on both sides of the board: a pile showing nothing you are allowed to see never lights up, and never stops being clickable.

### End turn and the action buttons are smaller

- [ ] Look at **End turn** in the phase strip: it is visibly shorter and its text smaller than before, still on one row, and still comfortably clickable (it holds the 44px floor).
- [ ] Play into your Battle Phase so the label becomes **End Battle Phase**: still one row, still not covering a card or pile.
- [ ] Hover a hand card so the zoom overlay opens with its action buttons stacked under it: each button is half the height it used to be. Every one of them is still readable and still clickable, and clicking one performs that action.

### Full Control sits on the board with a tooltip

- [ ] Look at the bottom-right corner **of the board itself** (inside the green field, not beside it): a bare checkbox sits there with no caption next to it.
- [ ] Hover the checkbox: a small **Full Control** tooltip appears beside it. Move the pointer away: the tooltip goes.
- [ ] Click the checkbox: it ticks, and the tooltip is showing while the box has focus. Click it again to untick.
- [ ] Hold Ctrl: the box stays on whatever you set, the tooltip's text turns accent-coloured when it is showing, and the "held by Ctrl" pill appears beside the box.
- [ ] Turn the window portrait (390x844 in the device toolbar) and start a duel: the checkbox turns with the board and stays inside it, in the same corner.

### The hand-count badges are gone

- [ ] With cards in both hands, look at the two hand bands: neither carries a small number badge in its corner any more. The cards themselves are the count.
- [ ] Draw a card and play one: the bands update as before, with nothing left showing a stale number.

### Effect descriptions name the card

- [ ] Reach an optional effect prompt — a card that asks "use this effect?" — and read the question above Yes/No: it names the card and the place it is used from, in words. No `%ls` and no other stray placeholder appears in it.

---

## A1 shop-set-base-printings

Ten sets used to price every non-common at **Ultimate Rare**, because the
generator kept a card's highest printing and those sets reprint their whole
non-common pool as an Ultimate foil. A 150 DP pack from one of them opened into
about 580 DP of sellable cards. The shipped data now folds to each card's base
printing, and `buy-packs` refuses a set that is not released.

Run `npm run dev` (default `DEV_PORT=4300`).

- [ ] Open `#/free-play/collection` and tick **Group by rarity**. That screen lists the whole card database, so it shows the shop's ladders without needing an unlocked set. The **Ultimate Rare** heading is gone, or holds only a handful of cards. It used to cover hundreds — the entire non-common pool of ten sets, every card in it priced at the foil tier. Those cards now sit under Rare, Super Rare, Ultra Rare and Secret Rare instead.
- [ ] Open `#/story`, New Game, walk to the map, enter the **Card Shop** → **Buy**. Buy a Metal Raiders pack and open it. The pack is still 9 cards, still 8 commons and one better, and the DP spent is still 150.
- [ ] Sell everything the pack gave you: the money back is **less than 150 DP**. That is the whole point — a pack must never pay for itself.
